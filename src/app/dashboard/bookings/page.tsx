"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Eye, Search, Trash2, X, Download, QrCode, Bike } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ExportDialog } from "@/components/ui/export-dialog";
import { TableSkeleton } from "@/components/ui/skeleton";
import { Pagination } from "@/components/ui/pagination";

interface Rider {
  id: string;
  name: string;
  email: string;
  profilePic: string | null;
  vehicleType: string | null;
  plateNumber: string | null;
}

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
  qrScanned: boolean;
  paymentStatus: "full" | "dp" | "unpaid";
  totalPaid: number;
  rider: Rider | null;
}

interface RiderOption {
  id: string;
  name: string;
}

const STATUS_GROUPS = [
  { value: "", label: "All Statuses" },
  { value: "upcoming", label: "Upcoming" },
  { value: "ready", label: "Ready" },
  { value: "received", label: "Received" },
  { value: "in-storage", label: "In Storage Hub" },
  { value: "out-for-delivery", label: "Out for Delivery" },
  { value: "completed", label: "Completed" },
  { value: "ongoing", label: "Ongoing" },
  { value: "delivered", label: "Delivered" },
  { value: "no-show", label: "No Show" },
  { value: "cancelled", label: "Cancelled" },
];

const PAYMENT_OPTIONS = [
  { value: "", label: "All Payments" },
  { value: "full", label: "Paid - Full Payment" },
  { value: "dp", label: "DP - Down Payment Only" },
];

const statusBadge: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-700 border-yellow-300",
  CONFIRMED: "bg-blue-100 text-blue-700 border-blue-300",
  RECEIVED: "bg-purple-100 text-purple-700 border-purple-300",
  IN_STORAGE: "bg-indigo-100 text-indigo-700 border-indigo-300",
  OUT_FOR_DELIVERY: "bg-orange-100 text-orange-700 border-orange-300",
  DELIVERED: "bg-green-100 text-green-700 border-green-300",
  CANCELLED: "bg-red-100 text-red-700 border-red-300",
  NO_SHOW: "bg-orange-100 text-orange-700 border-orange-300",
};

const ITEMS_PER_PAGE = 10;

export default function BookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [riders, setRiders] = useState<RiderOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("");
  const [riderFilter, setRiderFilter] = useState("");
  const [page, setPage] = useState(1);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showExport, setShowExport] = useState(false);

  function buildUrl() {
    const params = new URLSearchParams();
    if (statusFilter) params.set("status", statusFilter);
    if (paymentFilter) params.set("payment", paymentFilter);
    if (riderFilter) params.set("riderId", riderFilter);
    const qs = params.toString();
    return `/api/bookings${qs ? `?${qs}` : ""}`;
  }

  function fetchBookings() {
    setLoading(true);
    fetch(buildUrl())
      .then((res) => { if (!res.ok) throw new Error(); return res.json(); })
      .then(setBookings)
      .catch(() => toast.error("Failed to load bookings"))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    fetchBookings();
      fetch("/api/riders")
      .then((res) => { if (!res.ok) throw new Error(); return res.json(); })
      .then((data) => setRiders(data.map((u: { id: string; name: string }) => ({ id: u.id, name: u.name }))))
      .catch(() => {});
  }, []);

  useEffect(() => {
    setPage(1);
    fetchBookings();
  }, [statusFilter, paymentFilter, riderFilter]);

  const filtered = bookings.filter((b) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      b.referenceNumber.toLowerCase().includes(q) ||
      b.customer.name.toLowerCase().includes(q) ||
      b.pickupLocation.toLowerCase().includes(q)
    );
  });

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginated = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  async function handleDelete(id: string) {
    try {
      const res = await fetch(`/api/bookings/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setBookings((prev) => prev.filter((b) => b.id !== id));
      toast.success("Booking deleted");
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
      if (!res.ok) throw new Error();
      const data = await res.json();
      toast.success(`${data.count} booking${data.count !== 1 ? "s" : ""} ${action === "delete" ? "deleted" : "updated"}`);
      setSelectedIds(new Set());
      setPage(1);
      fetchBookings();
    } catch {
      toast.error("Batch operation failed");
    }
  }

  function clearFilters() {
    setStatusFilter("");
    setPaymentFilter("");
    setRiderFilter("");
    setPage(1);
  }

  const hasActiveFilters = statusFilter || paymentFilter || riderFilter;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Bookings</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowExport(true)}>
            <Download className="mr-2 h-4 w-4" /> Export CSV
          </Button>
          <Button asChild>
            <Link href="/dashboard/bookings/new"><Plus className="mr-2 h-4 w-4" /> New Booking</Link>
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search reference, customer, location..."
            className="pl-9"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <div className="w-44">
          <Select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} options={STATUS_GROUPS} />
        </div>
        <div className="w-48">
          <Select value={paymentFilter} onChange={(e) => { setPaymentFilter(e.target.value); setPage(1); }} options={PAYMENT_OPTIONS} />
        </div>
        <div className="w-44">
          <select
            value={riderFilter}
            onChange={(e) => { setRiderFilter(e.target.value); setPage(1); }}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm"
          >
            <option value="">All Riders</option>
            {riders.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
        </div>
        {hasActiveFilters && (
          <Button variant="ghost" size="icon" onClick={clearFilters} title="Clear all filters">
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {selectedIds.size > 0 && (
        <div className="rounded-lg border bg-muted/50 p-3 flex items-center gap-3">
          <span className="text-sm font-medium">{selectedIds.size} selected</span>
          <div className="flex gap-2 ml-auto">
            <Button size="sm" onClick={() => handleBatchAction("confirm")}>Confirm</Button>
            <Button size="sm" onClick={() => handleBatchAction("deliver")}>Mark Delivered</Button>
            <Button size="sm" variant="secondary" onClick={() => handleBatchAction("cancel")}>Cancel</Button>
            <Button size="sm" variant="destructive" onClick={() => handleBatchAction("delete")}>Delete</Button>
            <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>Clear</Button>
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
                        if (checked) setSelectedIds(new Set([...selectedIds, ...paginated.map((b) => b.id)]));
                        else setSelectedIds(new Set([...selectedIds].filter((id) => !paginated.some((b) => b.id === id))));
                      }}
                    />
                  </TableHead>
                  <TableHead className="text-xs font-medium uppercase">Reference</TableHead>
                  <TableHead className="text-xs font-medium uppercase">Customer</TableHead>
                  <TableHead className="text-xs font-medium uppercase">Pickup</TableHead>
                  <TableHead className="text-xs font-medium uppercase">Drop-off</TableHead>
                  <TableHead className="text-xs font-medium uppercase text-center">Bags</TableHead>
                  <TableHead className="text-xs font-medium uppercase">Payment</TableHead>
                  <TableHead className="text-xs font-medium uppercase text-center">QR Scan</TableHead>
                  <TableHead className="text-xs font-medium uppercase">Rider</TableHead>
                  <TableHead className="text-xs font-medium uppercase">Status</TableHead>
                  <TableHead className="text-right text-xs font-medium uppercase">Actions</TableHead>
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
                          checked ? next.add(booking.id) : next.delete(booking.id);
                          setSelectedIds(next);
                        }}
                      />
                    </TableCell>
                    <TableCell className="font-mono text-xs font-medium text-primary">
                      <Link href={`/dashboard/bookings/${booking.id}`} className="hover:underline">
                        {booking.referenceNumber}
                      </Link>
                    </TableCell>
                    <TableCell className="font-medium text-sm">{booking.customer.name}</TableCell>
                    <TableCell className="max-w-[140px] truncate text-xs">{booking.pickupLocation}</TableCell>
                    <TableCell className="max-w-[140px] truncate text-xs">{booking.dropOffLocation}</TableCell>
                    <TableCell className="text-center text-sm">{booking.numberOfBags}</TableCell>
                    <TableCell>
                      <PaymentBadge status={booking.paymentStatus} total={booking.totalPrice} paid={booking.totalPaid} />
                    </TableCell>
                    <TableCell className="text-center">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${
                        booking.qrScanned
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-500"
                      }`}>
                        <QrCode className="h-3 w-3" />
                        {booking.qrScanned ? "Scanned" : "Unscanned"}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm">
                      {booking.rider ? (
                        <span className="flex items-center gap-1.5">
                          <Bike className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-xs">{booking.rider.name}</span>
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className={`inline-block rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${statusBadge[booking.status] || "bg-gray-100 text-gray-700"}`}>
                        {booking.status === "OUT_FOR_DELIVERY" ? "Out for Delivery" :
                         booking.status === "IN_STORAGE" ? "In Storage" :
                         booking.status === "NO_SHOW" ? "No Show" :
                         booking.status.replace("_", " ")}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" asChild>
                          <Link href={`/dashboard/bookings/${booking.id}`}><Eye className="h-4 w-4" /></Link>
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setDeleteConfirm({ id: booking.id, name: booking.referenceNumber })}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {paginated.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center text-muted-foreground py-8">
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
        message={`Are you sure you want to delete booking ${deleteConfirm?.name ?? ""}?`}
        confirmLabel="Delete"
        variant="danger"
      />

      <ExportDialog open={showExport} onClose={() => setShowExport(false)} />
    </div>
  );
}

function PaymentBadge({ status, total, paid }: { status: string; total: number; paid: number }) {
  if (total === 0) return <span className="text-xs text-muted-foreground">—</span>;
  if (status === "full") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-bold text-green-700">
        <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
        Full
      </span>
    );
  }
  if (status === "dp") {
    return (
      <div className="flex flex-col items-start gap-0.5">
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-700">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
          DP
        </span>
                        <span className="text-[10px] text-muted-foreground">{formatCurrency(total - paid)} left</span>
      </div>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-bold text-gray-500">
      Unpaid
    </span>
  );
}
