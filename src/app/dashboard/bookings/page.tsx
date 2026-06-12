"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { Plus, Eye, Search, Trash2, X, Download } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { TableSkeleton } from "@/components/ui/skeleton";
import { Pagination } from "@/components/ui/pagination";

interface Booking {
  id: string;
  referenceNumber: string;
  customer: { name: string; email: string };
  pickupLocation: string;
  dropOffLocation: string;
  numberOfBags: number;
  totalPrice: number;
  status: string;
  createdAt: string;
}

const statusVariant: Record<string, "default" | "secondary" | "success" | "warning" | "destructive" | "outline"> = {
  PENDING: "warning",
  CONFIRMED: "secondary",
  RECEIVED: "default",
  IN_STORAGE: "default",
  OUT_FOR_DELIVERY: "default",
  DELIVERED: "success",
  CANCELLED: "destructive",
};

const statusOptions = [
  { value: "", label: "All Statuses" },
  { value: "PENDING", label: "Pending" },
  { value: "CONFIRMED", label: "Confirmed" },
  { value: "RECEIVED", label: "Received" },
  { value: "IN_STORAGE", label: "In Storage" },
  { value: "OUT_FOR_DELIVERY", label: "Out for Delivery" },
  { value: "DELIVERED", label: "Delivered" },
  { value: "CANCELLED", label: "Cancelled" },
];

const ITEMS_PER_PAGE = 10;

export default function BookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const abort = new AbortController();
    fetch("/api/bookings", { signal: abort.signal })
      .then((res) => { if (!res.ok) throw new Error(); return res.json(); })
      .then(setBookings)
      .catch(() => {})
      .finally(() => setLoading(false));
    return () => abort.abort();
  }, []);

  const filtered = bookings.filter((b) => {
    const matchesSearch = !search || 
      b.referenceNumber.toLowerCase().includes(search.toLowerCase()) ||
      b.customer.name.toLowerCase().includes(search.toLowerCase()) ||
      b.pickupLocation.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = !statusFilter || b.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginated = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  async function handleDelete(id: string) {
    try {
      const res = await fetch(`/api/bookings/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete booking");
      setBookings((prev) => prev.filter((b) => b.id !== id));
      toast.success("Booking deleted successfully");
    } catch {
      toast.error("Failed to delete booking");
    }
    setDeleteConfirm(null);
  }

  async function handleBatchAction(action: string) {
    const ids = [...selectedIds];
    try {
      const res = await fetch("/api/bookings/batch", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, action }),
      });
      if (!res.ok) throw new Error("Batch operation failed");
      const data = await res.json();
      toast.success(`${data.count} booking${data.count !== 1 ? "s" : ""} ${action === "delete" ? "deleted" : "updated"}`);
      setSelectedIds(new Set());
      setPage(1);
      fetch("/api/bookings")
        .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
        .then(setBookings)
        .catch(() => {});
    } catch {
      toast.error("Batch operation failed");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Bookings</h1>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/api/export/bookings">
              <Download className="mr-2 h-4 w-4" /> Export CSV
            </Link>
          </Button>
          <Button asChild>
            <Link href="/dashboard/bookings/new">
              <Plus className="mr-2 h-4 w-4" /> New Booking
            </Link>
          </Button>
        </div>
      </div>

      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by reference, customer, location..."
            className="pl-9"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <div className="w-48">
          <Select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            options={statusOptions}
          />
        </div>
        {statusFilter && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              setStatusFilter("");
              setPage(1);
            }}
            className="shrink-0"
            title="Clear filter"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {selectedIds.size > 0 && (
        <div className="rounded-lg border bg-muted/50 p-3 flex items-center gap-3">
          <span className="text-sm font-medium">{selectedIds.size} selected</span>
          <div className="flex gap-2 ml-auto">
            <Button
              size="sm"
              onClick={() => handleBatchAction("confirm")}
            >
              Confirm
            </Button>
            <Button
              size="sm"
              onClick={() => handleBatchAction("deliver")}
            >
              Mark Delivered
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => handleBatchAction("cancel")}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => handleBatchAction("delete")}
            >
              Delete
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setSelectedIds(new Set())}
            >
              Clear selection
            </Button>
          </div>
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <TableSkeleton />
          ) : (
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={paginated.length > 0 && paginated.every((b) => selectedIds.has(b.id))}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedIds(new Set([...selectedIds, ...paginated.map((b) => b.id)]));
                        } else {
                          setSelectedIds(new Set([...selectedIds].filter((id) => !paginated.some((b) => b.id === id))));
                        }
                      }}
                    />
                  </TableHead>
                  <TableHead className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Reference</TableHead>
                  <TableHead className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Customer</TableHead>
                  <TableHead className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Pickup</TableHead>
                  <TableHead className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Drop-off</TableHead>
                  <TableHead className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Bags</TableHead>
                  <TableHead className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Total</TableHead>
                  <TableHead className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Status</TableHead>
                  <TableHead className="text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.map((booking) => (
                  <TableRow key={booking.id} className="border-b transition-colors hover:bg-muted/50">
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.has(booking.id)}
                        onCheckedChange={(checked) => {
                          const next = new Set(selectedIds);
                          if (checked) {
                            next.add(booking.id);
                          } else {
                            next.delete(booking.id);
                          }
                          setSelectedIds(next);
                        }}
                      />
                    </TableCell>
                    <TableCell className="font-mono text-xs font-medium text-primary">
                      {booking.referenceNumber}
                    </TableCell>
                    <TableCell className="font-medium">
                      {booking.customer.name}
                    </TableCell>
                    <TableCell className="max-w-[150px] truncate">
                      {booking.pickupLocation}
                    </TableCell>
                    <TableCell className="max-w-[150px] truncate">
                      {booking.dropOffLocation}
                    </TableCell>
                    <TableCell>{booking.numberOfBags}</TableCell>
                    <TableCell>{formatCurrency(booking.totalPrice)}</TableCell>
                    <TableCell>
                      <span className="flex items-center gap-1.5">
                        <span className={`h-1.5 w-1.5 rounded-full ${
                          booking.status === 'DELIVERED' ? 'bg-green-500' :
                          booking.status === 'CANCELLED' ? 'bg-red-500' :
                          booking.status === 'PENDING' ? 'bg-yellow-500' :
                          'bg-blue-500'
                        }`} />
                        {booking.status.replace('_', ' ')}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon" asChild>
                          <Link href={`/dashboard/bookings/${booking.id}`}>
                            <Eye className="h-4 w-4" />
                          </Link>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            setDeleteConfirm({
                              id: booking.id,
                              name: booking.referenceNumber,
                            })
                          }
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {paginated.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                      {bookings.length === 0 ? "No bookings found" : "No bookings match your filters"}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />

      <ConfirmDialog
        open={deleteConfirm !== null}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={() => deleteConfirm && handleDelete(deleteConfirm.id)}
        title="Delete Booking"
        message={`Are you sure you want to delete booking ${deleteConfirm?.name ?? ""}? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  );
}
