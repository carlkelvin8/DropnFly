"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate, formatRelativeTime } from "@/lib/utils";
import {
  AlertTriangle,
  Search,
  ChevronRight,
  Clock,
  User,
  MessageCircle,
  Flag,
  Scan,
  Loader2,
} from "lucide-react";

interface Incident {
  id: string;
  type: string;
  description: string;
  priority: string;
  status: string;
  submittedAt: string;
  resolvedAt: string | null;
  customer: { name: string; email: string; phone: string };
  booking: { referenceNumber: string };
  timeline: { id: string; action: string; createdAt: string }[];
}

interface IncidentsResponse {
  incidents: Incident[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const priorityConfig: Record<string, { label: string; color: string }> = {
  LOW: { label: "Low", color: "bg-gray-100 text-gray-700 border-gray-300" },
  MEDIUM: { label: "Medium", color: "bg-yellow-100 text-yellow-700 border-yellow-300" },
  HIGH: { label: "High", color: "bg-orange-100 text-orange-700 border-orange-300" },
  CRITICAL: { label: "Critical", color: "bg-red-100 text-red-700 border-red-300" },
};

const statusConfig: Record<string, { label: string; color: string }> = {
  PENDING: { label: "Pending", color: "bg-yellow-50 text-yellow-700 border-yellow-200" },
  INVESTIGATING: { label: "Investigating", color: "bg-blue-50 text-blue-700 border-blue-200" },
  RESOLVED: { label: "Resolved", color: "bg-green-50 text-green-700 border-green-200" },
  CLOSED: { label: "Closed", color: "bg-gray-50 text-gray-500 border-gray-200" },
};

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

export default function IncidentsPage() {
  const [data, setData] = useState<IncidentsResponse | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [flagging, setFlagging] = useState(false);
  const [flagResult, setFlagResult] = useState<string | null>(null);
  const hasFilter = statusFilter || priorityFilter;

  useEffect(() => {
    if (!hasFilter) {
      setLoading(false);
      setData(null);
      return;
    }
    setLoading(true);
    const params = new URLSearchParams();
    if (statusFilter) params.set("status", statusFilter);
    if (priorityFilter) params.set("priority", priorityFilter);
    params.set("page", String(page));
    fetch(`/api/incidents?${params}`)
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [statusFilter, priorityFilter, page, hasFilter]);

  const runAutoFlag = async () => {
    setFlagging(true);
    setFlagResult(null);
    try {
      const res = await fetch("/api/incidents/auto-flag", { method: "POST" });
      const json = await res.json();
      setFlagResult(`🔍 ${json.flagged} found · ${json.created} new incidents created`);
    } catch {
      setFlagResult("❌ Failed to run auto-flag check");
    } finally {
      setFlagging(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Incidents & Disputes</h1>
          <p className="text-sm text-muted-foreground">
            Investigate and resolve customer complaints and service issues
            {data && <span className="ml-1">· {data.total} total</span>}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          options={[
            { value: "", label: "All Statuses" },
            { value: "PENDING", label: "Pending" },
            { value: "INVESTIGATING", label: "Investigating" },
            { value: "RESOLVED", label: "Resolved" },
            { value: "CLOSED", label: "Closed" },
          ]}
          className="w-[160px]"
        />
        <Select
          value={priorityFilter}
          onChange={(e) => { setPriorityFilter(e.target.value); setPage(1); }}
          options={[
            { value: "", label: "All Priorities" },
            { value: "LOW", label: "Low" },
            { value: "MEDIUM", label: "Medium" },
            { value: "HIGH", label: "High" },
            { value: "CRITICAL", label: "Critical" },
          ]}
          className="w-[160px]"
        />
      </div>

      <Card className="border-t-2 border-t-red-500 shadow-md">
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-3 p-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : data?.incidents.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-muted-foreground">
              <AlertTriangle className="mb-2 h-8 w-8" />
              <p className="text-sm font-medium">No incidents found</p>
              <p className="text-xs">All clear — no reported issues match your filters</p>
            </div>
          ) : (
            <div className="divide-y">
              {data?.incidents.map((inc) => (
                <Link
                  key={inc.id}
                  href={`/dashboard/incidents/${inc.id}`}
                  className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-muted/30"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-50 text-lg">
                    {typeIcons[inc.type] || "📋"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold">{typeLabels[inc.type] || inc.type}</span>
                      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${priorityConfig[inc.priority]?.color || ""}`}>
                        {inc.priority}
                      </span>
                      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${statusConfig[inc.status]?.color || ""}`}>
                        {statusConfig[inc.status]?.label || inc.status}
                      </span>
                      <Badge variant="outline" className="text-[10px] font-mono">
                        {inc.booking.referenceNumber}
                      </Badge>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {inc.customer.name} — {inc.description.slice(0, 120)}
                    </p>
                    <div className="mt-1 flex items-center gap-3 text-[10px] text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" /> {inc.customer.name}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" /> {formatRelativeTime(inc.submittedAt)}
                      </span>
                      {inc.timeline.length > 0 && (
                        <span className="flex items-center gap-1">
                          <MessageCircle className="h-3 w-3" /> {inc.timeline.length} update{inc.timeline.length !== 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Page {data.page} of {data.totalPages} ({data.total} entries)
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={data.page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              Previous
            </Button>
            <Button variant="outline" size="sm" disabled={data.page >= data.totalPages} onClick={() => setPage((p) => p + 1)}>
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
