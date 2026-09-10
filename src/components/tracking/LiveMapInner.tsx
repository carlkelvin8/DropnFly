"use client";

import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { OPEN_STREET_MAP_STYLE } from "@/lib/map-style";

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
  const routeSourceId = useRef("route");
  const [loading, setLoading] = useState(true);
  const [mapReady, setMapReady] = useState(false);

  function drawPoints() {
    if (!map.current || !map.current.isStyleLoaded()) return;
    const mk = map.current;

    if (pickupLat != null && pickupLng != null) {
      new mapboxgl.Marker({ color: "#22c55e" })
        .setLngLat([pickupLng, pickupLat])
        .setPopup(new mapboxgl.Popup().setText(pickupAddress || "Pickup Location"))
        .addTo(mk);
    }
    if (dropoffLat != null && dropoffLng != null) {
      new mapboxgl.Marker({ color: "#ef4444" })
        .setLngLat([dropoffLng, dropoffLat])
        .setPopup(new mapboxgl.Popup().setText(dropoffAddress || "Drop-off Location"))
        .addTo(mk);
    }
  }

  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    if (MAPBOX_TOKEN) mapboxgl.accessToken = MAPBOX_TOKEN;

    const centerLng = employeeLng || dropoffLng || pickupLng || 120.9842;
    const centerLat = employeeLat || dropoffLat || pickupLat || 14.5995;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: MAPBOX_TOKEN ? "mapbox://styles/mapbox/streets-v12" : OPEN_STREET_MAP_STYLE,
      center: [centerLng, centerLat],
      zoom: 13,
    });

    map.current.addControl(new mapboxgl.NavigationControl(), "top-right");

    const onLoad = () => {
      if (!map.current) return;
      setLoading(false);
      setMapReady(true);
      drawPoints();
    };
    map.current.on("load", onLoad);
    // Fallback: raster style may fire 'idle' instead of 'load' — ensure ready
    map.current.on("idle", () => {
      if (map.current?.isStyleLoaded() && !mapReady) {
        setMapReady(true);
        setLoading(false);
      }
    });

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, []);

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
    el.innerHTML = riderView ? "Y" : "E";

    try {
      markerRef.current = new mapboxgl.Marker({ element: el })
        .setLngLat([employeeLng, employeeLat])
        .setPopup(new mapboxgl.Popup().setText(employeeName || (riderView ? "You" : "Rider")))
        .addTo(map.current);

      map.current.flyTo({ center: [employeeLng, employeeLat], zoom: 14 });

      const coords: [number, number][] = [[employeeLng, employeeLat]];
      if (destinationPhase === "pickup" && pickupLat != null && pickupLng != null) coords.push([pickupLng, pickupLat]);
      else if (destinationPhase === "dropoff" && dropoffLat != null && dropoffLng != null) coords.push([dropoffLng, dropoffLat]);

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
    const d = haversine(employeeLat, employeeLng, destLat, destLng);
    distance = d;
    const etaMinutes = Math.round((d / 30) * 60);
    eta = etaMinutes <= 1 ? "1 min" : `${etaMinutes} mins`;
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
