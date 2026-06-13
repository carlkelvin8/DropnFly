"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { TableSkeleton } from "@/components/ui/skeleton";
import { Pagination } from "@/components/ui/pagination";
import { toast } from "sonner";
import { formatDate } from "@/lib/utils";
import { Search } from "lucide-react";

interface Log {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  details: string | null;
  createdAt: string;
  user: { name: string; email: string } | null;
}

const actionColors: Record<string, "default" | "secondary" | "success" | "warning" | "destructive" | "outline"> = {
  CREATE: "success",
  UPDATE: "default",
  DELETE: "destructive",
  ASSIGN: "secondary",
  LOGIN: "outline",
  LOGOUT: "outline",
};

export default function ActivityLogsPage() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [entityFilter, setEntityFilter] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const itemsPerPage = 20;

  useEffect(() => {
    const abort = new AbortController();
    const params = new URLSearchParams();
    if (entityFilter) params.set("entity", entityFilter);
    params.set("limit", "100");
    fetch(`/api/activity-logs?${params}`, { signal: abort.signal })
      .then((r) => r.json())
      .then((data) => { if (!abort.signal.aborted) setLogs(data); })
      .catch(() => { if (!abort.signal.aborted) toast.error("Failed to load activity logs"); })
      .finally(() => { if (!abort.signal.aborted) setLoading(false); });
    return () => abort.abort();
  }, [entityFilter]);

  const filtered = logs.filter((l) => {
    const q = search.toLowerCase();
    if (!q) return true;
    return (
      (l.user?.name || "").toLowerCase().includes(q) ||
      l.entity.toLowerCase().includes(q) ||
      (l.details || "").toLowerCase().includes(q) ||
      l.action.toLowerCase().includes(q)
    );
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage));
  const paginatedLogs = filtered.slice((page - 1) * itemsPerPage, page * itemsPerPage);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Activity Logs</h1>
        <div className="w-48">
          <Select
            value={entityFilter}
            onChange={(e) => setEntityFilter(e.target.value)}
            options={[
              { value: "", label: "All Entities" },
              { value: "Booking", label: "Bookings" },
              { value: "Customer", label: "Customers" },
              { value: "User", label: "Users" },
              { value: "StorageLocation", label: "Locations" },
              { value: "SystemSetting", label: "Settings" },
            ]}
            placeholder="Filter by entity"
          />
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by user, entity, action, or details..."
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <Card className="border-t-2 border-t-primary">
        <CardContent className="p-0">
          {loading && logs.length === 0 ? (
            <div className="p-6">
              <TableSkeleton cols={5} rows={8} />
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="h-10 text-xs font-medium uppercase tracking-wider text-muted-foreground">Date</TableHead>
                    <TableHead className="h-10 text-xs font-medium uppercase tracking-wider text-muted-foreground">User</TableHead>
                    <TableHead className="h-10 text-xs font-medium uppercase tracking-wider text-muted-foreground">Action</TableHead>
                    <TableHead className="h-10 text-xs font-medium uppercase tracking-wider text-muted-foreground">Entity</TableHead>
                    <TableHead className="h-10 text-xs font-medium uppercase tracking-wider text-muted-foreground">Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-xs">{formatDate(log.createdAt)}</TableCell>
                      <TableCell>{log.user?.name || "System"}</TableCell>
                      <TableCell>
                        <Badge variant={actionColors[log.action] || "outline"}>
                          {log.action}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">
                          {log.entity}
                          {log.entityId && (
                            <span className="ml-1 font-mono text-xs text-muted-foreground">
                              #{log.entityId.slice(0, 8)}
                            </span>
                          )}
                        </span>
                      </TableCell>
                      <TableCell className="max-w-xs truncate text-sm text-muted-foreground">
                        {log.details || "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                  {paginatedLogs.length === 0 && !loading && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        No activity logs found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              <div className="p-4 border-t">
                <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
