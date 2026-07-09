"use client";

import { useEffect, useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Navigation, MapPin, Phone, User, Bike, Camera, CheckCircle,
  Loader2, ArrowRight, Package, Clock, AlertTriangle, Play,
} from "lucide-react";
import Link from "next/link";
import { formatDate } from "@/lib/utils";
import { toast } from "sonner";

interface Task {
  id: string;
  referenceNumber: string;
  customer: { name: string; email: string; phone: string };
  pickupLocation: string;
  dropOffLocation: string;
  status: string;
  taskType: string;
  rider: { id: string; name: string; profilePic: string | null; vehicleType: string | null; plateNumber: string | null } | null;
  isAssignedToMe: boolean;
  createdAt: string;
}

const STATUS_LABELS: Record<string, string> = {
  CONFIRMED: "Ready for Pickup",
  RECEIVED: "Picked Up",
  IN_STORAGE: "In Storage",
  OUT_FOR_DELIVERY: "Out for Delivery",
};

const ACTION_BUTTONS: Record<string, { label: string; action: string; icon: string }[]> = {
  pickup: [
    { label: "Start Pickup", action: "start-pickup", icon: "play" },
    { label: "Arrived at Location", action: "arrive-pickup", icon: "map" },
    { label: "Complete Pickup", action: "complete-pickup", icon: "check" },
  ],
  delivery: [
    { label: "Start Delivery", action: "start-delivery", icon: "play" },
    { label: "Arrived at Location", action: "arrive-delivery", icon: "map" },
    { label: "Complete Delivery", action: "complete-delivery", icon: "check" },
  ],
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
  const [userId, setUserId] = useState<string>("");

  useEffect(() => {
    Promise.all([
      fetch("/api/logistics/tasks").then((r) => r.json()),
      fetch("/api/auth/session").then((r) => r.json()),
    ]).then(([tasksData, sessionData]) => {
      setTasks(tasksData || []);
      setUserRole(sessionData?.user?.role || "");
      setUserId(sessionData?.user?.id || "");
    }).catch(() => toast.error("Failed to load tasks"))
      .finally(() => setLoading(false));
  }, []);

  const isAdmin = userRole === "ADMIN" || userRole === "STAFF";

  async function handleAction(taskId: string, action: string) {
    setProcessingAction(true);
    try {
      const body: Record<string, unknown> = { action };
      if (actionNote) body.note = actionNote;
      if (photoProof) body.photo = photoProof;

      const res = await fetch(`/api/logistics/tasks/${taskId}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Action failed");
      const data = await res.json();
      setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, status: data.status } : t));
      toast.success(`Action completed — ${action}`);
      setActiveTask(null);
      setActiveAction(null);
      setPhotoProof(null);
      setActionNote("");
    } catch {
      toast.error("Failed to process action");
    }
    setProcessingAction(false);
  }

  const filteredTasks = isAdmin ? tasks : tasks.filter((t) => t.isAssignedToMe);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Logistics</h1>
          <p className="text-sm text-muted-foreground">
            {isAdmin ? "All employees' tasking" : "My assigned tasks"}
          </p>
        </div>
        <Badge variant="outline" className="text-xs">
          {filteredTasks.length} active task{filteredTasks.length !== 1 ? "s" : ""}
        </Badge>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}><CardContent className="p-6"><div className="animate-pulse space-y-3">
              <div className="h-4 bg-muted rounded w-1/3" />
              <div className="h-3 bg-muted rounded w-2/3" />
              <div className="h-3 bg-muted rounded w-1/2" />
            </div></CardContent></Card>
          ))}
        </div>
      ) : filteredTasks.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            <Package className="mx-auto h-8 w-8 mb-2 opacity-50" />
            <p>No active tasks</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredTasks.map((task) => (
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

                    {task.isAssignedToMe && (
                      <div className="pt-2">
                        {activeTask === task.id ? (
                          <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
                            <div className="flex gap-2">
                              {ACTION_BUTTONS[task.taskType]?.map((btn) => (
                                <Button
                                  key={btn.action}
                                  size="sm"
                                  variant={activeAction === btn.action ? "default" : "outline"}
                                  onClick={() => setActiveAction(btn.action)}
                                  className="flex-1 text-xs"
                                >
                                  {btn.label}
                                </Button>
                              ))}
                            </div>

                            <div className="flex gap-2">
                              {photoProof ? (
                                <div className="relative">
                                  <img src={photoProof} alt="Proof" className="h-12 w-12 rounded object-cover" />
                                  <button onClick={() => setPhotoProof(null)}
                                    className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full text-xs w-4 h-4 flex items-center justify-center">×</button>
                                </div>
                              ) : (
                                <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                                  <Camera className="h-3 w-3 mr-1" /> Photo
                                </Button>
                              )}
                              <input ref={fileInputRef} type="file" accept="image/*" capture="environment"
                                onChange={(e) => {
                                  const f = e.target.files?.[0];
                                  if (f) { const r = new FileReader(); r.onloadend = () => setPhotoProof(r.result as string); r.readAsDataURL(f); }
                                }} className="hidden" />
                              <input
                                value={actionNote} onChange={(e) => setActionNote(e.target.value)}
                                placeholder="Note (optional)" className="flex h-8 flex-1 rounded-md border border-input bg-background px-2 text-xs shadow-sm" />
                            </div>

                            <div className="flex gap-2">
                              <Button size="sm" onClick={() => handleAction(task.id, activeAction || ACTION_BUTTONS[task.taskType][0].action)}
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
                          <div className="flex gap-2">
                            <Button size="sm" onClick={() => setActiveTask(task.id)}>
                              <Play className="mr-1 h-3 w-3" /> Start Task
                            </Button>
                            <Button size="sm" variant="outline" asChild>
                              <Link href={`/track/map/${task.referenceNumber}`}>
                                <Navigation className="mr-1 h-3 w-3" /> View Map
                              </Link>
                            </Button>
                            <Button size="sm" variant="outline" asChild>
                              <Link href={`/track/${task.referenceNumber}`}>
                                <Package className="mr-1 h-3 w-3" /> Details
                              </Link>
                            </Button>
                          </div>
                        )}
                      </div>
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
        </div>
      )}
    </div>
  );
}
