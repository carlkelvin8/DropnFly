"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Play, Pause, SkipBack, SkipForward, RotateCcw,
  MapPin, Clock, Navigation, Gauge,
} from "lucide-react";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";

interface LocationPoint {
  id: string;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  createdAt: string;
}

interface LocationPlaybackProps {
  userId: string;
  userName?: string;
}

function formatTime(date: Date) {
  return date.toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function formatDuration(ms: number) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
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

export function LocationPlayback({ userId, userName }: LocationPlaybackProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);
  const animFrame = useRef<number | null>(null);

  const [points, setPoints] = useState<LocationPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [dateFrom, setDateFrom] = useState(() => new Date().toISOString().split("T")[0]);
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split("T")[0]);
  const [totalDistance, setTotalDistance] = useState(0);
  const [mapReady, setMapReady] = useState(false);

  const playingRef = useRef(playing);
  const currentIndexRef = useRef(currentIndex);
  const speedRef = useRef(speed);

  useEffect(() => { playingRef.current = playing; }, [playing]);
  useEffect(() => { currentIndexRef.current = currentIndex; }, [currentIndex]);
  useEffect(() => { speedRef.current = speed; }, [speed]);

  // Load location data
  const loadData = useCallback(async () => {
    setLoading(true);
    setPlaying(false);
    setCurrentIndex(0);
    try {
      const params = new URLSearchParams({ from: dateFrom, to: dateTo, limit: "2000" });
      const res = await fetch(`/api/tracking/history/${userId}?${params}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data: LocationPoint[] = await res.json();
      setPoints(data);

      // Calculate total distance
      let dist = 0;
      for (let i = 1; i < data.length; i++) {
        dist += haversine(data[i - 1].latitude, data[i - 1].longitude, data[i].latitude, data[i].longitude);
      }
      setTotalDistance(dist);
    } catch {
      setPoints([]);
      setTotalDistance(0);
    } finally {
      setLoading(false);
    }
  }, [userId, dateFrom, dateTo]);

  // Initialize map
  useEffect(() => {
    if (!MAPBOX_TOKEN || !mapContainer.current || map.current) return;
    mapboxgl.accessToken = MAPBOX_TOKEN;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: [120.9842, 14.5995],
      zoom: 12,
    });

    map.current.addControl(new mapboxgl.NavigationControl(), "top-right");
    map.current.on("load", () => setMapReady(true));

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, []);

  // Draw route when points change
  useEffect(() => {
    if (!map.current || !mapReady || points.length === 0) return;

    const coords = points.map((p) => [p.longitude, p.latitude] as [number, number]);

    // Fit bounds
    const bounds = new mapboxgl.LngLatBounds();
    coords.forEach((c) => bounds.extend(c));
    map.current.fitBounds(bounds, { padding: 60, maxZoom: 15 });

    // Draw full route line
    const geojson: GeoJSON.FeatureCollection = {
      type: "FeatureCollection",
      features: [{
        type: "Feature",
        properties: {},
        geometry: { type: "LineString", coordinates: coords },
      }],
    };

    if (map.current.getSource("playback-route")) {
      (map.current.getSource("playback-route") as mapboxgl.GeoJSONSource).setData(geojson);
    } else {
      map.current.addSource("playback-route", { type: "geojson", data: geojson });
      map.current.addLayer({
        id: "playback-route-line",
        type: "line",
        source: "playback-route",
        paint: {
          "line-color": "#6366f1",
          "line-width": 3,
          "line-opacity": 0.4,
        },
      });
    }

    // Progress line (highlighted portion)
    const progressGeojson: GeoJSON.FeatureCollection = {
      type: "FeatureCollection",
      features: [{
        type: "Feature",
        properties: {},
        geometry: { type: "LineString", coordinates: coords.slice(0, 1) },
      }],
    };

    if (map.current.getSource("playback-progress")) {
      (map.current.getSource("playback-progress") as mapboxgl.GeoJSONSource).setData(progressGeojson);
    } else {
      map.current.addSource("playback-progress", { type: "geojson", data: progressGeojson });
      map.current.addLayer({
        id: "playback-progress-line",
        type: "line",
        source: "playback-progress",
        paint: {
          "line-color": "#22d3ee",
          "line-width": 4,
          "line-opacity": 0.9,
        },
      });
    }

    // Start marker
    new mapboxgl.Marker({ color: "#22c55e" })
      .setLngLat(coords[0])
      .setPopup(new mapboxgl.Popup().setText("Start"))
      .addTo(map.current);

    // End marker
    new mapboxgl.Marker({ color: "#ef4444" })
      .setLngLat(coords[coords.length - 1])
      .setPopup(new mapboxgl.Popup().setText("End"))
      .addTo(map.current);
  }, [points, mapReady]);

  // Update marker and progress line on index change
  useEffect(() => {
    if (!map.current || points.length === 0) return;
    const point = points[currentIndex];
    if (!point) return;

    // Move/create rider marker
    if (markerRef.current) {
      markerRef.current.setLngLat([point.longitude, point.latitude]);
    } else {
      const el = document.createElement("div");
      el.className = "flex h-8 w-8 items-center justify-center rounded-full bg-cyan-500 text-white text-xs font-bold shadow-lg border-2 border-white";
      el.innerHTML = "▶";
      markerRef.current = new mapboxgl.Marker({ element: el })
        .setLngLat([point.longitude, point.latitude])
        .addTo(map.current);
    }

    // Update progress line
    if (map.current.getSource("playback-progress")) {
      const coords = points.slice(0, currentIndex + 1).map((p) => [p.longitude, p.latitude] as [number, number]);
      (map.current.getSource("playback-progress") as mapboxgl.GeoJSONSource).setData({
        type: "FeatureCollection",
        features: [{
          type: "Feature",
          properties: {},
          geometry: { type: "LineString", coordinates: coords },
        }],
      });
    }
  }, [currentIndex, points]);

  // Playback animation
  useEffect(() => {
    if (!playing || points.length === 0) return;

    let lastTime = Date.now();

    function animate() {
      if (!playingRef.current) return;

      const now = Date.now();
      const elapsed = now - lastTime;

      // Advance based on speed (base: 200ms per point at 1x)
      if (elapsed >= 200 / speedRef.current) {
        lastTime = now;
        const nextIdx = currentIndexRef.current + 1;
        if (nextIdx >= points.length) {
          setPlaying(false);
          return;
        }
        setCurrentIndex(nextIdx);
      }

      animFrame.current = requestAnimationFrame(animate);
    }

    animFrame.current = requestAnimationFrame(animate);

    return () => {
      if (animFrame.current) cancelAnimationFrame(animFrame.current);
    };
  }, [playing, points.length]);

  const currentPoint = points[currentIndex];
  const startTime = points.length > 0 ? new Date(points[0].createdAt) : null;
  const endTime = points.length > 0 ? new Date(points[points.length - 1].createdAt) : null;
  const currentTime = currentPoint ? new Date(currentPoint.createdAt) : null;
  const duration = startTime && endTime ? endTime.getTime() - startTime.getTime() : 0;

  if (!MAPBOX_TOKEN) {
    return (
      <div className="flex h-64 items-center justify-center rounded-xl border bg-muted">
        <p className="text-sm text-muted-foreground">Mapbox token not configured</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Date Filter */}
      <div className="flex flex-wrap items-end gap-3 rounded-xl border bg-card p-4 shadow-sm">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">From</label>
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-40" />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">To</label>
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-40" />
        </div>
        <Button onClick={loadData} disabled={loading} className="gap-2">
          {loading ? (
            <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> Loading...</>
          ) : (
            <><Navigation className="h-4 w-4" /> Load Route</>
          )}
        </Button>
        {userName && (
          <span className="ml-auto text-sm text-muted-foreground">
            Rider: <strong>{userName}</strong>
          </span>
        )}
      </div>

      {/* Map */}
      <div className="relative overflow-hidden rounded-xl border shadow-sm">
        <div ref={mapContainer} className="h-[450px] w-full" />

        {/* Stats overlay */}
        {points.length > 0 && (
          <div className="absolute top-3 left-3 z-10 flex flex-wrap gap-2">
            <div className="flex items-center gap-1.5 rounded-lg bg-black/70 px-2.5 py-1.5 text-xs text-white backdrop-blur">
              <MapPin className="h-3.5 w-3.5 text-cyan-400" />
              {points.length} points
            </div>
            <div className="flex items-center gap-1.5 rounded-lg bg-black/70 px-2.5 py-1.5 text-xs text-white backdrop-blur">
              <Gauge className="h-3.5 w-3.5 text-emerald-400" />
              {totalDistance.toFixed(2)} km
            </div>
            <div className="flex items-center gap-1.5 rounded-lg bg-black/70 px-2.5 py-1.5 text-xs text-white backdrop-blur">
              <Clock className="h-3.5 w-3.5 text-amber-400" />
              {formatDuration(duration)}
            </div>
          </div>
        )}

        {/* Current time overlay */}
        {currentTime && (
          <div className="absolute bottom-3 left-3 z-10 rounded-lg bg-black/70 px-3 py-2 text-xs text-white backdrop-blur">
            <span className="text-cyan-400 font-mono">{formatTime(currentTime)}</span>
          </div>
        )}
      </div>

      {/* Playback Controls */}
      {points.length > 0 && (
        <div className="rounded-xl border bg-card p-4 shadow-sm space-y-3">
          {/* Progress bar */}
          <div className="relative">
            <input
              type="range"
              min={0}
              max={points.length - 1}
              value={currentIndex}
              onChange={(e) => { setPlaying(false); setCurrentIndex(parseInt(e.target.value)); }}
              className="w-full h-2 rounded-full appearance-none bg-muted cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-cyan-500 [&::-webkit-slider-thumb]:shadow-lg"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
              <span>{startTime ? formatTime(startTime) : ""}</span>
              <span>{endTime ? formatTime(endTime) : ""}</span>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => { setPlaying(false); setCurrentIndex(0); }}
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => { setPlaying(false); setCurrentIndex(Math.max(0, currentIndex - 10)); }}
              >
                <SkipBack className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                className="h-10 w-10 rounded-full bg-cyan-500 hover:bg-cyan-600"
                onClick={() => setPlaying(!playing)}
              >
                {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" />}
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => { setPlaying(false); setCurrentIndex(Math.min(points.length - 1, currentIndex + 10)); }}
              >
                <SkipForward className="h-4 w-4" />
              </Button>
            </div>

            {/* Speed control */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Speed:</span>
              <div className="flex gap-1">
                {[0.5, 1, 2, 5, 10].map((s) => (
                  <button
                    key={s}
                    onClick={() => setSpeed(s)}
                    className={`rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                      speed === s ? "bg-cyan-500 text-white" : "bg-muted text-muted-foreground hover:bg-muted/80"
                    }`}
                  >
                    {s}x
                  </button>
                ))}
              </div>
            </div>

            {/* Position indicator */}
            <span className="text-xs text-muted-foreground font-mono">
              {currentIndex + 1} / {points.length}
            </span>
          </div>
        </div>
      )}

      {/* No data state */}
      {!loading && points.length === 0 && (
        <div className="rounded-xl border-2 border-dashed border-muted p-8 text-center">
          <Navigation className="mx-auto h-10 w-10 text-muted-foreground/50 mb-3" />
          <p className="font-medium text-muted-foreground">No location data found</p>
          <p className="text-xs text-muted-foreground mt-1">
            Select a date range and click &quot;Load Route&quot; to view rider history
          </p>
        </div>
      )}
    </div>
  );
}
