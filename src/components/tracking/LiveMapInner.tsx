"use client";

import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
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

export default function LiveMapInner({
  referenceNumber,
  employeeLat,
  employeeLng,
  employeeName,
  pickupLat,
  pickupLng,
  dropoffLat,
  dropoffLng,
  pickupAddress,
  dropoffAddress,
  riderView = false,
  destinationPhase = "dropoff",
}: LiveMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);
  const extraMarkersRef = useRef<mapboxgl.Marker[]>([]);
  const routeSourceId = useRef(`route-${referenceNumber}-${Math.random().toString(36).slice(2, 7)}`);
  const routeLayerId = useRef(`route-layer-${referenceNumber}-${Math.random().toString(36).slice(2, 7)}`);
  const [loading, setLoading] = useState(true);
  const [mapReady, setMapReady] = useState(false);
  const mapReadyRef = useRef(false);
  const lastCenterRef = useRef<{ lat: number; lng: number } | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);

  function clearExtraMarkers() {
    extraMarkersRef.current.forEach((m) => m.remove());
    extraMarkersRef.current = [];
  }

  function drawPoints() {
    if (!map.current || !map.current.isStyleLoaded()) return;
    const mk = map.current;
    clearExtraMarkers();
    // offset when pins are <1km apart (Terminal2 vs Terminal4 ~0.4km) so they don't look "dikit"
    let close = false;
    if (pickupLat != null && dropoffLat != null && pickupLng != null && dropoffLng != null) {
      close = haversine(pickupLat, pickupLng, dropoffLat, dropoffLng) < 1;
    }
    if (pickupLat != null && pickupLng != null) {
      const m = new mapboxgl.Marker({ color: "#22c55e", offset: close ? [0, -12] as [number, number] : undefined })
        .setLngLat([pickupLng, pickupLat])
        .setPopup(new mapboxgl.Popup().setText(pickupAddress || "Pickup Location"))
        .addTo(mk);
      extraMarkersRef.current.push(m);
    }
    if (dropoffLat != null && dropoffLng != null) {
      const m = new mapboxgl.Marker({ color: "#ef4444", offset: close ? [0, 12] as [number, number] : undefined })
        .setLngLat([dropoffLng, dropoffLat])
        .setPopup(new mapboxgl.Popup().setText(dropoffAddress || "Drop-off Location"))
        .addTo(mk);
      extraMarkersRef.current.push(m);
    }
  }

  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    if (MAPBOX_TOKEN) mapboxgl.accessToken = MAPBOX_TOKEN;

    const centerLng = employeeLng ?? dropoffLng ?? pickupLng ?? 120.9842;
    const centerLat = employeeLat ?? dropoffLat ?? pickupLat ?? 14.5995;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: MAPBOX_TOKEN ? "mapbox://styles/mapbox/streets-v12" : OPEN_STREET_MAP_STYLE,
      center: [centerLng, centerLat],
      zoom: 13,
      attributionControl: false,
    });

    map.current.addControl(new mapboxgl.NavigationControl(), "top-right");
    map.current.addControl(new mapboxgl.AttributionControl({ compact: true }));

    let fallbackDone = false;
    const switchToOSM = () => {
      if (!map.current || fallbackDone) return;
      fallbackDone = true;
      console.warn("[LiveMap] Mapbox style failed, switching to OSM");
      setMapError(null);
      try {
        map.current.setStyle(OPEN_STREET_MAP_STYLE as unknown as string);
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
          const bounds = new mapboxgl.LngLatBounds();
          bounds.extend([pickupLng, pickupLat]);
          bounds.extend([dropoffLng, dropoffLat]);
          map.current.fitBounds(bounds, { padding: 60, maxZoom: 14 });
        } catch {}
      }
    }
  }, [pickupLat, pickupLng, dropoffLat, dropoffLng, pickupAddress, dropoffAddress, mapReady, employeeLat, employeeLng]);

  useEffect(() => {
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
      "flex h-8 w-8 items-center justify-center rounded-full bg-orange-500 text-white text-xs font-bold shadow-lg border-2 border-white animate-bounce";
    el.textContent = riderView ? "Y" : "E";

    try {
      markerRef.current = new mapboxgl.Marker({ element: el })
        .setLngLat([employeeLng, employeeLat])
        .setPopup(new mapboxgl.Popup().setText(employeeName || (riderView ? "You" : "Rider")))
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
            paint: { "line-color": "#3b7ac7", "line-width": 3, "line-opacity": 0.8, "line-dasharray": [1, 1] },
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
  }, [employeeLat, employeeLng, mapReady, pickupLat, pickupLng, dropoffLat, dropoffLng, employeeName, riderView, destinationPhase]);

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

  // Fallback bbox that includes both pickup and dropoff + employee
  const fbAllLats = [employeeLat, pickupLat, dropoffLat].filter((v): v is number => v != null);
  const fbAllLngs = [employeeLng, pickupLng, dropoffLng].filter((v): v is number => v != null);
  const fbMinLat = fbAllLats.length ? Math.min(...fbAllLats) : 14.5995;
  const fbMaxLat = fbAllLats.length ? Math.max(...fbAllLats) : 14.5995;
  const fbMinLng = fbAllLngs.length ? Math.min(...fbAllLngs) : 120.9842;
  const fbMaxLng = fbAllLngs.length ? Math.max(...fbAllLngs) : 120.9842;
  const fbPad = 0.015;
  const fbBbox = `${fbMinLng - fbPad},${fbMinLat - fbPad},${fbMaxLng + fbPad},${fbMaxLat + fbPad}`;
  const fbCenterLat = fbAllLats.length ? fbAllLats.reduce((a, b) => a + b, 0) / fbAllLats.length : 14.5995;
  const fbCenterLng = fbAllLngs.length ? fbAllLngs.reduce((a, b) => a + b, 0) / fbAllLngs.length : 120.9842;
  const osmEmbed = `https://www.openstreetmap.org/export/embed.html?bbox=${fbBbox}&layer=mapnik`;
  const toPct = (lat: number | undefined, lng: number | undefined) => {
    if (lat == null || lng == null) return null;
    const x = ((lng - (fbMinLng - fbPad)) / ((fbMaxLng + fbPad) - (fbMinLng - fbPad))) * 100;
    const y = ((fbMaxLat + fbPad - lat) / ((fbMaxLat + fbPad) - (fbMinLat - fbPad))) * 100;
    return { x: Math.max(5, Math.min(95, x)), y: Math.max(5, Math.min(95, y)) };
  };
  const fbPickPct = toPct(pickupLat ?? undefined, pickupLng ?? undefined);
  const fbDropPct = toPct(dropoffLat ?? undefined, dropoffLng ?? undefined);
  const fbEmpPct = toPct(employeeLat ?? undefined, employeeLng ?? undefined);
  const fbClose = pickupLat != null && dropoffLat != null && pickupLng != null && dropoffLng != null ? haversine(pickupLat, pickupLng, dropoffLat, dropoffLng) < 1 : false;

  return (
    <div className="relative">
      {loading && !mapError && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-muted/50">
          <p className="text-sm text-muted-foreground">Loading map...</p>
        </div>
      )}
      {mapError && (
        <div className="absolute inset-0 z-10 flex flex-col rounded-lg border bg-amber-50/95 overflow-hidden">
          <div className="flex-1 relative">
            <iframe
              title="OSM Fallback"
              src={osmEmbed}
              className="absolute inset-0 h-full w-full border-0"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
            {fbPickPct && (
              <div className="absolute -translate-x-1/2 -translate-y-1/2 flex h-6 w-6 items-center justify-center rounded-full bg-green-500 border-2 border-white shadow text-[8px] font-bold text-white" style={{ left: `${fbPickPct.x}%`, top: fbClose ? `calc(${fbPickPct.y}% - 10px)` : `${fbPickPct.y}%` }}>P</div>
            )}
            {fbDropPct && (
              <div className="absolute -translate-x-1/2 -translate-y-1/2 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 border-2 border-white shadow text-[8px] font-bold text-white" style={{ left: `${fbDropPct.x}%`, top: fbClose ? `calc(${fbDropPct.y}% + 10px)` : `${fbDropPct.y}%` }}>D</div>
            )}
            {fbEmpPct && (
              <div className="absolute -translate-x-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-full bg-orange-500 border-2 border-white shadow text-[10px] font-bold text-white animate-pulse" style={{ left: `${fbEmpPct.x}%`, top: `${fbEmpPct.y}%` }}>{riderView ? "Y" : "E"}</div>
            )}
          </div>
          <div className="flex items-center justify-between gap-2 bg-white px-3 py-2 text-xs">
            <p className="text-amber-800">{mapError}</p>
            <button onClick={() => { setMapError(null); setLoading(true); mapReadyRef.current = false; try { map.current?.setStyle(OPEN_STREET_MAP_STYLE as unknown as string); } catch {} }} className="rounded bg-amber-600 px-2 py-1 text-white hover:bg-amber-700">Retry</button>
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
