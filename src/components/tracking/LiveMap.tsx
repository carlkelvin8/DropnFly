"use client";

import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";

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
  /** If true, shows turn-by-turn style info on map */
  riderView?: boolean;
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

export function LiveMap({
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
}: LiveMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);
  const routeSourceId = useRef("route");
  const [loading, setLoading] = useState(true);
  const [noToken] = useState(!MAPBOX_TOKEN);

  function drawPoints() {
    if (!map.current) return;
    const mk = map.current;

    if (pickupLat && pickupLng) {
      new mapboxgl.Marker({ color: "#22c55e" })
        .setLngLat([pickupLng, pickupLat])
        .setPopup(new mapboxgl.Popup().setText(pickupAddress || "Pickup Location"))
        .addTo(mk);
    }
    if (dropoffLat && dropoffLng) {
      new mapboxgl.Marker({ color: "#ef4444" })
        .setLngLat([dropoffLng, dropoffLat])
        .setPopup(new mapboxgl.Popup().setText(dropoffAddress || "Drop-off Location"))
        .addTo(mk);
    }
  }

  useEffect(() => {
    if (!MAPBOX_TOKEN) return;
    if (!mapContainer.current || map.current) return;

    mapboxgl.accessToken = MAPBOX_TOKEN;

    const centerLng = employeeLng || dropoffLng || pickupLng || 120.9842;
    const centerLat = employeeLat || dropoffLat || pickupLat || 14.5995;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [centerLng, centerLat],
      zoom: 13,
    });

    map.current.addControl(new mapboxgl.NavigationControl(), "top-right");

    map.current.on("load", () => {
      if (!map.current) return;
      setLoading(false);
      drawPoints();
    });

    return () => {
      map.current?.remove();
      map.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- map is initialized once on mount
  }, []);

  useEffect(() => {
    if (!map.current || !employeeLat || !employeeLng) return;

    markerRef.current?.remove();

    const el = document.createElement("div");
    el.className =
      "flex h-8 w-8 items-center justify-center rounded-full bg-orange-500 text-white text-xs font-bold shadow-lg border-2 border-white animate-bounce";
    el.innerHTML = riderView ? "Y" : "E";

    markerRef.current = new mapboxgl.Marker({ element: el })
      .setLngLat([employeeLng, employeeLat])
      .setPopup(new mapboxgl.Popup().setText(employeeName || (riderView ? "You" : "Rider")))
      .addTo(map.current);

    map.current.flyTo({ center: [employeeLng, employeeLat], zoom: 14 });

    // Draw route line
    if (map.current.getSource(routeSourceId.current)) {
      (map.current.getSource(routeSourceId.current) as mapboxgl.GeoJSONSource).setData({
        type: "FeatureCollection",
        features: [],
      });
    }

    const coords: [number, number][] = [[employeeLng, employeeLat]];
    if (dropoffLat && dropoffLng) coords.push([dropoffLng, dropoffLat]);
    else if (pickupLat && pickupLng) coords.push([pickupLng, pickupLat]);

    const geojson: GeoJSON.FeatureCollection = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {},
          geometry: {
            type: "LineString",
            coordinates: coords,
          },
        },
      ],
    };

    if (map.current.getSource(routeSourceId.current)) {
      (map.current.getSource(routeSourceId.current) as mapboxgl.GeoJSONSource).setData(geojson);
    } else {
      map.current.addSource(routeSourceId.current, { type: "geojson", data: geojson });
      map.current.addLayer({
        id: "route-layer",
        type: "line",
        source: routeSourceId.current,
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
          "line-color": "#3b7ac7",
          "line-width": 3,
          "line-opacity": 0.8,
          "line-dasharray": [1, 1],
        },
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- route redraws on rider position updates only
  }, [employeeLat, employeeLng]);

  const destLat = dropoffLat || pickupLat;
  const destLng = dropoffLng || pickupLng;
  let distance: number | null = null;
  let eta: string | null = null;
  if (destLat && destLng && employeeLat && employeeLng) {
    const d = haversine(employeeLat, employeeLng, destLat, destLng);
    distance = d;
    const etaMinutes = Math.round((d / 30) * 60);
    eta = etaMinutes <= 1 ? "1 min" : `${etaMinutes} mins`;
  }

  if (noToken) {
    const riderLabel = employeeName || (riderView ? "You" : "Assigned rider");
    return (
      <div className="relative h-64 overflow-hidden rounded-lg border bg-gradient-to-br from-blue-50 via-slate-100 to-orange-50">
        <div className="absolute inset-0 opacity-40" style={{ backgroundImage: "linear-gradient(#94a3b8 1px, transparent 1px), linear-gradient(90deg, #94a3b8 1px, transparent 1px)", backgroundSize: "32px 32px" }} />
        <div className="absolute left-[12%] top-[65%] h-4 w-4 rounded-full border-2 border-white bg-green-500 shadow" title="Pickup" />
        <div className="absolute right-[12%] top-[20%] h-4 w-4 rounded-full border-2 border-white bg-red-500 shadow" title="Drop-off" />
        <div className="absolute left-[43%] top-[42%] flex h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-orange-500 text-xs font-bold text-white shadow-lg">R</div>
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path d="M13 68 C32 70 33 49 47 48 S70 35 87 23" fill="none" stroke="#3b82f6" strokeWidth="1.5" strokeDasharray="3 2" /></svg>
        <div className="absolute bottom-3 left-3 right-3 rounded-lg border bg-white/90 p-3 text-xs shadow backdrop-blur">
          <p className="font-semibold">Demo live map · {riderLabel}</p>
          <p className="mt-1 text-muted-foreground">{pickupAddress || "Pickup point"} → {dropoffAddress || "Drop-off point"}</p>
          <p className="mt-1 text-[10px] text-blue-600">Live coordinates and status updates remain active; add Mapbox credentials for the interactive street map.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      {loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-muted/50">
          <p className="text-sm text-muted-foreground">Loading map...</p>
        </div>
      )}
      <div className="absolute bottom-3 left-3 z-10 flex flex-wrap gap-2">
        {distance && (
          <div className="rounded-lg bg-white/90 px-2.5 py-1 text-xs font-medium shadow backdrop-blur">
            📏 {distance.toFixed(1)} km
          </div>
        )}
        {eta && (
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
