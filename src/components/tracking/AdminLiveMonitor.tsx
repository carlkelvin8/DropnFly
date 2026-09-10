"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Navigation, MapPin, Activity } from "lucide-react";
import { LiveMap } from "@/components/tracking/LiveMap";
import { NAIA_TERMINAL_COORDS } from "@/components/booking/constants";

interface AdminLiveMonitorProps {
  employeeId: string;
  employeeName: string;
  // active tasks where this employee is the rider and pickupStartedAt is set
  tasks: { referenceNumber: string; pickupLocation: string; dropOffLocation: string; pickupStartedAt: string | null }[];
  // snapshot from /api/riders — may be stale, will be refreshed via polling
  initialLat: number | null;
  initialLng: number | null;
  lastUpdate: string | null;
}

function terminalCoords(loc: string): { lat: number; lng: number } | null {
  const terminal = loc.split(" - ")[0].trim();
  return NAIA_TERMINAL_COORDS[terminal] || null;
}

export function AdminLiveMonitor({ employeeId, employeeName, tasks, initialLat, initialLng, lastUpdate }: AdminLiveMonitorProps) {
  const [liveLat, setLiveLat] = useState<number | null>(initialLat);
  const [liveLng, setLiveLng] = useState<number | null>(initialLng);
  const [updatedAt, setUpdatedAt] = useState<string | null>(lastUpdate);
  const [recent, setRecent] = useState<boolean>(() => !!lastUpdate && Date.now() - new Date(lastUpdate).getTime() < 300000);

  useEffect(() => {
    setLiveLat(initialLat);
    setLiveLng(initialLng);
    setUpdatedAt(lastUpdate);
  }, [initialLat, initialLng, lastUpdate]);

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch(`/api/tracking/location/${employeeId}`, { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        if (data.currentLat && data.currentLng) {
          setLiveLat(data.currentLat);
          setLiveLng(data.currentLng);
          setUpdatedAt(data.lastLocationUpdate);
          setRecent(!!data.lastLocationUpdate && Date.now() - new Date(data.lastLocationUpdate).getTime() < 300000);
        }
      } catch {}
    };
    void poll();
    const id = setInterval(poll, 5000);
    return () => { cancelled = true; clearInterval(id); };
  }, [employeeId]);

  // Keep "recent" decaying every 30s
  useEffect(() => {
    const id = setInterval(() => {
      setRecent(!!updatedAt && Date.now() - new Date(updatedAt).getTime() < 300000);
    }, 30000);
    return () => clearInterval(id);
  }, [updatedAt]);

  // Pick the first active task for destination pins (most recent)
  const activeTask = tasks.find((t) => !!t.pickupStartedAt) || tasks[0] || null;
  const pickup = activeTask ? terminalCoords(activeTask.pickupLocation) : null;
  const dropoff = activeTask ? terminalCoords(activeTask.dropOffLocation) : null;

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

  if (!recent) {
    return (
      <Card className="border-amber-200 bg-amber-50/50">
        <CardContent className="p-6 text-center text-sm text-amber-800">
          <p className="font-medium">Waiting for live location…</p>
          <p className="mt-1 text-xs">Employee started <strong>{activeTask.referenceNumber}</strong> but no recent GPS ping (last: {updatedAt ? new Date(updatedAt).toLocaleString("en-PH") : "never"}). Ask the employee to allow Location and keep the app open.</p>
          <p className="mt-3 text-[11px] text-muted-foreground">Customer indicator is also paused until a fresh ping arrives. History audit is available below.</p>
        </CardContent>
      </Card>
    );
  }

  // Live monitoring — real-time dot + dashed route to NAIA terminal pins
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 gap-1">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" /> LIVE
        </Badge>
        <span className="text-xs text-muted-foreground">Monitoring <strong>{employeeName}</strong> → {activeTask.pickupLocation} → {activeTask.dropOffLocation}</span>
        <span className="ml-auto text-[11px] text-muted-foreground">Updated {updatedAt ? new Date(updatedAt).toLocaleTimeString("en-PH") : "—"} • pin varies per booking&apos;s NAIA terminal</span>
        <Button size="sm" variant="outline" asChild><Link href={`/track/map/${activeTask.referenceNumber}`}><Navigation className="mr-1 h-3 w-3" /> Open Full Map</Link></Button>
      </div>
      <LiveMap
        referenceNumber={activeTask.referenceNumber}
        employeeLat={liveLat}
        employeeLng={liveLng}
        employeeName={employeeName}
        pickupLat={pickup?.lat}
        pickupLng={pickup?.lng}
        dropoffLat={dropoff?.lat}
        dropoffLng={dropoff?.lng}
        pickupAddress={activeTask.pickupLocation}
        dropoffAddress={activeTask.dropOffLocation}
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
