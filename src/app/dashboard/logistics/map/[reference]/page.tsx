"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LiveMap } from "@/components/tracking/LiveMap";
import { ArrowLeft, Navigation, MapPin, Users, Activity } from "lucide-react";
import { NAIA_TERMINAL_COORDS } from "@/components/booking/constants";

interface Task {
  id: string;
  referenceNumber: string;
  customer: { name: string };
  pickupLocation: string;
  pickupLat: number | null;
  pickupLng: number | null;
  dropOffLocation: string;
  dropOffLat: number | null;
  dropOffLng: number | null;
  status: string;
  taskType: string;
  rider: { id: string; name: string; vehicleType: string | null; plateNumber: string | null } | null;
  pickupStartedAt: string | null;
}

function terminalCoords(loc: string): { lat: number; lng: number } | null {
  const terminal = loc.split(" - ")[0].trim();
  return NAIA_TERMINAL_COORDS[terminal] || null;
}

function resolveCoords(task: Task | null, which: "pickup" | "dropoff"): { lat: number; lng: number } | null {
  if (!task) return null;
  if (which === "pickup" && task.pickupLat != null && task.pickupLng != null) return { lat: task.pickupLat, lng: task.pickupLng };
  if (which === "dropoff" && task.dropOffLat != null && task.dropOffLng != null) return { lat: task.dropOffLat, lng: task.dropOffLng };
  return terminalCoords(which === "pickup" ? task.pickupLocation : task.dropOffLocation);
}

const STALE_THRESHOLD_MS = 300000;

function formatManilaTime(iso: string | null) {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleTimeString("en-PH", { timeZone: "Asia/Manila" }); } catch { return "—"; }
}

export default function AdminFullMapPage() {
  const { reference } = useParams<{ reference: string }>();
  const router = useRouter();
  const [task, setTask] = useState<Task | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [liveLat, setLiveLat] = useState<number | null>(null);
  const [liveLng, setLiveLng] = useState<number | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [recent, setRecent] = useState(false);

  const riderId = task?.rider?.id || null;
  const started = Boolean(task?.pickupStartedAt);

  useEffect(() => {
    let active = true;
    Promise.all([
      fetch("/api/auth/session").then((r) => r.json()),
      fetch("/api/logistics/tasks", { cache: "no-store" }).then(async (r) => (r.ok ? r.json() : (await r.json().catch(() => ({}))).tasks || [])).catch(() => []),
    ]).then(([sessionData, tasksData]) => {
      if (!active) return;
      const tasks: Task[] = Array.isArray(tasksData) ? tasksData : tasksData?.tasks || [];
      const found = tasks.find((t) => t.referenceNumber.toUpperCase() === reference.toUpperCase()) || null;
      setTask(found);
      setIsAdmin(["ADMIN", "STAFF"].includes(sessionData?.user?.role));
      setNotFound(!found);
    }).finally(() => setLoading(false));
    return () => { active = false; };
  }, [reference]);

  // Live polling of the assigned rider's location (same feed the Admin Live Monitor uses)
  useEffect(() => {
    if (!riderId || !started) return;
    const abort = new AbortController();
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch(`/api/tracking/location/${encodeURIComponent(riderId)}?reference=${encodeURIComponent(reference)}`, { cache: "no-store", signal: abort.signal });
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if ("currentLat" in data) setLiveLat(data.currentLat ?? null);
        if ("currentLng" in data) setLiveLng(data.currentLng ?? null);
        if ("accuracy" in data) setAccuracy(data.accuracy ?? null);
        if ("lastLocationUpdate" in data) {
          setUpdatedAt(data.lastLocationUpdate);
          setRecent(!!data.lastLocationUpdate && Date.now() - new Date(data.lastLocationUpdate).getTime() < STALE_THRESHOLD_MS);
        }
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
      }
    };
    void poll();
    const id = setInterval(poll, 5000);
    return () => { cancelled = true; abort.abort(); clearInterval(id); };
  }, [riderId, reference, started]);

  // Keep the LIVE/STALE badge decaying
  useEffect(() => {
    if (!updatedAt) return;
    const id = setInterval(() => setRecent(!!updatedAt && Date.now() - new Date(updatedAt).getTime() < STALE_THRESHOLD_MS), 30000);
    return () => clearInterval(id);
  }, [updatedAt]);

  const pickup = resolveCoords(task, "pickup");
  const dropoff = resolveCoords(task, "dropoff");

  if (loading) {
    return (
      <div className="flex h-[70vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-lg space-y-4 pt-10">
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">Only admins can view the live Full Map.</div>
        <Button variant="outline" onClick={() => router.push("/dashboard/logistics")}><ArrowLeft className="mr-2 h-4 w-4" /> Back to Logistics</Button>
      </div>
    );
  }

  if (notFound || !task) {
    return (
      <div className="mx-auto max-w-lg space-y-4 pt-10">
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">Booking {reference} was not found or has no active logistics task.</div>
        <Button variant="outline" onClick={() => router.push("/dashboard/logistics")}><ArrowLeft className="mr-2 h-4 w-4" /> Back to Logistics</Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard/logistics")}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Logistics
        </Button>
        <div className="flex items-center gap-2">
          <Navigation className="h-5 w-5 text-emerald-600" />
          <div>
            <p className="text-sm font-bold leading-tight">Full Map — {task.referenceNumber}</p>
            <p className="text-[11px] text-muted-foreground">
              Rider: <span className="font-medium">{task.rider?.name || "Unassigned"}</span> · Booking status: {task.status.replace(/_/g, " ")}
            </p>
          </div>
        </div>
        <span className="ml-auto flex items-center gap-2">
          <Badge variant="outline" className={recent ? "gap-1 border-emerald-200 bg-emerald-50 text-emerald-700" : "gap-1 border-amber-200 bg-amber-50 text-amber-700"}>
            <span className={`h-2 w-2 rounded-full ${recent ? "animate-pulse bg-emerald-500" : "bg-amber-500"}`} />{recent ? "LIVE" : "STALE"}
          </Badge>
          {accuracy != null && (
            <Badge variant="outline" className={accuracy <= 25 ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700"}>
              Accuracy ±{Math.round(accuracy)}m
            </Badge>
          )}
          <span className="text-[11px] text-muted-foreground">GPS {formatManilaTime(updatedAt)}</span>
        </span>
      </div>

      <div className="mx-auto max-w-6xl rounded-xl border bg-background p-2 shadow-sm">
        <LiveMap
          referenceNumber={task.referenceNumber}
          employeeLat={liveLat}
          employeeLng={liveLng}
          employeeName={task.rider?.name ?? undefined}
          employeeVehicleType={task.rider?.vehicleType ?? null}
          employeePlate={task.rider?.plateNumber ?? null}
          pickupLat={pickup?.lat}
          pickupLng={pickup?.lng}
          dropoffLat={dropoff?.lat}
          dropoffLng={dropoff?.lng}
          pickupAddress={task.pickupLocation}
          dropoffAddress={task.dropOffLocation}
          destinationPhase={task.status === "OUT_FOR_DELIVERY" ? "dropoff" : "pickup"}
          containerClassName="h-[calc(100vh-12rem)] min-h-[420px]"
        />
      </div>

      <div className="mx-auto flex max-w-6xl flex-wrap gap-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5" /> Customer: <span className="font-medium text-foreground">{task.customer.name}</span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <MapPin className="h-3.5 w-3.5 text-green-500" /> Pickup: {task.pickupLocation}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <MapPin className="h-3.5 w-3.5 text-red-500" /> Drop-off: {task.dropOffLocation}
        </span>
        <span className="ml-auto inline-flex items-center gap-1.5">
          <Activity className="h-3.5 w-3.5" /> Refreshes every 5s
        </span>
      </div>
    </div>
  );
}
