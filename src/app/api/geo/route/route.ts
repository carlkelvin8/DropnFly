import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Server-side proxy for OSRM road routing. Browsing clients call THIS endpoint
// instead of the public OSRM servers directly, so ad-blockers, ISPs and corporate
// proxies that block those domains can no longer degrade the route to a straight line.
const SRCS = [
  "https://routing.openstreetmap.de/routed-car/route/v1/driving",
  "https://router.project-osrm.org/route/v1/driving",
];

interface RouteResult {
  coords: [number, number][]; // [lat, lng] — street-following geometry
  distanceKm: number | null;
  durationSec: number | null;
}

const cache = new Map<string, { ts: number } & RouteResult>();
const TTL_MS = 60_000;

function cacheHeaders() {
  return { "Cache-Control": "no-store, max-age=0" };
}

async function fetchWithTimeout(url: string, ms: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { signal: controller.signal, headers: { Accept: "application/json" }, cache: "no-store" });
  } finally {
    clearTimeout(timer);
  }
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const fromLat = Number(sp.get("fromLat"));
  const fromLng = Number(sp.get("fromLng"));
  const toLat = Number(sp.get("toLat"));
  const toLng = Number(sp.get("toLng"));

  if (![fromLat, fromLng, toLat, toLng].every((v) => Number.isFinite(v))) {
    return NextResponse.json({ error: "Invalid coordinates" }, { status: 400, headers: cacheHeaders() });
  }

  const key = `${fromLat.toFixed(5)},${fromLng.toFixed(5)};${toLat.toFixed(5)},${toLng.toFixed(5)}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.ts < TTL_MS) {
    return NextResponse.json(hit, { headers: cacheHeaders() });
  }

  for (const base of SRCS) {
    try {
      const url = `${base}/${fromLng},${fromLat};${toLng},${toLat}?overview=full&geometries=geojson&steps=false`;
      const res = await fetchWithTimeout(url, 9000);
      if (!res.ok) continue;
      const json = await res.json();
      const route = json?.routes?.[0];
      const raw = route?.geometry?.coordinates as [number, number][] | undefined;
      if (!Array.isArray(raw) || raw.length < 2) continue;
      // OSRM returns [lng,lat]; convert to [lat,lng] so leaflet can consume directly
      const coords = raw.map(([lng, lat]) => [lat, lng] as [number, number]);
      const result: RouteResult = {
        coords,
        distanceKm: Number.isFinite(Number(route.distance)) ? Number(route.distance) / 1000 : null,
        durationSec: Number.isFinite(Number(route.duration)) ? Number(route.duration) : null,
      };
      cache.set(key, { ts: Date.now(), ...result });
      return NextResponse.json(result, { headers: cacheHeaders() });
    } catch {
      // try next source
    }
  }

  return NextResponse.json(
    { coords: [[fromLat, fromLng], [toLat, toLng]], distanceKm: null, durationSec: null },
    { headers: cacheHeaders() }
  );
}