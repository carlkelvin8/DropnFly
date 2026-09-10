"use client";

import { useEffect, useRef } from "react";

interface LocationUpdaterProps {
  enabled: boolean;
  bookingId: string;
  onStatusChange?: (status: "requesting" | "active" | "denied" | "error") => void;
}

export function LocationUpdater({ enabled, bookingId, onStatusChange }: LocationUpdaterProps) {
  const watchIdRef = useRef<number | null>(null);
  const lastSentRef = useRef<{ lat: number; lng: number; time: number } | null>(null);
  const backoffRef = useRef(0);

  useEffect(() => {
    if (!enabled) return;
    if (!navigator.geolocation) {
      onStatusChange?.("error");
      return;
    }
    onStatusChange?.("requesting");

    function isDocumentVisible() {
      return typeof document === "undefined" || document.visibilityState === "visible";
    }

    function haversine(lat1: number, lng1: number, lat2: number, lng2: number) {
      const R = 6371e3;
      const dLat = ((lat2 - lat1) * Math.PI) / 180;
      const dLng = ((lng2 - lng1) * Math.PI) / 180;
      const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    async function sendLocation(position: GeolocationPosition) {
      // pause when tab hidden to save battery/bandwidth
      if (!isDocumentVisible()) return;
      // filter jitter: ignore low accuracy >100m
      if (position.coords.accuracy != null && position.coords.accuracy > 100) return;

      const now = Date.now();
      const last = lastSentRef.current;
      // throttle: require either 10s elapsed or 10m moved
      if (last) {
        const dt = now - last.time;
        const dist = haversine(last.lat, last.lng, position.coords.latitude, position.coords.longitude);
        if (dt < 10000 && dist < 10) return;
      }

      // backoff after 429: skip until interval elapsed
      if (backoffRef.current > now) return;

      try {
        const response = await fetch("/api/tracking/location", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            bookingId,
          }),
        });
        if (response.status === 429) {
          const retry = parseInt(response.headers.get("Retry-After") || "60", 10);
          backoffRef.current = now + (isNaN(retry) ? 60 : retry) * 1000;
          return;
        }
        if (!response.ok) throw new Error("Location update failed");
        lastSentRef.current = { lat: position.coords.latitude, lng: position.coords.longitude, time: now };
        onStatusChange?.("active");
      } catch {
        onStatusChange?.("error");
      }
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      sendLocation,
      (error) => {
        if (error.code === error.PERMISSION_DENIED) onStatusChange?.("denied");
        else if (error.code === error.TIMEOUT) onStatusChange?.("error");
        else onStatusChange?.("error");
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
    );

    const onVisibility = () => {
      // when returning to foreground, trigger a fresh request via getCurrentPosition
      if (document.visibilityState === "visible" && watchIdRef.current !== null) {
        navigator.geolocation.getCurrentPosition(sendLocation, () => {}, { enableHighAccuracy: true, maximumAge: 5000, timeout: 8000 });
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      watchIdRef.current = null;
    };
  }, [enabled, bookingId, onStatusChange]);

  return null;
}
