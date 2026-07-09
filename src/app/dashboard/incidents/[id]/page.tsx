"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { formatDate, formatRelativeTime } from "@/lib/utils";
import {
  AlertTriangle,
  ArrowLeft,
  Clock,
  User,
  Flag,
  MessageCircle,
  CheckCircle,
  Search,
  Save,
  Plus,
  Luggage,
  MapPin,
  Calendar,
} from "lucide-react";

interface IncidentDetail {
  id: string;
  type: string;
  description: string;
  priority: string;
  status: string;
  internalNotes: string | null;
  resolution: string | null;
  escalatedTo: string | null;
  submittedAt: string;
  resolvedAt: string | null;
  customer: { name: string; email: string; phone: string };
  booking: {
    referenceNumber: string;
    pickupLocation: string;
    dropOffLocation: string;
    status: string;
    checkIn: string;
    checkOut: string | null;
    totalPrice: number;
    luggageDetails: string | null;
  };
  timeline: {
    id: string;
    action: string;
    description: string;
    createdAt: string;
    user: { name: string } | null;
  }[];
}

const priorityOptions = [
  { value: "LOW", label: "Low" },
  { value: "MEDIUM", label: "Medium" },
  { value: "HIGH", label: "High" },
  { value: "CRITICAL", label: "Critical" },
];

const statusOptions = [
  { value: "PENDING", label: "Pending" },
  { value: "INVESTIGATING", label: "Investigating" },
  { value: "RESOLVED", label: "Resolved" },
  { value: "CLOSED", label: "Closed" },
];

const typeLabels: Record<string, string> = {
  lost_baggage: "Lost Baggage",
  damaged_baggage: "Damaged Baggage",
  service_complaint: "Service Complaint",
  other: "Other",
};

const typeIcons: Record<string, string> = {
  lost_baggage: "🔍",
  damaged_baggage: "💔",
  service_complaint: "💬",
  other: "📋",
};

const actionIcons: Record<string, string> = {
  created: "📝",
  status_change: "🔄",
  note_added: "📌",
  photo_uploaded: "📷",
  resolved: "✅",
};

export default function IncidentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [incident, setIncident] = useState<IncidentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newNote, setNewNote] = useState("");

  const [editStatus, setEditStatus] = useState("");
  const [editPriority, setEditPriority] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editResolution, setEditResolution] = useState("");

  useEffect(() => {
    fetch(`/api/incidents/${params.id}`)
      .then((r) => r.json())
      .then((d) => {
        setIncident(d);
        setEditStatus(d.status);
        setEditPriority(d.priority);
        setEditNotes(d.internalNotes || "");
        setEditResolution(d.resolution || "");
      })
      .catch(() => toast.error("Failed to load incident"))
      .finally(() => setLoading(false));
  }, [params.id]);

  async function handleSave() {
    if (!incident) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/incidents/${incident.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: editStatus,
          priority: editPriority,
          internalNotes: editNotes,
          resolution: editResolution,
        }),
      });
      if (!res.ok) throw new Error();
      const updated = await res.json();
      setIncident(updated);
      toast.success("Incident updated");
    } catch {
      toast.error("Failed to save changes");
    } finally {
      setSaving(false);
    }
  }

  async function handleAddNote() {
    if (!incident || !newNote.trim()) return;
    try {
      const res = await fetch(`/api/incidents/${incident.id}/timeline`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "note_added", description: newNote }),
      });
      if (!res.ok) throw new Error();
      const entry = await res.json();
      setIncident((prev) => prev ? { ...prev, timeline: [entry, ...prev.timeline] } : prev);
      setNewNote("");
      toast.success("Note added");
    } catch {
      toast.error("Failed to add note");
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Card><CardContent className="space-y-4 p-6">
          {Array.from({ length: 6 }).map((_, i) => (<Skeleton key={i} className="h-6 w-full" />))}
        </CardContent></Card>
      </div>
    );
  }

  if (!incident) {
    return (
      <div className="flex flex-col items-center py-16 text-muted-foreground">
        <AlertTriangle className="mb-2 h-8 w-8" />
        <p>Incident not found</p>
        <Button variant="link" asChild><Link href="/dashboard/incidents">Back to Incidents</Link></Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard/incidents"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold">{typeLabels[incident.type] || incident.type}</h1>
            <Badge variant="outline" className="font-mono text-[10px]">{incident.booking.referenceNumber}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Reported {formatRelativeTime(incident.submittedAt)} by {incident.customer.name}
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          {/* Report Details */}
          <Card className="border-t-2 border-t-red-500 shadow-md">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Flag className="h-4 w-4 text-red-500" /> Report Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border bg-muted/20 p-4">
                <p className="text-sm leading-relaxed">{incident.description}</p>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-xs text-muted-foreground">Type</span>
                  <p className="font-medium">{typeIcons[incident.type]} {typeLabels[incident.type]}</p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Submitted</span>
                  <p className="font-medium">{formatDate(incident.submittedAt)}</p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Customer</span>
                  <p className="font-medium">{incident.customer.name}</p>
                  <p className="text-xs text-muted-foreground">{incident.customer.email}</p>
                  <p className="text-xs text-muted-foreground">{incident.customer.phone}</p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Booking</span>
                  <p className="font-mono font-medium">{incident.booking.referenceNumber}</p>
                  <p className="text-xs text-muted-foreground">Status: {incident.booking.status.replace(/_/g, " ")}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Timeline */}
          <Card className="border-t-2 border-t-amber-500 shadow-md">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Clock className="h-4 w-4 text-amber-500" /> Timeline
              </CardTitle>
            </CardHeader>
            <CardContent>
              {incident.timeline.length === 0 ? (
                <p className="text-sm text-muted-foreground">No timeline entries yet</p>
              ) : (
                <div className="relative space-y-0">
                  {incident.timeline.map((entry, idx) => (
                    <div key={entry.id} className="relative flex gap-3 pb-5 last:pb-0">
                      {idx < incident.timeline.length - 1 && (
                        <div className="absolute left-[15px] top-8 bottom-0 w-px bg-border" />
                      )}
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border bg-background text-sm shadow-sm">
                        {actionIcons[entry.action] || "📌"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium capitalize">
                            {entry.action.replace(/_/g, " ")}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {formatRelativeTime(entry.createdAt)}
                          </span>
                          {entry.user && (
                            <span className="text-[10px] text-muted-foreground">by {entry.user.name}</span>
                          )}
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground">{entry.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          {/* Admin Actions */}
          <Card className="border-t-2 border-t-blue-500 shadow-md">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <User className="h-4 w-4 text-blue-500" /> Admin Actions
              </CardTitle>
              <CardDescription className="text-xs">Changes are emailed to the customer automatically</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Status</Label>
                <Select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                  options={statusOptions}
                  className="w-full"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Priority Level</Label>
                <Select
                  value={editPriority}
                  onChange={(e) => setEditPriority(e.target.value)}
                  options={priorityOptions}
                  className="w-full"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Escalate To</Label>
                <select
                  value={incident?.escalatedTo || ""}
                  onChange={(e) => {}}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm"
                >
                  <option value="">Not escalated</option>
                  <option value="manager">Manager</option>
                  <option value="director">Director</option>
                  <option value="executive">Executive</option>
                </select>
                <p className="text-[10px] text-muted-foreground">Escalate this incident to higher management</p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Internal Notes (admin only)</Label>
                <textarea
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-xs shadow-sm"
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="Notes visible only to admin/staff..."
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Resolution (visible to customer)</Label>
                <textarea
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-xs shadow-sm"
                  value={editResolution}
                  onChange={(e) => setEditResolution(e.target.value)}
                  placeholder="Explain how this was resolved..."
                />
                <p className="text-[10px] text-muted-foreground">Customers will see this resolution on their tracking page</p>
              </div>
              <Button onClick={handleSave} disabled={saving} className="w-full">
                <Save className="mr-2 h-4 w-4" /> {saving ? "Saving..." : "Save Changes"}
              </Button>
            </CardContent>
          </Card>

          {/* Booking Info */}
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Luggage className="h-4 w-4 text-muted-foreground" /> Booking Info
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              <div className="flex items-start gap-2">
                <MapPin className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
                <div>
                  <p className="text-[10px] text-muted-foreground">Pickup</p>
                  <p>{incident.booking.pickupLocation}</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <MapPin className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
                <div>
                  <p className="text-[10px] text-muted-foreground">Drop-off</p>
                  <p>{incident.booking.dropOffLocation}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="h-3 w-3 text-muted-foreground" />
                <span>{formatDate(incident.booking.checkIn)}</span>
              </div>
              {incident.resolvedAt && (
                <div className="mt-2 rounded-lg border border-green-200 bg-green-50 p-2">
                  <p className="flex items-center gap-1 text-[10px] font-medium text-green-700">
                    <CheckCircle className="h-3 w-3" /> Resolved {formatDate(incident.resolvedAt)}
                  </p>
                  <p className="mt-0.5 text-[10px] text-green-600">{incident.resolution}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
