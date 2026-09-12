"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Navigation, Activity } from "lucide-react";
import { LiveMap } from "@/components/tracking/LiveMap";
import { NAIA_TERMINAL_COORDS } from "@/components/booking/constants";

interface AdminLiveMonitorProps {
  employeeId: string;
  employeeName: string;
  // active tasks where this employee is the rider and pickupStartedAt is set
  tasks: { referenceNumber: string; pickupLocation: string; dropOffLocation: string; pickupStartedAt: string | null; status: string; pickupLat?: number | null; pickupLng?: number | null; dropOffLat?: number | null; dropOffLng?: number | null; riderVehicleType?: string | null; riderPlate?: string | null }[];
  // snapshot from /api/riders — may be stale, will be refreshed via polling
  initialLat: number | null;
  initialLng: number | null;
  lastUpdate: string | null;
}

function terminalCoords(loc: string): { lat: number; lng: number } | null {
  const terminal = loc.split(" - ")[0].trim();
  return NAIA_TERMINAL_COORDS[terminal] || null;
}

function resolveCoords(task: { pickupLocation: string; dropOffLocation: string; pickupLat?: number | null; pickupLng?: number | null; dropOffLat?: number | null; dropOffLng?: number | null } | null, which: "pickup" | "dropoff"): { lat: number; lng: number } | null {
  if (!task) return null;
  if (which === "pickup" && task.pickupLat != null && task.pickupLng != null) return { lat: task.pickupLat, lng: task.pickupLng };
  if (which === "dropoff" && task.dropOffLat != null && task.dropOffLng != null) return { lat: task.dropOffLat, lng: task.dropOffLng };
  return terminalCoords(which === "pickup" ? task.pickupLocation : task.dropOffLocation);
}

const STALE_THRESHOLD_MS = 300000; // 5 min — matches customer "Moving" threshold

function formatManilaTime(iso: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleTimeString("en-PH", { timeZone: "Asia/Manila" });
  } catch { return new Date(iso).toLocaleString("en-PH"); }
}
function formatManilaDateTime(iso: string | null) {
  if (!iso) return "never";
  try {
    return new Date(iso).toLocaleString("en-PH", { timeZone: "Asia/Manila" });
  } catch { return new Date(iso).toLocaleString("en-PH"); }
}

export function AdminLiveMonitor({ employeeId, employeeName, tasks, initialLat, initialLng, lastUpdate }: AdminLiveMonitorProps) {
  const [liveLat, setLiveLat] = useState<number | null>(initialLat);
  const [liveLng, setLiveLng] = useState<number | null>(initialLng);
  const [updatedAt, setUpdatedAt] = useState<string | null>(lastUpdate);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [recent, setRecent] = useState<boolean>(() => !!lastUpdate && Date.now() - new Date(lastUpdate).getTime() < STALE_THRESHOLD_MS);
  const [pollError, setPollError] = useState<string | null>(null);
  const [selectedRef, setSelectedRef] = useState<string | null>(null);
  // Default to most recent started; allow explicit selector when multiple active tasks
  const sortedActive = [...tasks]
    .filter((t) => t.pickupStartedAt != null)
    .sort((a, b) => new Date(b.pickupStartedAt as string).getTime() - new Date(a.pickupStartedAt as string).getTime());
  const activeTask = (selectedRef ? tasks.find((t) => t.referenceNumber === selectedRef) : null) || sortedActive[0] || tasks.find((t) => t.pickupStartedAt != null) || tasks[0] || null;
  const activeReference = activeTask?.referenceNumber;

  useEffect(() => {
    const abort = new AbortController();
    let cancelled = false;
    const poll = async () => {
      try {
        const query = activeReference ? `?reference=${encodeURIComponent(activeReference)}` : "";
        const res = await fetch(`/api/tracking/location/${encodeURIComponent(employeeId)}${query}`, { cache: "no-store", signal: abort.signal });
        if (!res.ok) {
          if (res.status !== 404) setPollError(`Poll failed ${res.status}`);
          return;
        }
        setPollError(null);
        const data = await res.json();
        if (cancelled) return;
        if ("currentLat" in data) setLiveLat(data.currentLat ?? null);
        if ("currentLng" in data) setLiveLng(data.currentLng ?? null);
        if ("accuracy" in data) setAccuracy(data.accuracy ?? null);
        if ("lastLocationUpdate" in data) {
          setUpdatedAt(data.lastLocationUpdate);
          setRecent(!!data.lastLocationUpdate && Date.now() - new Date(data.lastLocationUpdate).getTime() < STALE_THRESHOLD_MS);
        }
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        setPollError("Network error");
      }
    };
    void poll();
    const id = setInterval(poll, 5000);
    return () => { cancelled = true; abort.abort(); clearInterval(id); };
  }, [employeeId, activeReference]);

  // Keep "recent" decaying every 30s
  useEffect(() => {
    const id = setInterval(() => {
      setRecent(!!updatedAt && Date.now() - new Date(updatedAt).getTime() < STALE_THRESHOLD_MS);
    }, 30000);
    return () => clearInterval(id);
  }, [updatedAt]);

  // Pick the first active task for destination pins (most recent) — prefer exact coords, fallback to terminal
  const pickup = resolveCoords(activeTask, "pickup");
  const dropoff = resolveCoords(activeTask, "dropoff");
  // If employee not yet started anything, don't render live map — caller handles idle case

  if (!activeTask?.pickupStartedAt) {
    return (
      <Card className="border-dashed">
        <CardContent className="p-8 text-center text-sm text-muted-foreground">
          <Navigation className="mx-auto mb-2 h-8 w-8 opacity-30" />
          <p className="font-medium">No active tracking — {employeeName} hasn&apos;t tapped Start Pickup/Delivery yet</p>
          <p className="mt-1 text-xs">Admin monitoring becomes live only after the employee taps <strong>Start Pickup</strong> or <strong>Start Delivery</strong> on one of its assigned transactions. That sets <code className="rounded bg-muted px-1">pickupStartedAt</code> and enables the employee&apos;s <code>LocationUpdater</code>.</p>
        </CardContent>
      </Card>
    );
  }

  // Live monitoring — real-time dot + dashed route to NAIA terminal pins
  // Always show map; overlay staleness warning instead of hiding map
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className={recent ? "bg-emerald-50 text-emerald-700 border-emerald-200 gap-1" : "bg-amber-50 text-amber-700 border-amber-200 gap-1"}>
          <span className={`h-2 w-2 rounded-full ${recent ? "bg-emerald-500 animate-pulse" : "bg-amber-500"}`} /> {recent ? "LIVE" : "STALE"}
        </Badge>
        <span className="text-xs text-muted-foreground">Monitoring <strong>{employeeName}</strong> → {activeTask.pickupLocation} → {activeTask.dropOffLocation}</span>
        <span className="ml-auto text-[11px] text-muted-foreground">Updated {formatManilaTime(updatedAt)} • pin varies per booking&apos;s NAIA terminal</span>
        {accuracy != null && (
          <Badge variant="outline" className={accuracy <= 25 ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700"}>
            GPS ±{Math.round(accuracy)}m
          </Badge>
        )}
        <Button size="sm" variant="outline" asChild><Link href={`/dashboard/logistics/map/${activeTask.referenceNumber}`}><Navigation className="mr-1 h-3 w-3" /> Open Full Map</Link></Button>
      </div>
      {tasks.length > 1 && (
        <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-xs">
          <span className="font-medium">Active booking:</span>
          <select value={activeReference} onChange={(e) => setSelectedRef(e.target.value)} className="flex-1 rounded-md border bg-background px-2 py-1 text-xs">
            {sortedActive.map((t) => (
              <option key={t.referenceNumber} value={t.referenceNumber}>{t.referenceNumber} — {t.pickupLocation} → {t.dropOffLocation}</option>
            ))}
          </select>
          <span className="text-[11px] text-muted-foreground">Live map follows this booking&apos;s exact pin</span>
        </div>
      )}
      {pollError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">Live poll error: {pollError} — retrying every 5s</div>
      )}
      {!recent && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <span className="font-medium">Stale location — last ping {formatManilaDateTime(updatedAt)}.</span>{" "}
          Map below still shows last known dot + exact/bay pin, but live dot is paused until the employee&apos;s device sends a fresh GPS ping (keep app open + Location allowed). History audit is available below.
        </div>
      )}
      <LiveMap
        referenceNumber={activeTask.referenceNumber}
        employeeLat={liveLat}
        employeeLng={liveLng}
        employeeName={employeeName}
        employeeVehicleType={activeTask.riderVehicleType ?? null}
        employeePlate={activeTask.riderPlate ?? null}
        pickupLat={pickup?.lat}
        pickupLng={pickup?.lng}
        dropoffLat={dropoff?.lat}
        dropoffLng={dropoff?.lng}
        pickupAddress={activeTask.pickupLocation}
        dropoffAddress={activeTask.dropOffLocation}
        destinationPhase={activeTask.status === "OUT_FOR_DELIVERY" ? "dropoff" : "pickup"}
      />
      <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-green-500" /> Pickup: {activeTask.pickupLocation}</span>
        <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-500" /> Drop-off: {activeTask.dropOffLocation}</span>
        <span className="ml-auto inline-flex items-center gap-1"><Activity className="h-3 w-3" /> Employee location streams via LocationUpdater (watchPosition → POST /api/tracking/location every move)</span>
      </div>
      {tasks.length > 1 && (
        <p className="text-[11px] text-muted-foreground">This employee has {tasks.length} started transactions — map above shows the most recent ({activeTask.referenceNumber}). Use the Active Tasks list to inspect others.</p>
      )}
    </div>
  );
}
