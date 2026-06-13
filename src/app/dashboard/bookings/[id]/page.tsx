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
import { ArrowLeft, Mail, Phone, MapPin, Calendar, Package, DollarSign, User, Navigation, Printer, Trash2, Tag, MessageCircle, Clock, Briefcase, Plus } from "lucide-react";
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
  luggagePhotos: string[];
  discount: number;
  checkIn: string;
  checkOut: string | null;
  numberOfBags: number;
  totalPrice: number;
  status: string;
  createdAt: string;
  assignments: { id: string; user: { name: string; email: string } }[];
  payments?: { id: string; amount: number; method: string; status: string; paidAt: string | null }[];
  promoCode?: { code: string } | null;
}

interface Employee {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
}

interface Extension {
  id: string;
  requestedCheckOut: string;
  reason: string | null;
  status: string;
  requestedAt: string;
  reviewedBy?: { name: string } | null;
  reviewedAt?: string | null;
}

interface LuggageItem {
  id: string;
  tagNumber: string;
  description: string | null;
  status: string;
  location: string | null;
  checkInAt: string;
  checkOutAt: string | null;
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



export default function BookingDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [paymentSaving, setPaymentSaving] = useState(false);
  const [extensions, setExtensions] = useState<Extension[]>([]);
  const [reviewing, setReviewing] = useState<string | null>(null);
  const [luggageItems, setLuggageItems] = useState<LuggageItem[]>([]);
  const [addingLuggage, setAddingLuggage] = useState(false);

  useEffect(() => {
    const abort = new AbortController();
    Promise.all([
      fetch(`/api/bookings/${params.id}`, { signal: abort.signal }).then((r) => r.json()),
      fetch("/api/employees", { signal: abort.signal }).then((r) => r.json()),
      fetch(`/api/bookings/${params.id}/extensions`, { signal: abort.signal }).then((r) => r.json()),
      fetch(`/api/bookings/${params.id}/luggage`, { signal: abort.signal }).then((r) => r.json()),
    ]).then(([bookingData, empData, extData, luggageData]) => {
      if (!abort.signal.aborted) {
        setBooking(bookingData);
        setEmployees(empData || []);
        setExtensions(extData || []);
        setLuggageItems(luggageData || []);
      }
    }).catch(() => {});
    return () => abort.abort();
  }, [params.id]);

  async function handleAddLuggage() {
    setAddingLuggage(true);
    try {
      const res = await fetch(`/api/bookings/${params.id}/luggage`, { method: "POST" });
      if (!res.ok) throw new Error();
      const item = await res.json();
      setLuggageItems((prev) => [...prev, item]);
      toast.success(`Added luggage ${item.tagNumber}`);
    } catch {
      toast.error("Failed to add luggage");
    }
    setAddingLuggage(false);
  }

  async function handleUpdateLuggageStatus(itemId: string, status: string) {
    try {
      const res = await fetch(`/api/luggage/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error();
      const updated = await res.json();
      setLuggageItems((prev) => prev.map((i) => i.id === itemId ? { ...i, ...updated } : i));
      toast.success(`Luggage status updated to ${status.replace("_", " ")}`);
    } catch {
      toast.error("Failed to update luggage status");
    }
  }

  async function handleReviewExtension(extId: string, status: string) {
    setReviewing(extId);
    try {
      const res = await fetch(`/api/extensions/${extId}/review`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error();
      const [extData, bookingData] = await Promise.all([
        fetch(`/api/bookings/${params.id}/extensions`).then((r) => r.json()),
        fetch(`/api/bookings/${params.id}`).then((r) => r.json()),
      ]);
      setExtensions(extData || []);
      setBooking(bookingData);
      toast.success(`Extension ${status.toLowerCase()}`);
    } catch {
      toast.error("Failed to review extension");
    }
    setReviewing(null);
  }

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

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result as string;
        const res = await fetch(`/api/bookings/${params.id}/photos`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ photo: base64 }),
        });
        if (res.ok) {
          const data = await res.json();
          setBooking((prev) => prev ? { ...prev, luggagePhotos: data.photos } : prev);
          toast.success("Photo uploaded");
        } else {
          toast.error("Failed to upload photo");
        }
        setUploadingPhoto(false);
      };
      reader.readAsDataURL(file);
    } catch {
      toast.error("Failed to upload photo");
      setUploadingPhoto(false);
    }
  }

  async function handleDeletePhoto(index: number) {
    const res = await fetch(`/api/bookings/${params.id}/photos`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ index }),
    });
    if (res.ok) {
      const data = await res.json();
      setBooking((prev) => prev ? { ...prev, luggagePhotos: data.photos } : prev);
      toast.success("Photo removed");
    } else {
      toast.error("Failed to remove photo");
    }
  }

  async function handleAddPayment(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPaymentSaving(true);
    const formData = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingId: params.id,
          amount: parseFloat(formData.get("amount") as string),
          method: formData.get("method"),
          status: "PAID",
        }),
      });
      if (res.ok) {
        const getRes = await fetch(`/api/bookings/${params.id}`);
        if (getRes.ok) setBooking(await getRes.json());
        setShowPaymentForm(false);
        toast.success("Payment recorded");
      } else {
        toast.error("Failed to record payment");
      }
    } catch {
      toast.error("Failed to record payment");
    }
    setPaymentSaving(false);
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
              <Button variant="outline" className="w-full" asChild>
                <Link href={`/dashboard/chat/${booking.id}`}>
                  <MessageCircle className="mr-2 h-4 w-4" />
                  Chat with Customer
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
          <CardTitle>Luggage Photos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-2 mb-4">
            {booking.luggagePhotos.map((photo, i) => (
              <div key={i} className="relative group">
                <img src={photo} alt={`Luggage ${i + 1}`} className="rounded-lg object-cover w-full h-24" />
                <button
                  onClick={() => handleDeletePhoto(i)}
                  className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={uploadingPhoto} className="relative">
              {uploadingPhoto ? "Uploading..." : "Add Photo"}
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handlePhotoUpload}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
            </Button>
            <span className="text-xs text-muted-foreground">{booking.luggagePhotos.length} photo(s)</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Payment</CardTitle>
            <Button variant="outline" size="sm" onClick={() => setShowPaymentForm(!showPaymentForm)}>
              Record Payment
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {showPaymentForm && (
            <form onSubmit={handleAddPayment} className="flex gap-2 mb-4 p-3 border rounded-lg bg-muted/30">
              <input
                name="amount"
                type="number"
                step="0.01"
                placeholder="Amount"
                required
                className="flex h-9 w-32 rounded-md border border-input bg-background px-3 py-1 text-sm"
              />
              <select
                name="method"
                required
                className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
              >
                <option value="CASH">Cash</option>
                <option value="GCASH">GCash</option>
                <option value="MAYA">Maya</option>
                <option value="CARD">Card</option>
              </select>
              <Button type="submit" size="sm" disabled={paymentSaving}>
                {paymentSaving ? "Saving..." : "Save"}
              </Button>
            </form>
          )}

          {booking.payments && booking.payments.length > 0 ? (
            <div className="divide-y">
              {booking.payments.map((p) => (
                <div key={p.id} className="flex items-center justify-between py-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{formatCurrency(p.amount)}</span>
                    <Badge variant="outline">{p.method}</Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={p.status === "PAID" ? "default" : "secondary"}>{p.status}</Badge>
                    {p.paidAt && <span className="text-muted-foreground text-xs">{formatDate(p.paidAt)}</span>}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No payment recorded</p>
          )}

          {booking.promoCode && (
            <div className="flex items-center gap-2 text-sm text-green-600">
              <Tag className="h-4 w-4" />
              Promo: <strong>{booking.promoCode.code}</strong> (Discount: {formatCurrency(booking.discount)})
            </div>
          )}
        </CardContent>
      </Card>

      {extensions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Extension Requests</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {extensions.map((ext) => (
              <div key={ext.id} className="rounded-lg border p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">Requested: {formatDate(ext.requestedCheckOut)}</span>
                    <Badge variant={ext.status === "APPROVED" ? "default" : ext.status === "REJECTED" ? "destructive" : "warning"}>
                      {ext.status}
                    </Badge>
                  </div>
                  {ext.status === "PENDING" && (
                    <div className="flex gap-2">
                      <Button size="sm" variant="default" onClick={() => handleReviewExtension(ext.id, "APPROVED")} disabled={reviewing === ext.id}>
                        Approve
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => handleReviewExtension(ext.id, "REJECTED")} disabled={reviewing === ext.id}>
                        Reject
                      </Button>
                    </div>
                  )}
                </div>
                {ext.reason && <p className="mt-1 text-sm text-muted-foreground">{ext.reason}</p>}
                <p className="mt-1 text-xs text-muted-foreground">
                  Requested {formatDate(ext.requestedAt)}
                  {ext.reviewedBy && ` · Reviewed by ${ext.reviewedBy.name}`}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Luggage Items</CardTitle>
            <Button variant="outline" size="sm" onClick={handleAddLuggage} disabled={addingLuggage}>
              <Plus className="mr-1 h-4 w-4" />
              Add Bag
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {luggageItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">No luggage items registered</p>
          ) : (
            <div className="divide-y">
              {luggageItems.map((item) => (
                <div key={item.id} className="flex items-center justify-between py-3">
                  <div className="flex items-start gap-3">
                    <div className="rounded-lg bg-primary/10 p-2">
                      <Briefcase className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">{item.tagNumber}</code>
                        <Badge variant={item.status === "DELIVERED" ? "success" : item.status === "CANCELLED" ? "destructive" : item.status === "IN_STORAGE" ? "default" : "secondary"}>
                          {item.status.replace("_", " ")}
                        </Badge>
                      </div>
                      {item.description && <p className="mt-0.5 text-sm text-muted-foreground">{item.description}</p>}
                      {item.location && <p className="text-xs text-muted-foreground">Location: {item.location}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <select
                      value={item.status}
                      onChange={(e) => handleUpdateLuggageStatus(item.id, e.target.value)}
                      className="h-8 rounded border border-input bg-transparent px-2 text-xs"
                    >
                      <option value="CHECKED_IN">Checked In</option>
                      <option value="IN_STORAGE">In Storage</option>
                      <option value="OUT_FOR_DELIVERY">Out for Delivery</option>
                      <option value="DELIVERED">Delivered</option>
                      <option value="CANCELLED">Cancelled</option>
                    </select>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

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
