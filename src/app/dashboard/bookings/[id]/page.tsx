"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate, formatCurrency } from "@/lib/utils";
import { ArrowLeft, Mail, Phone, MapPin, Calendar, Package, DollarSign, User, Navigation, Printer } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Skeleton } from "@/components/ui/skeleton";

interface Booking {
  id: string;
  referenceNumber: string;
  customer: { id: string; name: string; email: string; phone: string };
  location?: { id: string; name: string; city: string; address: string; pricePerDay: number };
  user?: { id: string; name: string; email: string };
  pickupLocation: string;
  dropOffLocation: string;
  luggageDetails: string | null;
  checkIn: string;
  checkOut: string | null;
  numberOfBags: number;
  totalPrice: number;
  status: string;
  createdAt: string;
  assignments: { id: string; user: { name: string; email: string } }[];
}

interface Employee {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
}

const statusOptions = [
  { value: "PENDING", label: "Pending" },
  { value: "CONFIRMED", label: "Confirmed" },
  { value: "RECEIVED", label: "Received" },
  { value: "IN_STORAGE", label: "In Storage" },
  { value: "OUT_FOR_DELIVERY", label: "Out for Delivery" },
  { value: "DELIVERED", label: "Delivered" },
  { value: "CANCELLED", label: "Cancelled" },
];

const statusVariant: Record<string, "default" | "secondary" | "success" | "warning" | "destructive" | "outline"> = {
  PENDING: "warning",
  CONFIRMED: "secondary",
  RECEIVED: "default",
  IN_STORAGE: "default",
  OUT_FOR_DELIVERY: "default",
  DELIVERED: "success",
  CANCELLED: "destructive",
};

export default function BookingDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  useEffect(() => {
    const abort = new AbortController();
    Promise.all([
      fetch(`/api/bookings/${params.id}`, { signal: abort.signal }).then((r) => r.json()),
      fetch("/api/employees", { signal: abort.signal }).then((r) => r.json()),
    ]).then(([bookingData, empData]) => {
      if (!abort.signal.aborted) {
        setBooking(bookingData);
        setEmployees(empData || []);
      }
    }).catch(() => {});
    return () => abort.abort();
  }, [params.id]);

  async function handleStatusChange(e: React.ChangeEvent<HTMLSelectElement>) {
    setSaving(true);
    try {
      const res = await fetch(`/api/bookings/${params.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: e.target.value }),
      });
      if (!res.ok) throw new Error("Failed to update status");
      const getRes = await fetch(`/api/bookings/${params.id}`);
      if (!getRes.ok) throw new Error("Failed to reload booking");
      const updated = await getRes.json();
      setBooking(updated);
      toast.success("Status updated successfully");
    } catch {
      toast.error("Failed to update status");
    }
    setSaving(false);
  }

  async function handleAssign(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    const formData = new FormData(e.currentTarget);
    const userId = formData.get("employeeId") as string;
    if (userId) {
      try {
        const res = await fetch(`/api/bookings/${params.id}/assign`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId }),
        });
        if (!res.ok) throw new Error("Failed to assign employee");
        const getRes = await fetch(`/api/bookings/${params.id}`);
        if (!getRes.ok) throw new Error("Failed to reload booking");
        const updated = await getRes.json();
        setBooking(updated);
        toast.success("Employee assigned successfully");
      } catch {
        toast.error("Failed to assign employee");
      }
    }
    setSaving(false);
  }

  async function handleDelete() {
    try {
      const res = await fetch(`/api/bookings/${params.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete booking");
      toast.success("Booking deleted successfully");
      router.push("/dashboard/bookings");
    } catch {
      toast.error("Failed to delete booking");
    }
    setDeleteConfirm(false);
  }

  if (!booking) {
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-8 w-64" />
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-60 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" asChild>
          <Link href="/dashboard/bookings">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Link>
        </Button>
        <h1 className="text-2xl font-bold">
          Booking {booking.referenceNumber}
        </h1>
        <span className="ml-auto flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium">
          <span className={`h-1.5 w-1.5 rounded-full ${
            booking.status === 'DELIVERED' ? 'bg-green-500' :
            booking.status === 'CANCELLED' ? 'bg-red-500' :
            booking.status === 'PENDING' ? 'bg-yellow-500' :
            'bg-blue-500'
          }`} />
          {booking.status.replace('_', ' ')}
        </span>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="border-t-2 border-t-blue-500">
          <CardHeader>
            <CardTitle>Customer Info</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="font-medium">{booking.customer.name}</p>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Mail className="h-4 w-4 shrink-0" />
              <span>{booking.customer.email}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Phone className="h-4 w-4 shrink-0" />
              <span>{booking.customer.phone}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-t-2 border-t-violet-500">
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-100">
                <MapPin className="h-4 w-4 text-violet-600" />
              </div>
              <CardTitle>Pickup & Drop-off</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">Pickup Location</p>
              <p className="font-medium">{booking.pickupLocation}</p>
            </div>
            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">Drop-off Location</p>
              <p className="font-medium">{booking.dropOffLocation}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-t-2 border-t-emerald-500">
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100">
                <Package className="h-4 w-4 text-emerald-600" />
              </div>
              <CardTitle>Booking Details</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2">
              <span className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="h-4 w-4" />
                Scheduled
              </span>
              <span className="font-medium">{formatDate(booking.checkIn)}</span>
            </div>
            {booking.checkOut && (
              <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  Completed
                </span>
                <span className="font-medium">{formatDate(booking.checkOut)}</span>
              </div>
            )}
            <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2">
              <span className="flex items-center gap-2 text-muted-foreground">
                <Package className="h-4 w-4" />
                Bags
              </span>
              <span>{booking.numberOfBags}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2 font-medium">
              <span className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                Total
              </span>
              <span>{formatCurrency(booking.totalPrice)}</span>
            </div>
            {booking.user && (
              <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <User className="h-4 w-4" />
                  Created by
                </span>
                <span className="font-medium">{booking.user.name}</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-t-2 border-t-amber-500">
          <CardHeader>
            <CardTitle>Update Status</CardTitle>
            <CardDescription>Change booking status</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <select
                id="status"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={booking.status}
                onChange={handleStatusChange}
                disabled={saving}
              >
                {statusOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <form onSubmit={handleAssign} className="space-y-2">
              <Label htmlFor="employeeId">Assign Employee</Label>
              <div className="flex gap-2">
                <select
                  id="employeeId"
                  name="employeeId"
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="">Select employee...</option>
                  {employees
                    .filter((e) => e.isActive !== false)
                    .map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.name}
                      </option>
                    ))}
                </select>
                <Button type="submit" disabled={saving}>
                  Assign
                </Button>
              </div>
            </form>

            <div className="space-y-2">
              <Button variant="outline" className="w-full" asChild>
                <Link href={`/track/map/${booking.referenceNumber}`}>
                  <Navigation className="mr-2 h-4 w-4" />
                  Live Map
                </Link>
              </Button>
              <Button variant="outline" className="w-full" asChild>
                <Link href={`/dashboard/bookings/${booking.id}/receipt`}>
                  <Printer className="mr-2 h-4 w-4" />
                  Receipt
                </Link>
              </Button>
            </div>

            <div className="border-t pt-4">
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-destructive">Danger Zone</p>
              <Button
                variant="destructive"
                onClick={() => setDeleteConfirm(true)}
                className="w-full"
              >
                Delete Booking
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {booking.luggageDetails && (
        <Card>
          <CardHeader>
            <CardTitle>Luggage Details</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{booking.luggageDetails}</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Assigned Employees</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Name</TableHead>
                <TableHead className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Email</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {booking.assignments?.map((a) => (
                <TableRow key={a.id} className="border-b transition-colors hover:bg-muted/50">
                  <TableCell className="font-medium">{a.user.name}</TableCell>
                  <TableCell>{a.user.email}</TableCell>
                </TableRow>
              ))}
              {(!booking.assignments || booking.assignments.length === 0) && (
                <TableRow>
                  <TableCell colSpan={2} className="text-center text-muted-foreground py-8">
                    No employees assigned
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={deleteConfirm}
        onClose={() => setDeleteConfirm(false)}
        onConfirm={handleDelete}
        title="Delete Booking"
        message={`Are you sure you want to delete booking ${booking.referenceNumber}? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  );
}
