"use client";

import { useEffect, useRef } from "react";

interface LocationUpdaterProps {
  enabled: boolean;
  onStatusChange?: (status: "requesting" | "active" | "denied" | "error") => void;
}

export function LocationUpdater({ enabled, onStatusChange }: LocationUpdaterProps) {
  const watchIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) return;
    if (!navigator.geolocation) {
      onStatusChange?.("error");
      return;
    }
    onStatusChange?.("requesting");

    async function sendLocation(position: GeolocationPosition) {
      try {
        await fetch("/api/tracking/location", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
          }),
        });
        onStatusChange?.("active");
      } catch {
        onStatusChange?.("error");
      }
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      sendLocation,
      (error) => onStatusChange?.(error.code === error.PERMISSION_DENIED ? "denied" : "error"),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
    );

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, [enabled, onStatusChange]);

  return null;
}
