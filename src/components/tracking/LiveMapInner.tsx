"use client";

import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import maplibregl from "maplibre-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import "maplibre-gl/dist/maplibre-gl.css";
import "leaflet/dist/leaflet.css";
import { OPEN_STREET_MAP_STYLE } from "@/lib/map-style";
import { manilaMinutesOfDay } from "@/lib/manila-time";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";

function trafficFactorManila(): number {
  const mins = manilaMinutesOfDay(new Date());
  const h = Math.floor(mins / 60);
  if ((h >= 7 && h <= 9) || (h >= 17 && h <= 20)) return 0.7;
  if (h >= 22 || h <= 5) return 1.25;
  return 1.0;
}

interface LiveMapProps {
  referenceNumber: string;
  employeeLat?: number | null;
  employeeLng?: number | null;
  employeeName?: string;
  employeeVehicleType?: string | null;
  employeePlate?: string | null;
  pickupLat?: number;
  pickupLng?: number;
  dropoffLat?: number;
  dropoffLng?: number;
  pickupAddress?: string;
  dropoffAddress?: string;
  customerName?: string;
  riderView?: boolean;
  destinationPhase?: "pickup" | "dropoff";
}

function haversine(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Marker icon "logos": company-coded by role — PERSON = customer (pickup), BOX = drop-off/storage, VEHICLE = employee/rider.
// Vehicle icon is type-specific (motorcycle / car / truck-van) so the indicator matches the rider's real vehicle.
const PERSON_SVG =
  '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/></svg>';
const BOX_SVG =
  '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l8 4.5v9L12 20l-8-4.5v-9L12 2z"/><path d="M4 6.5l8 4.5 8-4.5"/><path d="M12 11v9"/></svg>';
const CAR_SVG =
  '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 11l1.5-4.5A2 2 0 0 1 8.4 5h7.2a2 2 0 0 1 1.9 1.5L19 11"/><path d="M3 13v4h18v-4"/><circle cx="7.5" cy="17" r="2"/><circle cx="16.5" cy="17" r="2"/></svg>';
const BIKE_SVG =
  '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18.5" cy="17.5" r="3.5"/><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="15" cy="5" r="1"/><path d="M12 17.5V14l-3-3 4-3 2 3h2"/></svg>';
const TRUCK_SVG =
  '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.62l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/></svg>';

function vehicleLogoSVG(type: string | null | undefined): string {
  const t = (type || "").toLowerCase();
  if (t.includes("motor") || t.includes("bike") || t.includes("scooter")) return BIKE_SVG;
  if (t.includes("truck") || t.includes("van") || t.includes("suv")) return TRUCK_SVG;
  return CAR_SVG;
}

function pickupIconHTML() {
  return `<div style="background:#22c55e;color:white;border:2px solid white;border-radius:50%;width:28px;height:28px;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,0.3)">${PERSON_SVG}</div>`;
}
function dropoffIconHTML() {
  return `<div style="background:#ef4444;color:white;border:2px solid white;border-radius:50%;width:28px;height:28px;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,0.3)">${BOX_SVG}</div>`;
}
function vehicleIconHTML(vehicleType?: string | null) {
  return `<div style="background:#f97316;color:white;border:2px solid white;border-radius:50%;width:30px;height:30px;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,0.35)">${vehicleLogoSVG(vehicleType)}</div>`;
}
function employeeLabel(name?: string, vehicleType?: string | null, plate?: string | null): string {
  return [name || "Rider", vehicleType, plate].filter(Boolean).join(" · ") || "Rider";
}

export default function LiveMapInner({
  referenceNumber,
  employeeLat,
  employeeLng,
  employeeName,
  employeeVehicleType,
  employeePlate,
  pickupLat,
  pickupLng,
  dropoffLat,
  dropoffLng,
  pickupAddress,
  dropoffAddress,
  customerName,
  riderView = false,
  destinationPhase = "dropoff",
}: LiveMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const extraMarkersRef = useRef<any[]>([]);
  const routeSourceId = useRef(`route-${referenceNumber}-${Math.random().toString(36).slice(2, 7)}`);
  const routeLayerId = useRef(`route-layer-${referenceNumber}-${Math.random().toString(36).slice(2, 7)}`);
  const mapLibRef = useRef<any>(null);
  const fallbackRef = useRef<HTMLDivElement>(null);
  const fallbackMapRef = useRef<any>(null);
  const [loading, setLoading] = useState(true);
  const [mapReady, setMapReady] = useState(false);
  const mapReadyRef = useRef(false);
  const lastCenterRef = useRef<{ lat: number; lng: number } | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  const routeCacheRef = useRef<{ ts: number; from: [number, number]; dest: [number, number]; coords: [number, number][] }>({
    ts: 0,
    from: [0, 0],
    dest: [0, 0],
    coords: [],
  });

  const OSRM_SOURCES = [
    "https://routing.openstreetmap.de/routed-car/route/v1/driving",
    "https://router.project-osrm.org/route/v1/driving",
  ];

  // Road-following route via OSRM (no API key). Tries multiple public servers and
  // returns null only if all fail — callers keep a dashed "guide" line so a straight
  // solid line is never presented as if it were an actual street route.
  async function fetchRoadRoute(
    fromLat: number,
    fromLng: number,
    toLat: number,
    toLng: number
  ): Promise<[number, number][] | null> {
    const now = Date.now();
    const cache = routeCacheRef.current;
    const fromDrift = haversine(fromLat, fromLng, cache.from[0], cache.from[1]) * 1000;
    const destSame =
      Math.abs(cache.dest[0] - toLat) < 1e-9 && Math.abs(cache.dest[1] - toLng) < 1e-9;
    // Throttle OSRM calls: reuse cached route if <15s old, position moved <100m and destination unchanged
    if (now - cache.ts < 15000 && fromDrift < 100 && destSame) {
      return cache.coords.length ? cache.coords : null;
    }
    for (const base of OSRM_SOURCES) {
      try {
        const req = `${base}/${fromLng},${fromLat};${toLng},${toLat}?overview=full&geometries=geojson`;
        const timeoutSignal =
          typeof AbortSignal !== "undefined" && typeof (AbortSignal as any).timeout === "function"
            ? (AbortSignal as any).timeout(8000)
            : undefined;
        const res = await fetch(req, timeoutSignal ? { signal: timeoutSignal } : undefined);
        if (!res.ok) continue;
        const json = await res.json();
        const pts = json?.routes?.[0]?.geometry?.coordinates as [number, number][] | undefined;
        if (!pts || pts.length < 2) continue;
        // OSRM returns [lng,lat]; convert to [lat,lng]
        const converted = pts.map(([lng, lat]) => [lat, lng] as [number, number]);
        cache.ts = now;
        cache.from = [fromLat, fromLng];
        cache.dest = [toLat, toLng];
        cache.coords = converted;
        return converted;
      } catch {
        // try next source
      }
    }
    cache.ts = now;
    cache.from = [fromLat, fromLng];
    cache.dest = [toLat, toLng];
    cache.coords = [];
    return null;
  }

  // Draws/updates the employee→destination line. Dashed = provisional straight guide
  // (OSRM still loading/failed); solid = actual street-following route.
  function applyRoute(lat: number, lng: number, destLat: number, destLng: number) {
    const leafletMap: any = map.current;
    const L: any = mapLibRef.current;
    if (!leafletMap || !L) return;
    const straight: [number, number][] = [[lat, lng], [destLat, destLng]];
    const cache = routeCacheRef.current;
    const cachedValid =
      cache.coords.length > 0 &&
      Date.now() - cache.ts < 15000 &&
      Math.abs(cache.dest[0] - destLat) < 1e-9 &&
      Math.abs(cache.dest[1] - destLng) < 1e-9;
    const pts = cachedValid ? cache.coords : straight;
    const line: any = (leafletMap as any)._routeLine;
    if (line) {
      try { line.setLatLngs(pts); } catch {}
      line.setStyle(cachedValid
        ? { dashArray: null, weight: 4, opacity: 0.85 }
        : { dashArray: "6,10", weight: 3, opacity: 0.45 });
    } else {
      (leafletMap as any)._routeLine = L.polyline(pts, {
        color: "#3b7ac7",
        weight: cachedValid ? 4 : 3,
        opacity: cachedValid ? 0.85 : 0.45,
        dashArray: cachedValid ? null : "6,10",
      }).addTo(leafletMap);
    }
    void fetchRoadRoute(lat, lng, destLat, destLng).then((pts) => {
      if (!(leafletMap as any)._routeLine) return;
      if (pts) {
        try {
          (leafletMap as any)._routeLine.setLatLngs(pts);
          (leafletMap as any)._routeLine.setStyle({ dashArray: null, weight: 4, opacity: 0.85 });
        } catch {}
      }
    });
  }

  function clearExtraMarkers() {
    extraMarkersRef.current.forEach((m) => {
      try { m.remove(); } catch {}
      try { if (map.current && (map.current as any).removeLayer) (map.current as any).removeLayer(m); } catch {}
    });
    extraMarkersRef.current = [];
  }

  function drawPoints() {
    if (!map.current) return;
    const lib: any = mapLibRef.current;
    if (!lib) return;
    if (MAPBOX_TOKEN && !(map.current as any).isStyleLoaded?.()) return;
    const mk: any = map.current;
    clearExtraMarkers();
    let close = false;
    if (pickupLat != null && dropoffLat != null && pickupLng != null && dropoffLng != null) {
      close = haversine(pickupLat, pickupLng, dropoffLat, dropoffLng) < 1;
    }
    if (pickupLat != null && pickupLng != null) {
      if (!MAPBOX_TOKEN) {
        const m = lib.marker([pickupLat, pickupLng], { icon: lib.divIcon({ html: pickupIconHTML(), className: "", iconSize: [28, 28], iconAnchor: [14, 14] }) }).addTo(mk);
        try { m.bindPopup(customerName ? `${customerName} — ${pickupAddress || "Pickup"}` : pickupAddress || "Pickup"); } catch {}
        extraMarkersRef.current.push(m);
      } else {
        const el = document.createElement("div");
        el.innerHTML = pickupIconHTML();
        el.className = "flex h-7 w-7 items-center justify-center rounded-full";
        el.title = pickupAddress || "Pickup";
        const m = new lib.Marker({ element: el, offset: close ? [0, -12] as [number, number] : undefined })
          .setLngLat([pickupLng, pickupLat])
          .setPopup(new lib.Popup().setText(customerName ? `${customerName} — ${pickupAddress || "Pickup"}` : pickupAddress || "Pickup Location"))
          .addTo(mk);
        extraMarkersRef.current.push(m);
      }
    }
    if (dropoffLat != null && dropoffLng != null) {
      if (!MAPBOX_TOKEN) {
        const m = lib.marker([dropoffLat, dropoffLng], { icon: lib.divIcon({ html: dropoffIconHTML(), className: "", iconSize: [28, 28], iconAnchor: [14, 14] }) }).addTo(mk);
        try { m.bindPopup(dropoffAddress || "Drop-off"); } catch {}
        extraMarkersRef.current.push(m);
      } else {
        const el = document.createElement("div");
        el.innerHTML = dropoffIconHTML();
        el.className = "flex h-7 w-7 items-center justify-center rounded-full";
        el.title = dropoffAddress || "Drop-off";
        const m = new lib.Marker({ element: el, offset: close ? [0, 12] as [number, number] : undefined })
          .setLngLat([dropoffLng, dropoffLat])
          .setPopup(new lib.Popup().setText(dropoffAddress || "Drop-off Location"))
          .addTo(mk);
        extraMarkersRef.current.push(m);
      }
    }
  }

  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    // No token -> use Leaflet directly (no Mapbox token required, fully interactive OSM)
    if (!MAPBOX_TOKEN) {
      let leafletMap: any = null;
      (async () => {
        const L = await import("leaflet");
        if (!mapContainer.current || map.current) return;
        const centerLatLeaf = employeeLat ?? pickupLat ?? dropoffLat ?? 14.5995;
        const centerLngLeaf = employeeLng ?? dropoffLng ?? pickupLng ?? 120.9842;
        leafletMap = L.map(mapContainer.current).setView([centerLatLeaf, centerLngLeaf], 13);
        (map as any).current = leafletMap;
        (mapLibRef as any).current = L;
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "© OpenStreetMap",
          maxZoom: 19,
        }).addTo(leafletMap);
        // add pickup/dropoff immediately
        const addLeafletPins = () => {
          if (pickupLat != null && pickupLng != null) {
            L.marker([pickupLat, pickupLng], { icon: L.divIcon({ html: pickupIconHTML(), className: "", iconSize: [28, 28], iconAnchor: [14, 14] }) }).addTo(leafletMap).bindPopup(customerName ? `${customerName} — ${pickupAddress || "Pickup"}` : pickupAddress || "Pickup");
          }
          if (dropoffLat != null && dropoffLng != null) {
            L.marker([dropoffLat, dropoffLng], { icon: L.divIcon({ html: dropoffIconHTML(), className: "", iconSize: [28, 28], iconAnchor: [14, 14] }) }).addTo(leafletMap).bindPopup(dropoffAddress || "Drop-off");
          }
          if (pickupLat != null && dropoffLat != null && employeeLat == null) {
            leafletMap.fitBounds([[pickupLat, pickupLng!], [dropoffLat, dropoffLng!]], { padding: [40, 40], maxZoom: 15 });
          }
          if (employeeLat != null && employeeLng != null) {
            const el = L.divIcon({ html: vehicleIconHTML(employeeVehicleType), className: "", iconSize: [30, 30], iconAnchor: [15, 15] });
            const m = L.marker([employeeLat, employeeLng], { icon: el }).addTo(leafletMap).bindPopup(employeeLabel(employeeName, employeeVehicleType, employeePlate));
            (markerRef as any).current = m;
          }
          const destLatLeaf = destinationPhase === "pickup" ? pickupLat : dropoffLat;
          const destLngLeaf = destinationPhase === "pickup" ? pickupLng : dropoffLng;
          if (employeeLat != null && employeeLng != null && destLatLeaf != null && destLngLeaf != null) {
            applyRoute(employeeLat, employeeLng, destLatLeaf, destLngLeaf);
          }
        };
        addLeafletPins();
        setLoading(false);
        setMapReady(true);
        setTimeout(() => leafletMap.invalidateSize(), 100);
      })();
      return () => {
        if (leafletMap) {
          leafletMap.remove();
          (map as any).current = null;
        }
        if (fallbackMapRef.current) {
          fallbackMapRef.current.remove();
          fallbackMapRef.current = null;
        }
      };
    }

    const lib: any = mapboxgl;
    (lib as typeof mapboxgl).accessToken = MAPBOX_TOKEN;

    const centerLng = employeeLng ?? dropoffLng ?? pickupLng ?? 120.9842;
    const centerLat = employeeLat ?? dropoffLat ?? pickupLat ?? 14.5995;

    mapLibRef.current = lib;
    map.current = new lib.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/streets-v12" as any,
      center: [centerLng, centerLat],
      zoom: 13,
      attributionControl: false,
      interactive: true,
    } as any);

    map.current.addControl(new lib.NavigationControl(), "top-right");
    map.current.addControl(new lib.AttributionControl({ compact: true }));

    let fallbackDone = false;
    const switchToOSM = () => {
      if (!map.current || fallbackDone) return;
      fallbackDone = true;
      console.warn("[LiveMap] Mapbox style failed, switching to OSM via maplibre");
      setMapError(null);
      try {
        // For mapbox->OSM fallback, recreate with maplibre if needed
        const isMapbox = MAPBOX_TOKEN && lib === mapboxgl;
        if (isMapbox) {
          const center: [number, number] = map.current.getCenter().toArray() as [number, number];
          const zoom = map.current.getZoom();
          map.current.remove();
          mapLibRef.current = maplibregl;
          map.current = new maplibregl.Map({
            container: mapContainer.current!,
            style: OPEN_STREET_MAP_STYLE as any,
            center,
            zoom,
            attributionControl: false,
          } as any);
          map.current.addControl(new maplibregl.NavigationControl(), "top-right");
          map.current.addControl(new maplibregl.AttributionControl({ compact: true }));
          map.current.on("load", markReady);
          map.current.on("error", onError);
          map.current.on("idle", () => { if (map.current?.isStyleLoaded() && !mapReadyRef.current) markReady(); });
          map.current.on("styledata", () => { if (map.current?.isStyleLoaded() && !mapReadyRef.current) markReady(); });
        } else {
          map.current.setStyle(OPEN_STREET_MAP_STYLE as unknown as string);
        }
      } catch {}
    };

    const markReady = () => {
      if (!map.current) return;
      if (!map.current.isStyleLoaded()) return;
      if (mapReadyRef.current) return;
      mapReadyRef.current = true;
      setLoading(false);
      setMapError(null);
      setMapReady(true);
      drawPoints();
      // map may be hidden initially (tabs) — ensure tiles render
      setTimeout(() => map.current?.resize(), 150);
      // second resize after tiles start loading
      setTimeout(() => map.current?.resize(), 600);
    };
    const onError = (e: unknown) => {
      const err = e as { error?: { status?: number; message?: string }; sourceId?: string; tile?: unknown };
      // Ignore transient tile 404s for OSM - they don't mean map failed
      if (!MAPBOX_TOKEN && err?.sourceId === "openStreetMap") {
        console.warn("[LiveMap] OSM tile error ignored:", err?.error?.message);
        return;
      }
      console.error("[LiveMap] map error:", e, err?.error?.message);
      // Any Mapbox error -> fallback to OSM immediately
      if (MAPBOX_TOKEN && !fallbackDone) {
        switchToOSM();
        return;
      }
      if (fallbackDone) {
        // OSM also failed after fallback
        setMapError("Map failed to load — check connection or try reloading.");
        setLoading(false);
        return;
      }
      // No token case but style error (not tile)
      if (!err?.sourceId) {
        setMapError("Map failed to load — check connection or try reloading.");
        setLoading(false);
      }
    };
    map.current.on("load", markReady);
    map.current.on("error", onError);
    map.current.on("idle", () => {
      if (map.current?.isStyleLoaded() && !mapReadyRef.current) {
        markReady();
      }
    });
    // also handle styledata for raster tiles
    map.current.on("styledata", () => {
      if (map.current?.isStyleLoaded() && !mapReadyRef.current) markReady();
    });
    // hard fallback timeout: if style never loads in 4s, try OSM
    setTimeout(() => {
      if (!mapReadyRef.current && MAPBOX_TOKEN && !fallbackDone) {
        console.warn("[LiveMap] timeout fallback to OSM");
        switchToOSM();
      }
    }, 4000);
    // ensure loading overlay never blocks forever (maplibre sometimes slow)
    setTimeout(() => {
      if (!mapReadyRef.current && map.current?.isStyleLoaded()) {
        markReady();
      } else if (!mapReadyRef.current) {
        setLoading(false);
      }
    }, 3000);

    // handle container resize (tab switch)
    const ro = new ResizeObserver(() => map.current?.resize());
    if (mapContainer.current) ro.observe(mapContainer.current);

    return () => {
      ro.disconnect();
      clearExtraMarkers();
      markerRef.current?.remove();
      markerRef.current = null;
      map.current?.remove();
      map.current = null;
    };
  }, []);

  // Redraw terminal pins when they change after map is ready - also fit bounds to show both pickup and dropoff when no employee yet
  useEffect(() => {
    if (mapReady) {
      drawPoints();
      if (employeeLat == null && pickupLat != null && dropoffLat != null && pickupLng != null && dropoffLng != null && map.current) {
        try {
          const LngLatBounds = (mapLibRef.current?.LngLatBounds || (mapboxgl as any).LngLatBounds || (maplibregl as any).LngLatBounds);
          const bounds = new LngLatBounds();
          bounds.extend([pickupLng, pickupLat]);
          bounds.extend([dropoffLng, dropoffLat]);
          map.current.fitBounds(bounds, { padding: 60, maxZoom: 14 });
        } catch {}
      }
    }
  }, [pickupLat, pickupLng, dropoffLat, dropoffLng, pickupAddress, dropoffAddress, mapReady, employeeLat, employeeLng]);

  // Fallback leaflet map when mapbox/maplibre fails - interactive OSM with both pins
  useEffect(() => {
    if (!mapError || !fallbackRef.current) return;
    let leafletMap: any = null;
    (async () => {
      const L = await import("leaflet");
      if (!fallbackRef.current || fallbackMapRef.current) return;
      const centerLat = [employeeLat, pickupLat, dropoffLat].filter((v): v is number => v != null).reduce((a, b, _, arr) => a + b / arr.length, 0) || 14.5995;
      const centerLng = [employeeLng, pickupLng, dropoffLng].filter((v): v is number => v != null).reduce((a, b, _, arr) => a + b / arr.length, 0) || 120.9842;
      leafletMap = L.map(fallbackRef.current).setView([centerLat, centerLng], 13);
      fallbackMapRef.current = leafletMap;
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap",
        maxZoom: 19,
      }).addTo(leafletMap);
      const bounds: any[] = [];
      if (pickupLat != null && pickupLng != null) {
        const m = L.marker([pickupLat, pickupLng], { icon: L.divIcon({ html: pickupIconHTML(), className: "", iconSize: [28, 28], iconAnchor: [14, 14] }) }).addTo(leafletMap);
        m.bindPopup(pickupAddress || "Pickup");
        bounds.push([pickupLat, pickupLng]);
      }
      if (dropoffLat != null && dropoffLng != null) {
        const m = L.marker([dropoffLat, dropoffLng], { icon: L.divIcon({ html: dropoffIconHTML(), className: "", iconSize: [28, 28], iconAnchor: [14, 14] }) }).addTo(leafletMap);
        m.bindPopup(dropoffAddress || "Drop-off");
        bounds.push([dropoffLat, dropoffLng]);
      }
      if (employeeLat != null && employeeLng != null) {
        const m = L.marker([employeeLat, employeeLng], { icon: L.divIcon({ html: vehicleIconHTML(employeeVehicleType), className: "", iconSize: [30, 30], iconAnchor: [15, 15] }) }).addTo(leafletMap);
        m.bindPopup(employeeLabel(employeeName, employeeVehicleType, employeePlate));
        bounds.push([employeeLat, employeeLng]);
      }
      if (bounds.length > 1) leafletMap.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
      setTimeout(() => leafletMap.invalidateSize(), 100);
    })();
    return () => {
      if (leafletMap) {
        leafletMap.remove();
        fallbackMapRef.current = null;
      }
    };
  }, [mapError, pickupLat, pickupLng, dropoffLat, dropoffLng, employeeLat, employeeLng, pickupAddress, dropoffAddress, employeeName, employeeVehicleType, employeePlate, riderView]);

  useEffect(() => {
    // Leaflet primary (no token) - update marker and polyline
    if (!MAPBOX_TOKEN) {
      const leafletMap: any = map.current;
      const L: any = mapLibRef.current;
      if (!leafletMap || !L || employeeLat == null || employeeLng == null) return;
      // update or create employee marker
      if (markerRef.current) {
        try { markerRef.current.setLatLng([employeeLat, employeeLng]); } catch {}
      } else {
        const el = L.divIcon({ html: vehicleIconHTML(employeeVehicleType), className: "", iconSize: [30, 30], iconAnchor: [15, 15] });
        const m = L.marker([employeeLat, employeeLng], { icon: el }).addTo(leafletMap);
        m.bindPopup(employeeLabel(employeeName, employeeVehicleType, employeePlate));
        (markerRef as any).current = m;
      }
      // simple pan, keep both pins in view - leaflet handles via setView
      try { leafletMap.panTo([employeeLat, employeeLng], { animate: true }); } catch {}
      // polyline for leaflet — dashed guide, upgraded to road-following street route via OSRM
      const destLatLeaf = destinationPhase === "pickup" ? pickupLat : dropoffLat;
      const destLngLeaf = destinationPhase === "pickup" ? pickupLng : dropoffLng;
      if (destLatLeaf != null && destLngLeaf != null) {
        applyRoute(employeeLat, employeeLng, destLatLeaf, destLngLeaf);
      }
      return;
    }
    if (!map.current || employeeLat == null || employeeLng == null || !mapReady) return;
    // Style must be fully loaded before adding sources/layers — otherwise Mapbox throws "Style is not done loading"
    if (!map.current.isStyleLoaded()) {
      const onStyleLoad = () => {
        if (map.current?.isStyleLoaded()) setMapReady(true);
      };
      map.current.once("load", onStyleLoad);
      map.current.once("styledata", onStyleLoad);
      return;
    }

    markerRef.current?.remove();

    const el = document.createElement("div");
    el.className =
      "flex h-8 w-8 items-center justify-center rounded-full animate-bounce";
    el.innerHTML = vehicleIconHTML(employeeVehicleType);

    try {
      markerRef.current = new mapboxgl.Marker({ element: el })
        .setLngLat([employeeLng, employeeLat])
        .setPopup(new mapboxgl.Popup().setText(employeeLabel(employeeName, employeeVehicleType, employeePlate) || (riderView ? "You" : "Rider")))
        .addTo(map.current);

      // avoid stealing user pan: only flyTo if moved >50m or first fix
      const last = lastCenterRef.current;
      const moved = last ? haversine(last.lat, last.lng, employeeLat, employeeLng) * 1000 : Infinity;
      if (moved > 50) {
        map.current.flyTo({ center: [employeeLng, employeeLat], zoom: 14 });
        lastCenterRef.current = { lat: employeeLat, lng: employeeLng };
      }

      // Bug 8+9: prefer exact coords (pickupLat/Lng) else terminal fallback, then try Mapbox Directions for road route
      const destLng = destinationPhase === "pickup" ? pickupLng : dropoffLng;
      const destLat = destinationPhase === "pickup" ? pickupLat : dropoffLat;
      let coords: [number, number][] = [[employeeLng, employeeLat]];
      if (destLng != null && destLat != null) coords.push([destLng, destLat]);

      const setRoute = (routeCoords: [number, number][]) => {
        if (!map.current) return;
        const geojson: GeoJSON.FeatureCollection = {
          type: "FeatureCollection",
          features: [{ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: routeCoords } }],
        };
        if (map.current.getSource(routeSourceId.current)) {
          (map.current.getSource(routeSourceId.current) as mapboxgl.GeoJSONSource).setData(geojson);
        } else {
          map.current.addSource(routeSourceId.current, { type: "geojson", data: geojson });
          map.current.addLayer({
            id: routeLayerId.current,
            type: "line",
            source: routeSourceId.current,
            layout: { "line-join": "round", "line-cap": "round" },
            paint: { "line-color": "#3b7ac7", "line-width": 4, "line-opacity": 0.85 },
          });
        }
      };

      // default straight line immediately for instant UX, then upgrade to road route if token
      setRoute(coords);

      if (MAPBOX_TOKEN && destLat != null && destLng != null) {
        const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${employeeLng},${employeeLat};${destLng},${destLat}?geometries=geojson&overview=full&access_token=${MAPBOX_TOKEN}`;
        fetch(url).then((r) => r.json()).then((d) => {
          if (d.routes?.[0]?.geometry?.coordinates?.length) {
            setRoute(d.routes[0].geometry.coordinates as [number, number][]);
          }
        }).catch(() => {});
      }
    } catch (e) {
      // Mapbox can throw if style unloaded mid-update — defer to next tick
      console.warn("[LiveMap] style not ready, deferring:", e);
    }
  }, [employeeLat, employeeLng, mapReady, pickupLat, pickupLng, dropoffLat, dropoffLng, employeeName, employeeVehicleType, employeePlate, riderView, destinationPhase]);

  const destLat = destinationPhase === "pickup" ? pickupLat : dropoffLat;
  const destLng = destinationPhase === "pickup" ? pickupLng : dropoffLng;
  let distance: number | null = null;
  let eta: string | null = null;
  if (destLat != null && destLng != null && employeeLat != null && employeeLng != null) {
    const base = haversine(employeeLat, employeeLng, destLat, destLng);
    // road factor 1.35 * traffic
    const tf = trafficFactorManila();
    const d = base * 1.35;
    distance = d;
    const etaMinutes = Math.round((d / (30 * tf)) * 60);
    if (etaMinutes <= 1) eta = "1 min";
    else if (etaMinutes < 60) eta = `${etaMinutes} mins`;
    else { const h = Math.floor(etaMinutes / 60); const m = etaMinutes % 60; eta = m ? `${h}h ${m}m` : `${h}h`; }
  }

  // Fallback placeholder (no external DNS) – show pins text when map fails
  const fbCenterLat = [employeeLat, pickupLat, dropoffLat].filter((v): v is number => v != null).reduce((a, b, _, arr) => a + b / arr.length, 0) || 14.5995;
  const fbCenterLng = [employeeLng, pickupLng, dropoffLng].filter((v): v is number => v != null).reduce((a, b, _, arr) => a + b / arr.length, 0) || 120.9842;

  return (
    <div className="relative">
      {loading && !mapError && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-muted/50 pointer-events-none">
          <p className="text-sm text-muted-foreground">Loading map...</p>
        </div>
      )}
      {mapError && (
        <div className="absolute inset-0 z-10 flex flex-col rounded-lg border bg-white overflow-hidden">
          <div ref={fallbackRef} className="flex-1 w-full" style={{ minHeight: 300 }} />
          <div className="flex items-center justify-between gap-2 bg-white px-3 py-2 text-xs border-t">
            <p className="text-amber-800">{mapError} — fallback interactive map</p>
            <button onClick={() => { setMapError(null); setLoading(true); mapReadyRef.current = false; try { map.current?.setStyle(OPEN_STREET_MAP_STYLE as unknown as string); } catch {} fallbackMapRef.current?.remove(); fallbackMapRef.current = null; }} className="rounded bg-amber-600 px-2 py-1 text-white hover:bg-amber-700">Retry Mapbox</button>
          </div>
        </div>
      )}
      <div className="absolute bottom-3 left-3 z-10 flex flex-wrap gap-2">
        {distance !== null && (
          <div className="rounded-lg bg-white/90 px-2.5 py-1 text-xs font-medium shadow backdrop-blur">
            📏 {distance.toFixed(1)} km
          </div>
        )}
        {eta !== null && (
          <div className="rounded-lg bg-white/90 px-2.5 py-1 text-xs font-medium shadow backdrop-blur">
            ⏱ ETA: {eta}
          </div>
        )}
      </div>
      {pickupAddress && dropoffAddress && (
        <div className="absolute bottom-3 right-3 z-10 max-w-[200px] rounded-lg bg-white/90 px-2.5 py-1.5 text-[10px] shadow backdrop-blur">
          <p className="font-medium">📍 {pickupAddress}</p>
          <p className="text-muted-foreground">➡ {dropoffAddress}</p>
        </div>
      )}
      <div ref={mapContainer} className="h-96 w-full rounded-lg border" />
    </div>
  );
}
