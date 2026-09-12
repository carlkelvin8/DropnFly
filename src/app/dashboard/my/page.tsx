"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import { useSession } from "next-auth/react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PackageOpen, History, Navigation, MapPin, Phone, Clock, Play, CheckCircle, Camera, Loader2, ArrowRight } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import Image from "next/image";
import { formatDate } from "@/lib/utils";
import { LocationUpdater } from "@/components/tracking/LocationUpdater";
import { LiveMap } from "@/components/tracking/LiveMap";
import { imageFileToDataUrl } from "@/lib/client-image";
import { LOGISTICS_ACTION_META, type LogisticsAction } from "@/lib/logistics-workflow";
import { manilaDateStr } from "@/lib/manila-time";

interface AssignedBooking {
  id: string;
  phase: string;
  booking: {
    id: string;
    referenceNumber: string;
    pickupLocation: string;
    dropOffLocation: string;
    status: string;
    numberOfBags: number;
    checkIn: string;
    checkOut: string | null;
    customer: { name: string };
    baggageTags: { tagNumber: string }[];
  };
}

interface ActivityItem {
  id: string;
  action: string;
  entity: string;
  details: string | null;
  createdAt: string;
}

interface LogisticsTask {
  id: string;
  referenceNumber: string;
  customer: { name: string; email: string; phone: string };
  pickupLocation: string;
  dropOffLocation: string;
  pickupLat: number | null;
  pickupLng: number | null;
  dropOffLat: number | null;
  dropOffLng: number | null;
  status: string;
  taskType: string;
  rider: { id: string; name: string; profilePic: string | null; vehicleType: string | null; plateNumber: string | null } | null;
  isAssignedToMe: boolean;
  createdAt: string;
  checkIn: string;
  checkOut: string | null;
  pickupStartedAt: string | null;
  deliveryArrivedAt: string | null;
  availableActions: LogisticsAction[];
}

export default function TrackingDashboardPage() {
  const { data: session } = useSession();
  const [assignments, setAssignments] = useState<AssignedBooking[]>([]);
  const [activityHistory, setActivityHistory] = useState<ActivityItem[]>([]);
  // Logistics tasks (pending + start tracking) — senior-level: abort, polling, optimistic updates
  const [logisticsTasks, setLogisticsTasks] = useState<LogisticsTask[]>([]);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [activeTask, setActiveTask] = useState<string | null>(null);
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [processingAction, setProcessingAction] = useState(false);
  const [photoProof, setPhotoProof] = useState<string | null>(null);
  const [actionNote, setActionNote] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [locationStatus, setLocationStatus] = useState<"requesting" | "active" | "denied" | "error" | "idle">("idle");
  const handleLocationStatus = useCallback((s: "requesting" | "active" | "denied" | "error") => setLocationStatus(s), []);
  const [myTaskDateFilter, setMyTaskDateFilter] = useState<"today" | "all" | "custom">("today");
  const [myTaskDate, setMyTaskDate] = useState(() => manilaDateStr(new Date()));
  const [myLoc, setMyLoc] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    setPhotoProof(null);
    setActionNote("");
    setActiveAction(null);
  }, [activeTask]);

  const fetchAssignments = useCallback(async (signal?: AbortSignal) => {
    if (!session?.user?.id) return;
    try {
      const res = await fetch(`/api/employees/${session.user.id}`, { signal });
      const data = await res.json();
      if (signal?.aborted) return;
      setAssignments(data.assignedBookings || []);
      setActivityHistory(data.activityHistory || []);
    } catch {}
  }, [session?.user?.id]);

  const fetchLogistics = useCallback(async (signal?: AbortSignal) => {
    try {
      const res = await fetch(`/api/logistics/tasks`, { signal, cache: "no-store" });
      const data = await res.json();
      if (signal?.aborted) return;
      const all: LogisticsTask[] = Array.isArray(data) ? data : [];
      // Employee sees only own pending tasks
      setLogisticsTasks(all.filter((t) => t.isAssignedToMe));
    } catch {
      if (!signal?.aborted) toast.error("Failed to load logistics tasks");
    } finally {
      if (!signal?.aborted) setTasksLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!session?.user?.id) return;
    const abort = new AbortController();
    fetchAssignments(abort.signal);
    fetchLogistics(abort.signal);
    return () => abort.abort();
  }, [session, fetchAssignments, fetchLogistics]);

  // Poll logistics every 30s
  useEffect(() => {
    if (!session?.user?.id) return;
    const id = setInterval(() => {
      const c = new AbortController();
      fetchLogistics(c.signal);
      fetchAssignments(c.signal);
    }, 30000);
    return () => clearInterval(id);
  }, [session, fetchLogistics, fetchAssignments]);

  async function handleLogisticsAction(taskId: string, action: string) {
    setProcessingAction(true);
    try {
      const body: Record<string, unknown> = { action };
      if (actionNote) body.note = actionNote;
      if (photoProof) body.photo = photoProof;
      if (navigator.geolocation) {
        try {
          const pos = await new Promise<GeolocationPosition>((res, rej) =>
            navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: true, timeout: 8000 })
          );
          body.latitude = pos.coords.latitude;
          body.longitude = pos.coords.longitude;
        } catch {
          toast.warning("Location unavailable; continuing without map point.");
        }
      }
      const res = await fetch(`/api/logistics/tasks/${taskId}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Action failed");
      }
      const data = await res.json();
      setLogisticsTasks((prev) => prev.map((t) => t.id === taskId ? {
        ...t,
        status: data.status,
        pickupStartedAt: data.pickupStartedAt,
        deliveryArrivedAt: data.deliveryArrivedAt,
        taskType: data.taskType,
        availableActions: data.availableActions,
      } : t));
      toast.success(`Action completed — ${action}`);
      setActiveTask(null); setActiveAction(null); setPhotoProof(null); setActionNote("");
      // Refresh assignments as well
      fetchAssignments();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to process action");
    } finally {
      setProcessingAction(false);
    }
  }

  const pickup = assignments.filter((a) => a.phase === "PICKUP");
  const dropoff = assignments.filter((a) => a.phase !== "PICKUP");

  const tags = (a: AssignedBooking) =>
    a.booking.baggageTags.map((t) => t.tagNumber).join(", ") || "—";

  const renderTable = (rows: AssignedBooking[], colSpan: number) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Reference</TableHead>
          <TableHead>Customer</TableHead>
          <TableHead>Baggage Tag</TableHead>
          <TableHead>Pickup</TableHead>
          <TableHead>Drop-off</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((a) => (
          <TableRow key={a.id}>
            <TableCell className="font-mono text-xs">
              {a.booking.referenceNumber}
            </TableCell>
            <TableCell className="font-medium">
              {a.booking.customer.name}
            </TableCell>
            <TableCell className="font-mono text-xs">
              {tags(a)}
            </TableCell>
            <TableCell className="max-w-[150px] truncate">
              {a.booking.pickupLocation}
            </TableCell>
            <TableCell className="max-w-[150px] truncate">
              {a.booking.dropOffLocation}
            </TableCell>
            <TableCell>
              <Badge variant="secondary">
                {a.booking.status.replace("_", " ")}
              </Badge>
            </TableCell>
            <TableCell className="text-right">
              <Button variant="ghost" size="sm" asChild>
                <Link href={`/dashboard/bookings/${a.booking.id}`}>
                  View
                </Link>
              </Button>
            </TableCell>
          </TableRow>
        ))}
        {rows.length === 0 && (
          <TableRow>
            <TableCell colSpan={colSpan} className="text-center text-muted-foreground">
              No bookings assigned to you yet
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );

  const STATUS_LABELS: Record<string, string> = {
    CONFIRMED: "Ready for Pickup",
    RECEIVED: "Picked Up",
    IN_STORAGE: "In Storage",
    OUT_FOR_DELIVERY: "Out for Delivery",
  };
  const filteredMyTasks = logisticsTasks.filter((t) => {
    const d = manilaDateStr(t.checkIn || t.createdAt);
    const todayStr = manilaDateStr(new Date());
    if (myTaskDateFilter === "today") return d === todayStr;
    if (myTaskDateFilter === "custom") return d === myTaskDate;
    return true;
  });
  const trackedTask = [...logisticsTasks]
    .filter((task) => Boolean(task.pickupStartedAt))
    .sort((a, b) => new Date(b.pickupStartedAt as string).getTime() - new Date(a.pickupStartedAt as string).getTime())[0] || null;

  const quickStartAction = (task: LogisticsTask) =>
    task.availableActions.find((action) => action === "start-pickup" || action === "start-delivery");

  // Employee sees their own live dot on the guide map inside this page (kept
  // separate from the public customer tracker) by polling their booking location.
  const trackedReference = trackedTask?.referenceNumber;
  useEffect(() => {
    if (!trackedReference || !session?.user?.id) return;
    let active = true;
    const poll = async () => {
      try {
        const res = await fetch(`/api/tracking/location/${session.user.id}?reference=${encodeURIComponent(trackedReference)}`, { cache: "no-store" });
        if (!res.ok) return;
        const loc = await res.json();
        if (active && loc.currentLat != null && loc.currentLng != null) {
          setMyLoc({ lat: Number(loc.currentLat), lng: Number(loc.currentLng) });
        }
      } catch {}
    };
    void poll();
    const id = setInterval(poll, 5000);
    return () => { active = false; clearInterval(id); };
  }, [trackedReference, session?.user?.id]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">My Dashboard</h1>
        <Badge variant="outline" className="text-xs">{logisticsTasks.length} pending logistic task{logisticsTasks.length !== 1 ? "s" : ""}</Badge>
      </div>

      {trackedTask && <LocationUpdater key={trackedTask.id} enabled bookingId={trackedTask.id} onStatusChange={handleLocationStatus} />}
      {locationStatus !== "idle" && (
        <div className={`rounded-lg border px-3 py-2 text-sm ${locationStatus === "active" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : locationStatus === "requesting" ? "border-blue-200 bg-blue-50 text-blue-800" : "border-amber-200 bg-amber-50 text-amber-800"}`}>
          {locationStatus === "active" ? "Live geolocation is active — customer map is updating." : locationStatus === "requesting" ? "Requesting location access…" : "Enable Location permission for live tracking."}
        </div>
      )}
      {/* Employee live navigation — kept inside the dashboard so the employee tracker is
          separate from the public customer tracker. Only appears once a task is started. */}
      {trackedTask && (
        <Card className="overflow-hidden border-t-2 border-t-emerald-500 shadow-md">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm"><Navigation className="h-4 w-4 text-emerald-600" /> Active Task — Live Navigation</CardTitle>
            <p className="text-xs text-muted-foreground">Your navigation guide. The customer&apos;s public tracker unlocks at the same time and shows your live dot.</p>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <code className="rounded bg-muted px-2 py-0.5 text-xs font-mono font-bold">{trackedTask.referenceNumber}</code>
              <Badge variant="outline" className="text-[10px]">{trackedTask.taskType === "delivery" ? "Delivering" : "Picking Up"} — Guide Active</Badge>
              <span className="flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="h-3 w-3" /> {trackedTask.pickupLocation} → {trackedTask.dropOffLocation}</span>
            </div>
            <LiveMap
              referenceNumber={trackedTask.referenceNumber}
              employeeLat={myLoc?.lat ?? null}
              employeeLng={myLoc?.lng ?? null}
              employeeName={trackedTask.rider?.name ?? undefined}
              employeeVehicleType={trackedTask.rider?.vehicleType ?? null}
              employeePlate={trackedTask.rider?.plateNumber ?? null}
              pickupLat={trackedTask.pickupLat ?? undefined}
              pickupLng={trackedTask.pickupLng ?? undefined}
              dropoffLat={trackedTask.dropOffLat ?? undefined}
              dropoffLng={trackedTask.dropOffLng ?? undefined}
              pickupAddress={trackedTask.pickupLocation}
              dropoffAddress={trackedTask.dropOffLocation}
              customerName={trackedTask.customer.name}
              riderView
              destinationPhase={trackedTask.taskType === "delivery" ? "dropoff" : "pickup"}
            />
          </CardContent>
        </Card>
      )}

      {/* Logistics Pending Tasks — senior-level: complete task lifecycle, per-day filter */}
      <Card className="border-l-4 border-l-blue-500">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Navigation className="h-4 w-4 text-blue-600" />
            Logistics — My Pending Tasks ({(() => {
              const todayStr = manilaDateStr(new Date());
              const filtered = logisticsTasks.filter((t) => {
                const d = manilaDateStr(t.checkIn || t.createdAt);
                if (myTaskDateFilter === "today") return d === todayStr;
                if (myTaskDateFilter === "custom") return d === myTaskDate;
                return true;
              });
              return filtered.length;
            })()} {myTaskDateFilter === "today" ? "today" : myTaskDateFilter === "custom" ? myTaskDate : "all"})
          </CardTitle>
          <p className="text-xs text-muted-foreground">Per-day Active Tasks — pick-up/drop-off to accomplish within that day. Live tracking (employee→customer) only after you tap Start.</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <select value={myTaskDateFilter} onChange={(e) => setMyTaskDateFilter(e.target.value as "today"|"all"|"custom")} className="h-8 rounded-lg border bg-background px-3 text-xs"><option value="today">Today only</option><option value="all">All dates (previous & future)</option><option value="custom">Pick date…</option></select>
            {myTaskDateFilter === "custom" && <input type="date" value={myTaskDate} onChange={(e) => setMyTaskDate(e.target.value)} className="h-8 rounded-lg border bg-background px-3 text-xs" />}
            <span className="text-[11px] text-muted-foreground">{myTaskDateFilter === "today" ? `Today • ${manilaDateStr(new Date())}` : myTaskDateFilter === "custom" ? myTaskDate : "All dates"}</span>
          </div>
        </CardHeader>
        <CardContent>
          {tasksLoading ? (
            <div className="space-y-3">
              {[1,2,3].map((i) => (
                <div key={i} className="animate-pulse space-y-2 rounded-lg border p-4">
                  <div className="h-4 w-1/3 rounded bg-muted" />
                  <div className="h-3 w-2/3 rounded bg-muted" />
                </div>
              ))}
            </div>
          ) : filteredMyTasks.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              <PackageOpen className="mx-auto mb-2 h-8 w-8 opacity-50" />
              <p>No tasks for {myTaskDateFilter === "today" ? "today" : myTaskDateFilter === "custom" ? myTaskDate : "this filter"}.</p>
              <p className="text-xs">Switch to All dates to see previous & future taskings.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredMyTasks.map((task) => (
                <div key={task.id} className={`rounded-lg border p-4 ${task.taskType === "delivery" ? "border-l-4 border-l-orange-500" : "border-l-4 border-l-blue-500"} bg-card`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <code className="rounded bg-muted px-2 py-0.5 text-xs font-mono font-bold">{task.referenceNumber}</code>
                        <Badge className="text-[10px]">{STATUS_LABELS[task.status] || task.status.replace("_"," ")}</Badge>
                        <Badge variant="outline" className="text-[10px] capitalize">{task.taskType}</Badge>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <span className="truncate">{task.pickupLocation}</span>
                        <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground" />
                        <span className="truncate">{task.dropOffLocation}</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{task.customer.phone}</span>
                        <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{formatDate(task.createdAt)}</span>
                      </div>

                      <div className="pt-2">
                        {activeTask === task.id ? (
                          <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
                            <div className="flex gap-2">
                              {task.availableActions.map((action) => (
                                <Button key={action} size="sm" variant={activeAction === action ? "default" : "outline"} onClick={() => setActiveAction(action)} className="flex-1 text-xs">
                                  {LOGISTICS_ACTION_META[action].label}
                                </Button>
                              ))}
                            </div>
                            <div className="flex gap-2">
                              {photoProof ? (
                                <div className="relative">
                                  <Image unoptimized width={48} height={48} src={photoProof} alt="Proof" className="h-12 w-12 rounded object-cover" />
                                  <button onClick={() => setPhotoProof(null)} className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-xs text-white">×</button>
                                </div>
                              ) : (
                                <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}><Camera className="mr-1 h-3 w-3" /> Photo</Button>
                              )}
                              <input ref={fileInputRef} type="file" accept="image/*" capture="environment" onChange={async (e) => { const f=e.target.files?.[0]; if(f){ try{ setPhotoProof(await imageFileToDataUrl(f)); }catch{ toast.error("Could not read photo"); }}}} className="hidden" />
                              <input value={actionNote} onChange={(e)=> setActionNote(e.target.value)} placeholder="Note (optional)" className="flex h-8 flex-1 rounded-md border bg-background px-2 text-xs" />
                            </div>
                            <div className="flex gap-2">
                              <Button size="sm" onClick={() => activeAction && handleLogisticsAction(task.id, activeAction)} disabled={processingAction || !activeAction}>
                                {processingAction ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <CheckCircle className="h-3 w-3 mr-1" />} Confirm
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => { setActiveTask(null); setActiveAction(null); setPhotoProof(null); setActionNote(""); }}>Cancel</Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {quickStartAction(task) ? (
                              <Button
                                size="sm"
                                onClick={() => handleLogisticsAction(task.id, quickStartAction(task) as LogisticsAction)}
                                disabled={processingAction}
                                className="bg-emerald-600 text-white hover:bg-emerald-700"
                              >
                                <Play className="mr-1 h-3 w-3" />
                                Start Tracking — {quickStartAction(task) === "start-delivery" ? "Drop-off" : "Pick-up"}
                              </Button>
                            ) : (
                              <Button size="sm" onClick={() => setActiveTask(task.id)}>
                                <Play className="mr-1 h-3 w-3" /> Task Actions
                              </Button>
                            )}
                            <Button size="sm" variant="outline" asChild><Link href={`/dashboard/bookings/${task.id}`}><PackageOpen className="mr-1 h-3 w-3" /> Details</Link></Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <PackageOpen className="h-4 w-4 text-blue-600" />
            Pickup Bookings ({pickup.length})
          </CardTitle>
        </CardHeader>
        <CardContent>{renderTable(pickup, 7)}</CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <PackageOpen className="h-4 w-4 text-blue-600" />
            Drop-off Bookings ({dropoff.length})
          </CardTitle>
        </CardHeader>
        <CardContent>{renderTable(dropoff, 7)}</CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="h-4 w-4 text-blue-600" />
            My Activity History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {activityHistory.length > 0 ? (
            <div className="space-y-2">
              {activityHistory.map((h) => (
                <div
                  key={h.id}
                  className="flex items-center justify-between rounded-lg border bg-card px-3 py-2 text-sm"
                >
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                      {h.action}
                    </span>
                    <span className="text-xs">{h.details || h.entity}</span>
                  </div>
                  <span className="text-[11px] text-muted-foreground">
                    {new Date(h.createdAt).toLocaleString("en-PH")}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No activity recorded yet
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
