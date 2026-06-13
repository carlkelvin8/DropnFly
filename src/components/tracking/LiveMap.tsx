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
}

export function LiveMap({
  referenceNumber,
  employeeLat,
  employeeLng,
  employeeName,
  pickupLat,
  pickupLng,
  dropoffLat,
  dropoffLng,
}: LiveMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);
  const pickupCoords = useRef({ lat: pickupLat, lng: pickupLng });
  const dropoffCoords = useRef({ lat: dropoffLat, lng: dropoffLng });
  const employeeCoords = useRef({ lat: employeeLat, lng: employeeLng });
  const [loading, setLoading] = useState(true);
  const [noToken] = useState(!MAPBOX_TOKEN);

  useEffect(() => {
    pickupCoords.current = { lat: pickupLat, lng: pickupLng };
    dropoffCoords.current = { lat: dropoffLat, lng: dropoffLng };
    employeeCoords.current = { lat: employeeLat, lng: employeeLng };
  }, [pickupLat, pickupLng, dropoffLat, dropoffLng, employeeLat, employeeLng]);

  useEffect(() => {
    if (!MAPBOX_TOKEN) return;
    if (!mapContainer.current || map.current) return;

    mapboxgl.accessToken = MAPBOX_TOKEN;

    const centerLng = employeeCoords.current.lng || dropoffCoords.current.lng || pickupCoords.current.lng || 120.9842;
    const centerLat = employeeCoords.current.lat || dropoffCoords.current.lat || pickupCoords.current.lat || 14.5995;

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

      if (pickupCoords.current.lat && pickupCoords.current.lng) {
        new mapboxgl.Marker({ color: "#22c55e" })
          .setLngLat([pickupCoords.current.lng, pickupCoords.current.lat])
          .setPopup(new mapboxgl.Popup().setText("Pickup Location"))
          .addTo(map.current);
      }

      if (dropoffCoords.current.lat && dropoffCoords.current.lng) {
        new mapboxgl.Marker({ color: "#ef4444" })
          .setLngLat([dropoffCoords.current.lng, dropoffCoords.current.lat])
          .setPopup(new mapboxgl.Popup().setText("Drop-off Location"))
          .addTo(map.current);
      }
    });

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, []);

  useEffect(() => {
    if (!map.current || !employeeLat || !employeeLng) return;

    markerRef.current?.remove();

    const el = document.createElement("div");
    el.className = "flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-white text-xs font-bold shadow-lg border-2 border-white";
    el.innerHTML = "E";

    markerRef.current = new mapboxgl.Marker({ element: el })
      .setLngLat([employeeLng, employeeLat])
      .setPopup(new mapboxgl.Popup().setText(employeeName || "Employee"))
      .addTo(map.current);

    map.current.flyTo({ center: [employeeLng, employeeLat], zoom: 14 });
  }, [employeeLat, employeeLng, employeeName]);

  if (noToken) {
    return (
      <div className="flex h-64 items-center justify-center rounded-lg border bg-muted">
        <p className="text-sm text-muted-foreground">Mapbox token not configured. Add NEXT_PUBLIC_MAPBOX_TOKEN to .env</p>
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
      <div ref={mapContainer} className="h-96 w-full rounded-lg border" />
    </div>
  );
}
