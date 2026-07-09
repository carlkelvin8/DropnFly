"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  Building2,
  Calendar,
  CreditCard,
  Luggage,
  MapPin,
  Package,
  Search,
  Settings,
  ShoppingBag,
  User,
  Users,
  Clock,
  LogIn,
  LogOut,
  Plus,
  Pencil,
  Trash2,
  UserPlus,
  UserX,
  Truck,
  Tag,
} from "lucide-react";
import { formatDate, formatRelativeTime } from "@/lib/utils";

interface Log {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  details: string | null;
  createdAt: string;
  user: { name: string; email: string } | null;
}

interface LogsResponse {
  logs: Log[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const actionConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  CREATE: { label: "Created", color: "bg-emerald-100 text-emerald-800 border-emerald-300", icon: <Plus className="h-3 w-3" /> },
  UPDATE: { label: "Updated", color: "bg-blue-100 text-blue-800 border-blue-300", icon: <Pencil className="h-3 w-3" /> },
  DELETE: { label: "Deleted", color: "bg-red-100 text-red-800 border-red-300", icon: <Trash2 className="h-3 w-3" /> },
  ASSIGN: { label: "Assigned", color: "bg-violet-100 text-violet-800 border-violet-300", icon: <UserPlus className="h-3 w-3" /> },
  UNASSIGN: { label: "Unassigned", color: "bg-orange-100 text-orange-800 border-orange-300", icon: <UserX className="h-3 w-3" /> },
  LOGIN: { label: "Logged In", color: "bg-green-100 text-green-800 border-green-300", icon: <LogIn className="h-3 w-3" /> },
  LOGOUT: { label: "Logged Out", color: "bg-gray-100 text-gray-800 border-gray-300", icon: <LogOut className="h-3 w-3" /> },
  PAYMENT: { label: "Payment", color: "bg-amber-100 text-amber-800 border-amber-300", icon: <CreditCard className="h-3 w-3" /> },
};

function getActionConfig(action: string) {
  return actionConfig[action] || { label: action, color: "bg-gray-100 text-gray-800 border-gray-300", icon: <Tag className="h-3 w-3" /> };
}

const entityIcons: Record<string, React.ReactNode> = {
  Booking: <ShoppingBag className="h-4 w-4" />,
  Customer: <Users className="h-4 w-4" />,
  User: <User className="h-4 w-4" />,
  Employee: <User className="h-4 w-4" />,
  Payment: <CreditCard className="h-4 w-4" />,
  LuggageItem: <Luggage className="h-4 w-4" />,
  StorageLocation: <MapPin className="h-4 w-4" />,
  PromoCode: <Tag className="h-4 w-4" />,
  SystemSetting: <Settings className="h-4 w-4" />,
  BaggageTag: <Truck className="h-4 w-4" />,
  ScanEvent: <Package className="h-4 w-4" />,
};

function getEntityIcon(entity: string) {
  return entityIcons[entity] || <Building2 className="h-4 w-4" />;
}

function groupLogsByDate(logs: Log[]): Record<string, Log[]> {
  const groups: Record<string, Log[]> = {};
  for (const log of logs) {
    const date = new Date(log.createdAt).toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    if (!groups[date]) groups[date] = [];
    groups[date].push(log);
  }
  return groups;
}

export default function ActivityLogsPage() {
  const [data, setData] = useState<LogsResponse | null>(null);
  const [entityFilter, setEntityFilter] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  function fetchLogs() {
    setLoading(true);
    const params = new URLSearchParams();
    if (entityFilter) params.set("entity", entityFilter);
    if (actionFilter) params.set("action", actionFilter);
    if (search) params.set("search", search);
    params.set("page", String(page));
    params.set("limit", "30");
    fetch(`/api/activity-logs?${params}`)
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    setPage(1);
  }, [entityFilter, actionFilter, search]);

  useEffect(() => {
    fetchLogs();
  }, [entityFilter, actionFilter, page]);

  function handleSearch() {
    setPage(1);
    fetchLogs();
  }

  const groupedLogs = data?.logs ? groupLogsByDate(data.logs) : {};

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Activity Logs</h1>
          <p className="text-sm text-muted-foreground">
            Track all system activities and changes
            {data && <span className="ml-1">· {data.total} total entries</span>}
          </p>
        </div>
      </div>

      <Card className="border-t-2 border-t-primary">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search user, entity, details..."
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              />
            </div>
            <Select
              value={entityFilter}
              onChange={(e) => setEntityFilter(e.target.value)}
              options={[
                { value: "", label: "All Entities" },
                { value: "Booking", label: "Booking" },
                { value: "Customer", label: "Customer" },
                { value: "User", label: "User" },
                { value: "Employee", label: "Employee" },
                { value: "Payment", label: "Payment" },
                { value: "LuggageItem", label: "Luggage" },
                { value: "StorageLocation", label: "Location" },
                { value: "PromoCode", label: "Promo Code" },
                { value: "SystemSetting", label: "Settings" },
                { value: "BaggageTag", label: "Baggage Tag" },
              ]}
              className="w-[160px]"
            />
            <Select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              options={[
                { value: "", label: "All Actions" },
                { value: "CREATE", label: "Created" },
                { value: "UPDATE", label: "Updated" },
                { value: "DELETE", label: "Deleted" },
                { value: "ASSIGN", label: "Assigned" },
                { value: "UNASSIGN", label: "Unassigned" },
                { value: "LOGIN", label: "Login" },
                { value: "LOGOUT", label: "Logout" },
                { value: "PAYMENT", label: "Payment" },
              ]}
              className="w-[150px]"
            />
            <Button variant="outline" size="sm" onClick={() => { setEntityFilter(""); setActionFilter(""); setSearch(""); setPage(1); }}>
              Clear
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading && !data ? (
            <div className="space-y-4 p-6">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex animate-pulse gap-3">
                  <div className="h-8 w-8 rounded-full bg-muted" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-1/3 rounded bg-muted" />
                    <div className="h-3 w-2/3 rounded bg-muted" />
                  </div>
                </div>
              ))}
            </div>
          ) : data?.logs.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-muted-foreground">
              <Search className="mb-2 h-8 w-8" />
              <p className="text-sm">No activity logs found</p>
              <p className="text-xs">Try adjusting your filters</p>
            </div>
          ) : (
            <div className="px-6 py-4">
              {Object.entries(groupedLogs).map(([date, logs]) => (
                <div key={date} className="mb-6 last:mb-0">
                  <div className="sticky top-0 mb-3 flex items-center gap-2 rounded-lg bg-muted/60 px-3 py-1.5 text-xs font-medium text-muted-foreground backdrop-blur-sm">
                    <Calendar className="h-3.5 w-3.5" />
                    {date}
                  </div>
                  <div className="relative space-y-0">
                    {logs.map((log, idx) => (
                      <div key={log.id} className="relative flex gap-3 pb-4 last:pb-0">
                        {idx < logs.length - 1 && (
                          <div className="absolute left-[15px] top-8 bottom-0 w-px bg-border" />
                        )}
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border bg-background shadow-sm">
                          {log.user ? (
                            <span className="text-[10px] font-bold text-primary">
                              {log.user.name.charAt(0).toUpperCase()}
                            </span>
                          ) : (
                            <User className="h-3.5 w-3.5 text-muted-foreground" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-medium">
                              {log.user?.name || "System"}
                            </span>
                            <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${getActionConfig(log.action).color}`}>
                              {getActionConfig(log.action).icon}
                              {getActionConfig(log.action).label}
                            </span>
                            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                              {getEntityIcon(log.entity)}
                              {log.entity}
                            </span>
                            {log.entityId && (
                              <span className="font-mono text-[10px] text-muted-foreground">
                                #{log.entityId.slice(0, 8)}
                              </span>
                            )}
                            <span className="ml-auto flex items-center gap-1 text-[10px] text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              {formatRelativeTime(log.createdAt)}
                            </span>
                          </div>
                          {log.details && (
                            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                              {log.details}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
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
            <Button
              variant="outline"
              size="sm"
              disabled={data.page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={data.page >= data.totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
