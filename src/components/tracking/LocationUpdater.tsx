"use client";

import { useEffect, useRef } from "react";

interface LocationUpdaterProps {
  enabled: boolean;
}

export function LocationUpdater({ enabled }: LocationUpdaterProps) {
  const watchIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled || !navigator.geolocation) return;

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
      } catch {
        // silently fail
      }
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      sendLocation,
      () => {},
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
    );

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, [enabled]);

  return null;
}
