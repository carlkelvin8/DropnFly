"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Navigation, MapPin, Phone, User, Bike, Camera, CheckCircle,
  Loader2, ArrowRight, Package, Clock, Play,
  Users, Activity,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { formatDate, roleLabel } from "@/lib/utils";
import { toast } from "sonner";
import { LocationUpdater } from "@/components/tracking/LocationUpdater";
import { AdminLiveMonitor } from "@/components/tracking/AdminLiveMonitor";
import { LiveMap } from "@/components/tracking/LiveMap";
import { Pagination } from "@/components/ui/pagination";
import { imageFileToDataUrl } from "@/lib/client-image";
import { LOGISTICS_ACTION_META, type LogisticsAction } from "@/lib/logistics-workflow";
import { manilaDateStr } from "@/lib/manila-time";

interface Employee {
  id: string;
  name: string;
  email: string;
  role: string;
  currentLat: number | null;
  currentLng: number | null;
  lastLocationUpdate: string | null;
}

interface Task {
  id: string;
  referenceNumber: string;
  customer: { name: string; email: string; phone: string };
  pickupLocation: string;
  pickupLat: number | null;
  pickupLng: number | null;
  dropOffLocation: string;
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

const STATUS_LABELS: Record<string, string> = {
  CONFIRMED: "Ready for Pickup",
  RECEIVED: "Picked Up",
  IN_STORAGE: "In Storage",
  OUT_FOR_DELIVERY: "Out for Delivery",
};

export default function LogisticsPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTask, setActiveTask] = useState<string | null>(null);
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [processingAction, setProcessingAction] = useState(false);
  const [photoProof, setPhotoProof] = useState<string | null>(null);
  const [actionNote, setActionNote] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [userRole, setUserRole] = useState<string>("");
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);
  const [myLoc, setMyLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [myAccuracy, setMyAccuracy] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"tasks" | "monitoring">("tasks");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmpId, setSelectedEmpId] = useState<string>("");
  const [now, setNow] = useState(() => Date.now());
  const [taskSearch, setTaskSearch] = useState("");
  const [taskTypeFilter, setTaskTypeFilter] = useState("all");
  const [taskDateFilter, setTaskDateFilter] = useState<"today" | "all" | "custom">("today");
  const [taskDate, setTaskDate] = useState(() => manilaDateStr(new Date()));
  const [taskPage, setTaskPage] = useState(1);
  const [locationStatus, setLocationStatus] = useState<"requesting" | "active" | "denied" | "error" | "idle">("idle");
  const handleLocationStatus = useCallback((status: "requesting" | "active" | "denied" | "error") => setLocationStatus(status), []);
  const [selectedTrackedId, setSelectedTrackedId] = useState<string | null>(null);
  const [employeeTaskFilter, setEmployeeTaskFilter] = useState<"all" | "pickup" | "delivery">("all");

  function openTaskActions(taskId: string) {
    setPhotoProof(null);
    setActionNote("");
    setActiveAction(null);
    setActiveTask(taskId);
  }

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    fetch("/api/riders?includeLocation=true", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        const emps = Array.isArray(data) ? data : data.employees || [];
        setEmployees(emps);
        if (emps.length > 0) setSelectedEmpId(emps[0].id);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    Promise.all([
      fetch("/api/logistics/tasks").then(async (r) => {
        if (!r.ok) {
          const e = await r.json().catch(() => ({}));
          throw new Error(e.error || `Tasks ${r.status}`);
        }
        const j = await r.json();
        return Array.isArray(j) ? j : j.tasks || [];
      }),
      fetch("/api/auth/session").then((r) => r.json()),
    ]).then(([tasksData, sessionData]) => {
      setTasks(Array.isArray(tasksData) ? tasksData : []);
      setUserRole(sessionData?.user?.role || "");
      setSessionUserId(sessionData?.user?.id || null);
    }).catch((e) => {
      console.error("[Logistics] load failed:", e);
      toast.error(e instanceof Error ? e.message : "Failed to load tasks");
      setTasks([]);
    })
      .finally(() => setLoading(false));
  }, []);

  const isAdmin = userRole === "ADMIN" || userRole === "STAFF";

  async function handleAction(taskId: string, action: string) {
    setProcessingAction(true);
    try {
      const body: Record<string, unknown> = { action };
      if (actionNote) body.note = actionNote;
      if (photoProof) body.photo = photoProof;
      if (navigator.geolocation) {
        try {
          const position = await new Promise<GeolocationPosition>((resolve, reject) =>
            navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 8000 })
          );
          body.latitude = position.coords.latitude;
          body.longitude = position.coords.longitude;
        } catch {
          toast.warning("Location permission was unavailable; the task action will continue without a map point.");
        }
      }

      const res = await fetch(`/api/logistics/tasks/${taskId}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.error || "Action failed");
      }
      const data = await res.json();
      setTasks((prev) => prev.map((t) => t.id === taskId ? {
        ...t,
        status: data.status,
        pickupStartedAt: data.pickupStartedAt,
        deliveryArrivedAt: data.deliveryArrivedAt,
        taskType: data.taskType,
        availableActions: data.availableActions,
      } : t));
      toast.success(`Action completed — ${action}`);
      setActiveTask(null);
      setActiveAction(null);
      setPhotoProof(null);
      setActionNote("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to process action");
    }
    setProcessingAction(false);
  }

  const roleTasks = isAdmin ? tasks : tasks.filter((t) => t.isAssignedToMe);
  const filteredTasks = roleTasks.filter((task) => {
    const query = taskSearch.toLowerCase();
    const matchesSearch = !query || `${task.referenceNumber} ${task.customer.name} ${task.rider?.name || ""}`.toLowerCase().includes(query);
    const matchesType = taskTypeFilter === "all" || task.taskType === taskTypeFilter;
    // Active Task is per-day (today) by default — Manila date of checkIn
    const taskDay = manilaDateStr(task.checkIn || task.createdAt);
    const todayStr = manilaDateStr(new Date());
    const matchesDate = taskDateFilter === "all" ? true : taskDateFilter === "today" ? taskDay === todayStr : taskDay === taskDate;
    return matchesSearch && matchesType && matchesDate;
  });
  const taskPageSize = 5;
  const taskTotalPages = Math.max(1, Math.ceil(filteredTasks.length / taskPageSize));
  const currentTaskPage = Math.min(taskPage, taskTotalPages);
  const paginatedTasks = filteredTasks.slice((currentTaskPage - 1) * taskPageSize, currentTaskPage * taskPageSize);
  // Explicit selector for GPS: when multiple started tasks, employee chooses which booking to publish GPS for
  const startedForMe = [...roleTasks]
    .filter((task) => task.isAssignedToMe && Boolean(task.pickupStartedAt))
    .sort((a, b) => new Date(b.pickupStartedAt as string).getTime() - new Date(a.pickupStartedAt as string).getTime());
  const trackedTask = (selectedTrackedId ? startedForMe.find((t) => t.id === selectedTrackedId) : null) || startedForMe[0] || null;

  const showLocationUpdater = Boolean(trackedTask) && !isAdmin;

  // One-tap Start button: shown on assigned task cards while tracking has not begun.
  const quickStartAction = (task: Task) =>
    task.isAssignedToMe ? task.availableActions.find((a) => a === "start-pickup" || a === "start-delivery") : undefined;

  const employeeTasks = roleTasks.filter((task) =>
    employeeTaskFilter === "all" ? true : task.taskType === employeeTaskFilter
  );
  const employeePending = roleTasks.filter((task) => !task.pickupStartedAt).length;
  const employeeInProgress = roleTasks.filter((task) => Boolean(task.pickupStartedAt)).length;
  const employeePickup = roleTasks.filter((task) => task.taskType === "pickup").length;
  const employeeDelivery = roleTasks.filter((task) => task.taskType === "delivery").length;

  // Employee sees their own live dot on the guide map inside this page (kept
  // separate from the public customer tracker) by polling their booking location.
  const activeReference = trackedTask?.referenceNumber;
  useEffect(() => {
    if (!activeReference || !sessionUserId || isAdmin) return;
    let active = true;
    const poll = async () => {
      try {
        const res = await fetch(`/api/tracking/location/${sessionUserId}?reference=${encodeURIComponent(activeReference)}`, { cache: "no-store" });
        if (!res.ok) return;
        const loc = await res.json();
        if (active && loc.currentLat != null && loc.currentLng != null) {
          setMyLoc({ lat: Number(loc.currentLat), lng: Number(loc.currentLng) });
          setMyAccuracy(loc.accuracy == null ? null : Number(loc.accuracy));
        }
      } catch {}
    };
    void poll();
    const id = setInterval(poll, 5000);
    return () => { active = false; clearInterval(id); };
  }, [activeReference, sessionUserId, isAdmin]);

  if (!loading && !isAdmin) {
    return (
      <div className="mx-auto max-w-6xl space-y-5">
        {showLocationUpdater && trackedTask && (
          <LocationUpdater key={trackedTask.id} enabled bookingId={trackedTask.id} onStatusChange={handleLocationStatus} />
        )}

        <section className="overflow-hidden rounded-2xl border bg-card shadow-sm">
          <div className="border-b px-5 py-5 sm:px-6">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-100 text-orange-600">
                <Package className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-xl font-bold">My Logistics Tasks</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Assigned pick-up and drop-off tasks. Tap Start to share live tracking with the customer.
                </p>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { value: employeePending, label: "Pending", tone: "bg-sky-50 text-sky-900" },
                { value: employeeInProgress, label: "In Progress", tone: "bg-amber-50 text-amber-900" },
                { value: employeePickup, label: "Pick-up", tone: "bg-blue-50 text-blue-900" },
                { value: roleTasks.length, label: "Total Tasks", tone: "bg-emerald-50 text-emerald-900" },
              ].map((item) => (
                <div key={item.label} className={`rounded-xl px-4 py-3 text-center ${item.tone}`}>
                  <p className="text-2xl font-bold leading-none">{item.value}</p>
                  <p className="mt-1.5 text-[11px] font-medium opacity-70">{item.label}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="p-4 sm:p-6">
            <div className="mb-4 flex flex-wrap gap-2">
              {([
                ["all", "All Tasks", roleTasks.length],
                ["pickup", "To Pick-up", employeePickup],
                ["delivery", "To Drop-off", employeeDelivery],
              ] as const).map(([value, label, count]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setEmployeeTaskFilter(value)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                    employeeTaskFilter === value
                      ? "border-orange-500 bg-orange-500 text-white"
                      : "bg-background text-muted-foreground hover:border-orange-300 hover:text-foreground"
                  }`}
                >
                  {label} <span className="ml-1 opacity-80">{count}</span>
                </button>
              ))}
            </div>

            {locationStatus !== "idle" && (
              <div className={`mb-4 rounded-xl border px-4 py-3 text-xs ${locationStatus === "active" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : locationStatus === "requesting" ? "border-blue-200 bg-blue-50 text-blue-800" : "border-amber-200 bg-amber-50 text-amber-800"}`}>
                {locationStatus === "active" ? `Live GPS is active for ${trackedTask?.referenceNumber || "this task"}.` : locationStatus === "requesting" ? "Requesting location permission…" : "Enable location permission to update the customer map."}
              </div>
            )}

            {trackedTask && (
              <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
                  </span>
                  <span className="font-semibold">Employee tracking active</span>
                  <code className="rounded bg-white/70 px-2 py-0.5 text-xs">{trackedTask.referenceNumber}</code>
                </div>
                <div className="mt-2 grid gap-2 text-xs sm:grid-cols-3">
                  <div><span className="text-emerald-700/70">Latitude</span><p className="font-mono font-semibold">{myLoc ? myLoc.lat.toFixed(6) : "Waiting for GPS…"}</p></div>
                  <div><span className="text-emerald-700/70">Longitude</span><p className="font-mono font-semibold">{myLoc ? myLoc.lng.toFixed(6) : "Waiting for GPS…"}</p></div>
                  <div><span className="text-emerald-700/70">Accuracy</span><p className="font-semibold">{myAccuracy == null ? "Waiting for GPS…" : `±${Math.round(myAccuracy)} meters`}</p></div>
                </div>
                <p className="mt-2 text-[11px] text-emerald-700">Keep this page open and Location permission enabled. Admin Geo Monitoring receives the same booking-scoped GPS ping.</p>
              </div>
            )}

            {employeeTasks.length === 0 ? (
              <div className="rounded-xl border border-dashed py-14 text-center text-muted-foreground">
                <Package className="mx-auto mb-2 h-8 w-8 opacity-40" />
                <p className="text-sm font-medium">No assigned tasks in this section</p>
                <p className="mt-1 text-xs">New tasking will appear here after it is assigned to you.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {employeeTasks.map((task) => {
                  const startAction = quickStartAction(task);
                  const isStarted = Boolean(task.pickupStartedAt);
                  return (
                    <article key={task.id} className="rounded-xl border bg-background p-4 shadow-sm transition-shadow hover:shadow-md">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-sky-100 font-bold text-sky-700">
                              {task.customer.name.trim().charAt(0).toUpperCase() || "C"}
                            </div>
                            <div>
                              <p className="text-sm font-semibold">{task.customer.name}</p>
                              <p className="text-[11px] text-muted-foreground">Assigned task · {formatDate(task.createdAt)}</p>
                            </div>
                            <Badge variant="outline" className="ml-auto text-[10px] capitalize sm:ml-2">
                              {isStarted ? "In Progress" : "Pending"}
                            </Badge>
                            <Badge className={`text-[10px] ${task.taskType === "delivery" ? "bg-violet-100 text-violet-700" : "bg-blue-100 text-blue-700"}`}>
                              {task.taskType === "delivery" ? "TO DROP-OFF" : "TO PICK-UP"}
                            </Badge>
                          </div>

                          <div className="mt-4 grid gap-3 text-xs sm:grid-cols-2">
                            <div>
                              <p className="text-[10px] font-semibold uppercase text-muted-foreground">{task.taskType === "delivery" ? "Drop-off location" : "Pickup address"}</p>
                              <p className="mt-1 flex items-start gap-1.5 font-medium"><MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-orange-500" />{task.taskType === "delivery" ? task.dropOffLocation : task.pickupLocation}</p>
                            </div>
                            <div>
                              <p className="text-[10px] font-semibold uppercase text-muted-foreground">Tracking code</p>
                              <p className="mt-1 font-mono font-semibold">{task.referenceNumber}</p>
                            </div>
                            <div>
                              <p className="text-[10px] font-semibold uppercase text-muted-foreground">Contact</p>
                              <p className="mt-1 flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" />{task.customer.phone}</p>
                            </div>
                            <div>
                              <p className="text-[10px] font-semibold uppercase text-muted-foreground">Vehicle</p>
                              <p className="mt-1 flex items-center gap-1.5"><Bike className="h-3.5 w-3.5" />{task.rider?.vehicleType || "Assigned vehicle"}{task.rider?.plateNumber ? ` · ${task.rider.plateNumber}` : ""}</p>
                            </div>
                          </div>
                        </div>

                        <div className="flex shrink-0 flex-wrap gap-2 sm:w-40 sm:flex-col">
                          {startAction ? (
                            <Button size="sm" onClick={() => { setSelectedTrackedId(task.id); void handleAction(task.id, startAction); }} disabled={processingAction} className="bg-emerald-600 text-white hover:bg-emerald-700">
                              {processingAction ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Play className="mr-1 h-3.5 w-3.5" />}
                              Start Tracking — {startAction === "start-delivery" ? "Drop-off" : "Pick-up"}
                            </Button>
                          ) : (
                            <>
                              {isStarted && (
                                <Button size="sm" variant="outline" disabled className="border-emerald-200 bg-emerald-50 text-emerald-700 opacity-100">
                                  <Activity className="mr-1 h-3.5 w-3.5" /> Tracking Active
                                </Button>
                              )}
                              <Button size="sm" onClick={() => openTaskActions(task.id)}>
                                <CheckCircle className="mr-1 h-3.5 w-3.5" /> Update Task
                              </Button>
                            </>
                          )}
                          <Button size="sm" variant="outline" asChild>
                            <Link href={`/dashboard/bookings/${task.id}`}>View Details</Link>
                          </Button>
                        </div>
                      </div>

                      {activeTask === task.id && !startAction && (
                        <div className="mt-4 space-y-3 rounded-xl border bg-muted/30 p-3">
                          <div className="flex flex-wrap gap-2">
                            {task.availableActions.map((action) => (
                              <Button key={action} size="sm" variant={activeAction === action ? "default" : "outline"} onClick={() => setActiveAction(action)}>
                                {LOGISTICS_ACTION_META[action].label}
                              </Button>
                            ))}
                          </div>
                          <div className="flex flex-col gap-2 sm:flex-row">
                            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}><Camera className="mr-1 h-3.5 w-3.5" />{photoProof ? "Change Photo" : "Add Photo"}</Button>
                            <input ref={fileInputRef} type="file" accept="image/*" capture="environment" onChange={async (e) => { const file = e.target.files?.[0]; if (file) { try { setPhotoProof(await imageFileToDataUrl(file)); } catch { toast.error("Could not read photo"); } } }} className="hidden" />
                            <input value={actionNote} onChange={(e) => setActionNote(e.target.value)} placeholder="Note (optional)" className="h-9 flex-1 rounded-md border bg-background px-3 text-xs" />
                          </div>
                          <div className="flex gap-2">
                            <Button size="sm" disabled={!activeAction || processingAction} onClick={() => activeAction && handleAction(task.id, activeAction)}>
                              {processingAction && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}Confirm Update
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => { setActiveTask(null); setActiveAction(null); setPhotoProof(null); setActionNote(""); }}>Cancel</Button>
                          </div>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {showLocationUpdater && trackedTask && <LocationUpdater key={trackedTask.id} enabled bookingId={trackedTask.id} onStatusChange={handleLocationStatus} />}
      {startedForMe.length > 1 && !isAdmin && (
        <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-xs">
          <span className="font-medium whitespace-nowrap">GPS booking:</span>
          <select value={trackedTask?.id || ""} onChange={(e) => setSelectedTrackedId(e.target.value)} className="flex-1 rounded-md border bg-background px-2 py-1 text-xs">
            {startedForMe.map((t) => (
              <option key={t.id} value={t.id}>{t.referenceNumber}</option>
            ))}
          </select>
        </div>
      )}
      {locationStatus !== "idle" && (
        <div className={`rounded-lg border px-3 py-2 text-xs ${locationStatus === "active" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : locationStatus === "requesting" ? "border-blue-200 bg-blue-50 text-blue-800" : "border-amber-200 bg-amber-50 text-amber-800"}`}>
          {locationStatus === "active" ? `Live GPS active — updating customer map (${trackedTask?.referenceNumber || "booking"}).` : locationStatus === "requesting" ? "Requesting location access…" : "Enable browser location permission for live tracking."}
        </div>
      )}
      {/* Employee live navigation — kept inside the dashboard so the employee tracker is
          separate from the public customer tracker. Only appears when this employee has
          an assigned task that was started (Start Pickup / Start Delivery). */}
      {trackedTask && !isAdmin && (
        <Card className="overflow-hidden border-t-2 border-t-emerald-500 shadow-md">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Navigation className="h-4 w-4 text-emerald-600" /> Active Task—Live Navigation
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <code className="rounded bg-muted px-2 py-0.5 text-xs font-mono font-bold">{trackedTask.referenceNumber}</code>
              <Badge variant="outline" className="text-[10px]">{trackedTask.taskType === "delivery" ? "Delivering" : "Picking Up"} — Guide Active</Badge>
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="h-3 w-3" /> {trackedTask.pickupLocation} → {trackedTask.dropOffLocation}
              </span>
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Logistics & Routes</h1>
          <p className="text-sm text-muted-foreground">
            {isAdmin ? "Live monitoring of employee pickups and deliveries" : "My assigned pickup/delivery tasks"}
          </p>
        </div>
        {activeTab === "tasks" && (
          <Badge variant="outline" className="text-xs">
            {filteredTasks.length} active task{filteredTasks.length !== 1 ? "s" : ""}
          </Badge>
        )}
      </div>

      {isAdmin && tasks.filter((t) => !t.rider).length > 0 && (
        <Card className="border-amber-300 bg-amber-50">
          <CardContent className="p-3 text-xs text-amber-900">
            {tasks.filter((t) => !t.rider).length} booking{tasks.filter((t) => !t.rider).length !== 1 ? "s" : ""} need a rider — assign from <code className="rounded bg-white px-1">Bookings → Assign Rider</code>.
          </CardContent>
        </Card>
      )}
      {/* Tabs: Tasks | Live Monitoring — only for admin; employees just see their assigned tasks */}
      {isAdmin && (
      <div className="flex gap-1 rounded-xl border bg-muted/40 p-1">
        <button
          onClick={() => setActiveTab("tasks")}
          className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
            activeTab === "tasks" ? "bg-white text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Activity className="h-4 w-4" /> Active Tasks
        </button>
        <button
          onClick={() => setActiveTab("monitoring")}
          className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
            activeTab === "monitoring" ? "bg-white text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Navigation className="h-4 w-4" /> Live Monitoring
        </button>
      </div>
      )}

      {activeTab === "monitoring" && isAdmin ? (
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Users className="h-4 w-4" />
                Select Employee to Monitor
              </CardTitle>
              <p className="text-xs text-muted-foreground">Green = live GPS. Gray = idle.</p>
            </CardHeader>
            <CardContent>
              {employees.length === 0 ? (
                <p className="text-sm text-muted-foreground">No employees found</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {employees.map((emp) => {
                    const empTasks = tasks.filter((t) => t.rider?.id === emp.id && !!t.pickupStartedAt);
                    const hasLiveForEmp = empTasks.length > 0;
                    const isRecent = !!(emp.lastLocationUpdate && (now - new Date(emp.lastLocationUpdate).getTime() < 300000));
                    const showGreen = hasLiveForEmp && isRecent;
                    return (
                      <button
                        key={emp.id}
                        onClick={() => setSelectedEmpId(emp.id)}
                        className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-all ${
                          selectedEmpId === emp.id
                            ? "border-emerald-500 bg-emerald-50 text-emerald-700 shadow-sm dark:bg-emerald-950/30 dark:text-emerald-400"
                            : "border-muted hover:border-muted-foreground/30 hover:bg-muted/50"
                        }`}
                        title={hasLiveForEmp ? (isRecent ? `Live monitoring active — ${empTasks[0]?.referenceNumber}` : "Started but no recent GPS") : "No active pick-up/drop-off — monitoring idle until Start Pickup/Delivery"}
                      >
                        <span className={`h-2 w-2 rounded-full ${showGreen ? "bg-emerald-500 animate-pulse" : "bg-gray-300"}`} />
                        <span className="font-medium">{emp.name}</span>
                        <span className="text-xs text-muted-foreground">{roleLabel(emp.role)}</span>
                        {hasLiveForEmp ? <Badge variant="outline" className="text-[10px]">Tracking {empTasks.length}</Badge> : <span className="text-[10px] text-muted-foreground">(idle)</span>}
                      </button>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {selectedEmpId && (() => {
            const emp = employees.find((e) => e.id === selectedEmpId);
            const empLiveTasks = tasks.filter((t) => t.rider?.id === selectedEmpId && !!t.pickupStartedAt);
            return (
              <div className="space-y-4">
                <AdminLiveMonitor
                  key={selectedEmpId}
                  employeeId={selectedEmpId}
                  employeeName={emp?.name || "Employee"}
                  tasks={empLiveTasks.map((t) => ({ referenceNumber: t.referenceNumber, pickupLocation: t.pickupLocation, dropOffLocation: t.dropOffLocation, pickupStartedAt: t.pickupStartedAt, status: t.status, pickupLat: t.pickupLat, pickupLng: t.pickupLng, dropOffLat: t.dropOffLat, dropOffLng: t.dropOffLng, riderVehicleType: t.rider?.vehicleType ?? null, riderPlate: t.rider?.plateNumber ?? null }))}
                  initialLat={emp?.currentLat ?? null}
                  initialLng={emp?.currentLng ?? null}
                  lastUpdate={emp?.lastLocationUpdate ?? null}
                />
              </div>
            );
          })()}
        </div>
      ) : loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}><CardContent className="p-6"><div className="animate-pulse space-y-3">
              <div className="h-4 bg-muted rounded w-1/3" />
              <div className="h-3 bg-muted rounded w-2/3" />
              <div className="h-3 bg-muted rounded w-1/2" />
            </div></CardContent></Card>
          ))}
        </div>
      ) : <>
        {isAdmin && (
          <div className="grid gap-2 sm:grid-cols-[1fr_140px_140px_150px]">
            <input value={taskSearch} onChange={(e) => { setTaskSearch(e.target.value); setTaskPage(1); }} placeholder="Filter by reference, customer, or rider" className="h-10 rounded-lg border bg-background px-3 text-sm" />
            <select value={taskTypeFilter} onChange={(e) => { setTaskTypeFilter(e.target.value); setTaskPage(1); }} className="h-10 rounded-lg border bg-background px-3 text-sm"><option value="all">All task types</option><option value="pickup">Pickup</option><option value="delivery">Delivery</option></select>
            <select value={taskDateFilter} onChange={(e) => { const v = e.target.value as "today"|"all"|"custom"; setTaskDateFilter(v); setTaskPage(1); if (v === "today") setTaskDate(manilaDateStr(new Date())); }} className="h-10 rounded-lg border bg-background px-3 text-sm"><option value="today">Today only</option><option value="all">All dates</option><option value="custom">Pick date…</option></select>
            {taskDateFilter === "custom" ? (
              <input type="date" value={taskDate} onChange={(e) => { setTaskDate(e.target.value); setTaskPage(1); }} className="h-10 rounded-lg border bg-background px-3 text-sm" />
            ) : (
              <div className="flex h-10 items-center rounded-lg border bg-muted/30 px-3 text-xs text-muted-foreground">{taskDateFilter === "today" ? `Today • ${manilaDateStr(new Date())}` : "All dates — previous & future"}</div>
            )}
          </div>
        )}
        {filteredTasks.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            <Package className="mx-auto h-8 w-8 mb-2 opacity-50" />
            <p>No active tasks</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {paginatedTasks.map((task) => (
            <Card key={task.id} className={`border-l-4 ${task.taskType === "delivery" ? "border-l-orange-500" : "border-l-blue-500"}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-center gap-2">
                      <code className="rounded bg-muted px-2 py-0.5 text-xs font-mono font-bold">{task.referenceNumber}</code>
                      <Badge className="text-[10px]">{STATUS_LABELS[task.status] || task.status.replace("_", " ")}</Badge>
                      <Badge variant="outline" className="text-[10px] capitalize">{task.taskType}</Badge>
                      {!task.isAssignedToMe && task.rider && (
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <User className="h-3 w-3" /> {task.rider.name}
                        </span>
                      )}
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

                    {(task.isAssignedToMe || isAdmin) && (
                      <div className="pt-2">
                        {activeTask === task.id ? (
                          <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
                            <div className="flex gap-2">
                              {task.availableActions.map((action) => (
                                <Button
                                  key={action}
                                  size="sm"
                                  variant={activeAction === action ? "default" : "outline"}
                                  onClick={() => setActiveAction(action)}
                                  className="flex-1 text-xs"
                                >
                                  {LOGISTICS_ACTION_META[action].label}
                                </Button>
                              ))}
                            </div>

                            <div className="flex gap-2">
                              {photoProof ? (
                                <div className="relative">
                                  <Image unoptimized width={48} height={48} src={photoProof} alt="Proof" className="h-12 w-12 rounded object-cover" />
                                  <button onClick={() => setPhotoProof(null)}
                                    className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full text-xs w-4 h-4 flex items-center justify-center">×</button>
                                </div>
                              ) : (
                                <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                                  <Camera className="h-3 w-3 mr-1" /> Photo
                                </Button>
                              )}
                              <input ref={fileInputRef} type="file" accept="image/*" capture="environment"
                                onChange={async (e) => {
                                  const f = e.target.files?.[0];
                                  if (f) { try { setPhotoProof(await imageFileToDataUrl(f)); } catch { toast.error("Could not read photo"); } }
                                }} className="hidden" />
                              <input
                                value={actionNote} onChange={(e) => setActionNote(e.target.value)}
                                placeholder="Note (optional)" className="flex h-8 flex-1 rounded-md border border-input bg-background px-2 text-xs shadow-sm" />
                            </div>

                            <div className="flex gap-2">
                              <Button size="sm" onClick={() => activeAction && handleAction(task.id, activeAction)}
                                disabled={processingAction || !activeAction}>
                                {processingAction ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <CheckCircle className="h-3 w-3 mr-1" />}
                                Confirm
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => { setActiveTask(null); setActiveAction(null); setPhotoProof(null); setActionNote(""); }}>
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {quickStartAction(task) ? (
                              <Button size="sm" onClick={() => handleAction(task.id, quickStartAction(task) as string)} disabled={processingAction} className="bg-emerald-600 text-white hover:bg-emerald-700">
                                <Play className="mr-1 h-3 w-3" />
                                Start {quickStartAction(task) === "start-delivery" ? "Delivery" : "Pickup"}
                              </Button>
                            ) : (
                              <Button size="sm" onClick={() => openTaskActions(task.id)}>
                                <Play className="mr-1 h-3 w-3" /> {task.isAssignedToMe ? "Task Actions" : "Manage Task"}
                              </Button>
                            )}
                            <Button size="sm" variant="outline" asChild>
                              <Link href={`/dashboard/bookings/${task.id}`}>
                                <Package className="mr-1 h-3 w-3" /> Details
                              </Link>
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                    {!task.rider && (
                      <p className="pt-2 text-xs font-medium text-amber-700">No {task.taskType} employee assigned yet.</p>
                    )}
                  </div>

                  {task.rider && task.isAssignedToMe && task.rider.vehicleType && (
                    <div className="shrink-0 text-right">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Bike className="h-3 w-3" /> {task.rider.vehicleType}
                      </div>
                      {task.rider.plateNumber && (
                        <p className="text-[10px] font-mono text-muted-foreground">{task.rider.plateNumber}</p>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
          {filteredTasks.length > taskPageSize && <Pagination currentPage={currentTaskPage} totalPages={taskTotalPages} onPageChange={setTaskPage} />}
        </div>
      )}</>}
    </div>
  );
}
