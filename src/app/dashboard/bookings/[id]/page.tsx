"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
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
import {
  ArrowLeft, Mail, Phone, MapPin, Calendar, Package,
  User, Navigation, Printer, Trash2, Tag, MessageCircle, Clock,
  Briefcase, Plus, Edit3, AlertTriangle, X, CheckCircle, ShieldAlert,
  Wrench, ShoppingBag, CreditCard, Receipt, Ban, UserX,
  RotateCcw, History, Flag, Check, XCircle, ChevronDown, Activity, Camera, Loader2,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Skeleton } from "@/components/ui/skeleton";

interface Booking {
  id: string;
  referenceNumber: string;
  customer: { id: string; name: string; email: string; phone: string; countryOfOrigin?: string; cityOfOrigin?: string };
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
  pickupStartedAt: string | null;
  assignments: { id: string; phase: string; user: { id: string; name: string; email: string } }[];
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
  flag: string | null;
  checkInAt: string;
  checkOutAt: string | null;
}

interface AvailableTag {
  id: string;
  tagNumber: string;
  isUsed: boolean;
}

const statusOptions = [
  { value: "PENDING", label: "Pending" },
  { value: "CONFIRMED", label: "Confirmed" },
  { value: "RECEIVED", label: "Received" },
  { value: "IN_STORAGE", label: "In Storage" },
  { value: "OUT_FOR_DELIVERY", label: "Out for Delivery" },
  { value: "DELIVERED", label: "Delivered" },
];

const ADDITIONAL_SERVICES = [
  { id: "pickup", name: "Pick-up from Customer", price: 180, icon: "📦", description: "We pick up the luggage from the customer" },
  { id: "delivery", name: "Deliver to Customer", price: 180, icon: "🚚", description: "We deliver the luggage to the customer" },
];

export default function BookingDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [paymentSaving, setPaymentSaving] = useState(false);
  const [extensions, setExtensions] = useState<Extension[]>([]);
  const [reviewing, setReviewing] = useState<string | null>(null);
  const [luggageItems, setLuggageItems] = useState<LuggageItem[]>([]);
  const [addingLuggage, setAddingLuggage] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [selectedServices, setSelectedServices] = useState<Set<string>>(new Set());
  const [serviceNote, setServiceNote] = useState("");
  const [dangerModal, setDangerModal] = useState<{ action: "no-show" | "cancelled"; mode: "admin" | "report" } | null>(null);
  const [dangerPhoto, setDangerPhoto] = useState<string | null>(null);
  const [dangerNote, setDangerNote] = useState("");
  const [dangerSubmitting, setDangerSubmitting] = useState(false);
  const dangerFileRef = useRef<HTMLInputElement>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [settleAmount, setSettleAmount] = useState<number>(0);
  const [settleMethod, setSettleMethod] = useState("CASH");
  const [refundAmount, setRefundAmount] = useState(0);
  const [refundReason, setRefundReason] = useState("");
  const [refundMethod, setRefundMethod] = useState("CASH");
  const [refunding, setRefunding] = useState(false);
  const [showRefundForm, setShowRefundForm] = useState(false);
  const [logs, setLogs] = useState<{ id: string; action: string; entity: string; details: string | null; createdAt: string; user: { name: string } | null }[]>([]);
  const [showLog, setShowLog] = useState(false);
  const [logsLoading, setLogsLoading] = useState(false);
  const [availableTags, setAvailableTags] = useState<AvailableTag[]>([]);
  const [selectedTagNumbers, setSelectedTagNumbers] = useState<Set<string>>(new Set());
  const [requestingTags, setRequestingTags] = useState(false);
  const [flaggableItem, setFlaggableItem] = useState<string | null>(null);

  useEffect(() => {
    const abort = new AbortController();
    Promise.all([
      fetch(`/api/bookings/${params.id}`, { signal: abort.signal }).then((r) => r.json()),
      fetch("/api/employees", { signal: abort.signal }).then((r) => r.json()),
      fetch(`/api/bookings/${params.id}/extensions`, { signal: abort.signal }).then((r) => r.json()),
      fetch(`/api/bookings/${params.id}/luggage`, { signal: abort.signal }).then((r) => r.json()),
      fetch("/api/baggage-tags/available", { signal: abort.signal }).then((r) => r.json()),
    ]).then(([bookingData, empData, extData, luggageData, tagData]) => {
      if (!abort.signal.aborted) {
        setBooking(bookingData);
        setEmployees(Array.isArray(empData) ? empData : []);
        setExtensions(Array.isArray(extData) ? extData : []);
        setLuggageItems(Array.isArray(luggageData) ? luggageData : []);
        setAvailableTags(Array.isArray(tagData?.tags) ? tagData.tags : []);
        const paid = (bookingData?.payments || [])
          .filter((p: { status: string }) => p.status === "PAID")
          .reduce((s: number, p: { amount: number }) => s + p.amount, 0);
        setSettleAmount(bookingData && bookingData.totalPrice - paid > 0 ? bookingData.totalPrice - paid : 0);
      }
    }).catch(() => {});
    return () => abort.abort();
  }, [params.id]);

  useEffect(() => {
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((s) => {
        setUserRole(s?.user?.role || null);
      })
      .catch(() => setUserRole(null));
  }, []);

  const totalPaid = (booking?.payments || [])
    .filter((p) => p.status === "PAID")
    .reduce((s, p) => s + p.amount, 0);
  const balance = booking ? booking.totalPrice - totalPaid : 0;
  const paymentStatus = !booking ? "unpaid" :
    totalPaid >= booking.totalPrice && booking.totalPrice > 0 ? "full" :
    totalPaid > 0 ? "dp" : "unpaid";
  const bookingLocked = booking ? ["CANCELLED", "NO_SHOW"].includes(booking.status) : false;

  function reloadBooking() {
    fetch(`/api/bookings/${params.id}`)
      .then((r) => r.json())
      .then((bookingData) => {
        setBooking(bookingData);
        const paid = (bookingData?.payments || [])
          .filter((p: { status: string }) => p.status === "PAID")
          .reduce((s: number, p: { amount: number }) => s + p.amount, 0);
        setSettleAmount(bookingData && bookingData.totalPrice - paid > 0 ? bookingData.totalPrice - paid : 0);
      })
      .catch(() => toast.error("Failed to reload booking"));
  }

  async function handleAddLuggage() {
    if (!booking) return;
    setAddingLuggage(true);
    try {
      const res = await fetch(`/api/bookings/${params.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ numberOfBags: booking.numberOfBags + 1, totalPrice: booking.totalPrice + 100 }),
      });
      const result = await res.json().catch(() => null);
      if (!res.ok) throw new Error(result?.error || "Failed to add baggage");
      reloadBooking();
      toast.success("Additional baggage added. Select an available physical tag below.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Failed to add luggage"); }
    setAddingLuggage(false);
  }

  async function handleUpdateLuggageStatus(itemId: string, status: string) {
    try {
      const res = await fetch(`/api/luggage/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.error || "Failed to update luggage status");
      }
      const updated = await res.json();
      setLuggageItems((prev) => prev.map((i) => i.id === itemId ? { ...i, ...updated } : i));
      toast.success(`Luggage status updated to ${status.replace("_", " ")}`);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Failed to update luggage status"); }
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
    } catch { toast.error("Failed to review extension"); }
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
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.error || "Failed to update status");
      }
      const getRes = await fetch(`/api/bookings/${params.id}`);
      if (!getRes.ok) throw new Error("Failed to reload booking");
      const updated = await getRes.json();
      setBooking(updated);
      toast.success("Status updated successfully");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Failed to update status"); }
    setSaving(false);
  }

  async function handleAssign(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    const formData = new FormData(e.currentTarget);
    const userId = formData.get("employeeId") as string;
    const phase = formData.get("phase") as string;
    if (userId) {
      try {
        const res = await fetch(`/api/bookings/${params.id}/assign`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId, phase }),
        });
        if (!res.ok) {
          const error = await res.json().catch(() => ({}));
          throw new Error(error.error || "Failed to assign employee");
        }
        const getRes = await fetch(`/api/bookings/${params.id}`);
        if (!getRes.ok) throw new Error("Failed to reload booking");
        const updated = await getRes.json();
        setBooking(updated);
        toast.success("Employee assigned successfully");
      } catch (error) { toast.error(error instanceof Error ? error.message : "Failed to assign employee"); }
    }
    setSaving(false);
  }

  async function handleDelete() {
    try {
      const res = await fetch(`/api/bookings/${params.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete booking");
      toast.success("Booking deleted successfully");
      router.push("/dashboard/bookings");
    } catch { toast.error("Failed to delete booking"); }
    setDeleteConfirm(false);
  }

  function handleDangerPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => setDangerPhoto(reader.result as string);
    reader.readAsDataURL(file);
  }

  async function handleDangerConfirm() {
    if (!dangerModal) return;
    setDangerSubmitting(true);
    try {
      if (dangerModal.mode === "admin") {
        const body: Record<string, unknown> = {
          status: dangerModal.action === "no-show" ? "NO_SHOW" : "CANCELLED",
          note: dangerNote || undefined,
        };
        if (dangerPhoto) body.photo = dangerPhoto;
        if (navigator.geolocation) {
          try {
            const pos = await new Promise<GeolocationPosition>((res, rej) =>
              navigator.geolocation.getCurrentPosition(res, rej, { timeout: 5000 }));
            body.latitude = pos.coords.latitude;
            body.longitude = pos.coords.longitude;
          } catch {}
        }
        const res = await fetch(`/api/bookings/${params.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Failed to update booking");
        }
        toast.success(`Booking marked as ${dangerModal.action === "no-show" ? "No Show" : "Cancelled"}`);
      } else {
        const res = await fetch("/api/incidents", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            bookingId: params.id,
            customerId: booking?.customer?.id,
            type: dangerModal.action === "no-show" ? "no_show" : "cancellation",
            description: dangerNote || `${dangerModal.action === "no-show" ? "No-show" : "Cancellation"} report for booking ${booking?.referenceNumber}`,
            photo: dangerPhoto || undefined,
            note: dangerNote || undefined,
          }),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Failed to submit report");
        }
        toast.success("Report submitted — forwarded to an admin for review");
      }
      setDangerModal(null);
      setDangerPhoto(null);
      setDangerNote("");
      reloadBooking();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action failed");
    } finally {
      setDangerSubmitting(false);
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
        reloadBooking();
        setShowPaymentForm(false);
        toast.success("Payment recorded");
      } else toast.error("Failed to record payment");
    } catch { toast.error("Failed to record payment"); }
    setPaymentSaving(false);
  }

  async function handleSettleBalance() {
    if (settleAmount <= 0) return toast.error("Invalid amount");
    setPaymentSaving(true);
    try {
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingId: params.id,
          amount: settleAmount,
          method: settleMethod,
          status: "PAID",
        }),
      });
      if (res.ok) {
        reloadBooking();
        toast.success("Balance settled — booking marked as fully paid");
      } else toast.error("Failed to settle balance");
    } catch { toast.error("Failed to settle balance"); }
    setPaymentSaving(false);
  }

  async function handleEditSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setEditSaving(true);
    const formData = new FormData(e.currentTarget);
    const body: Record<string, unknown> = {};
    for (const [key, val] of formData.entries()) {
      if (key === "checkIn" || key === "checkOut") body[key] = val;
      else if (key === "numberOfBags") body[key] = parseInt(val as string);
      else if (key === "totalPrice") body[key] = parseFloat(val as string);
      else body[key] = val;
    }
    try {
      const res = await fetch(`/api/bookings/${params.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Failed to update");
      reloadBooking();
      setShowEditModal(false);
      toast.success("Booking updated");
    } catch { toast.error("Failed to update booking"); }
    setEditSaving(false);
  }

  async function handleAddServices() {
    const total = ADDITIONAL_SERVICES
      .filter((s) => selectedServices.has(s.id))
      .reduce((sum, s) => sum + s.price, 0);
    if (total === 0) return toast.error("Select at least one service");

    const serviceNames = ADDITIONAL_SERVICES
      .filter((s) => selectedServices.has(s.id))
      .map((s) => s.name);

    let newDetails: string;
    try {
      const parsed = booking?.luggageDetails ? JSON.parse(booking.luggageDetails) : [];
      if (Array.isArray(parsed)) {
        const servicesEntry = parsed.find((item: Record<string, unknown>) => item && Array.isArray(item.services));
        if (servicesEntry) {
          const existing = (servicesEntry.services as string[]) || [];
          servicesEntry.services = Array.from(new Set([...existing, ...serviceNames]));
        } else {
          parsed.push({ services: serviceNames });
        }
        newDetails = JSON.stringify(parsed);
      } else {
        const note = `[Additional Services: ${serviceNames.join(", ")} — +₱${total}]${serviceNote ? ` - ${serviceNote}` : ""}`;
        newDetails = booking?.luggageDetails ? `${booking.luggageDetails}\n${note}` : note;
      }
    } catch {
      const note = `[Additional Services: ${serviceNames.join(", ")} — +₱${total}]${serviceNote ? ` - ${serviceNote}` : ""}`;
      newDetails = booking?.luggageDetails ? `${booking.luggageDetails}\n${note}` : note;
    }
    try {
      const res = await fetch(`/api/bookings/${params.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          luggageDetails: newDetails,
          totalPrice: (booking?.totalPrice || 0) + total,
        }),
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.error || "Failed to add services");
      }
      reloadBooking();
      setSelectedServices(new Set());
      setServiceNote("");
      toast.success(`Added services (${serviceNames.join(", ")}) — total adjusted`);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Failed to add services"); }
  }

  async function handleRefund() {
    if (!refundAmount || refundAmount <= 0) return toast.error("Invalid refund amount");
    if (!refundReason.trim()) return toast.error("Refund reason is required");
    setRefunding(true);
    try {
      const res = await fetch(`/api/bookings/${params.id}/refund`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: refundAmount, reason: refundReason, paymentMethod: refundMethod }),
      });
      if (res.ok) {
        reloadBooking();
        setShowRefundForm(false);
        setRefundReason("");
        toast.success(`Refund of ${formatCurrency(refundAmount)} issued`);
      } else {
        const err = await res.json();
        toast.error(err.error || "Failed to issue refund");
      }
    } catch { toast.error("Failed to issue refund"); }
    setRefunding(false);
  }

  async function handleLoadLogs() {
    if (showLog) { setShowLog(false); return; }
    setLogsLoading(true);
    setShowLog(true);
    try {
      const res = await fetch(`/api/bookings/${params.id}/log`);
      if (res.ok) setLogs(await res.json());
    } catch { setLogs([]); }
    setLogsLoading(false);
  }

  async function handleRequestTags() {
    if (selectedTagNumbers.size < 1) return toast.error("Select at least one available tag");
    const maxBags = booking?.numberOfBags || 3;
    if (luggageItems.length >= maxBags) return toast.error(`Maximum ${maxBags} baggage tag(s) per booking`);
    if (luggageItems.length + selectedTagNumbers.size > maxBags) {
      return toast.error(`Can only assign ${maxBags - luggageItems.length} more tag(s). Maximum is ${maxBags}.`);
    }
    setRequestingTags(true);
    try {
      const res = await fetch("/api/baggage-tags/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId: params.id, tagNumbers: [...selectedTagNumbers] }),
      });
      if (res.ok) {
        const items = await res.json();
        setLuggageItems((prev) => [...prev, ...items]);
        toast.success(`Assigned ${items.length} baggage tag(s)`);
        setAvailableTags((prev) => prev.map((tag) => selectedTagNumbers.has(tag.tagNumber) ? { ...tag, isUsed: true } : tag));
        setSelectedTagNumbers(new Set());
      } else {
        const err = await res.json();
        toast.error(err.error || "Failed to request tags");
      }
    } catch { toast.error("Failed to request tags"); }
    setRequestingTags(false);
  }

  async function handleApproveTag(itemId: string, action: "APPROVED" | "REJECTED") {
    try {
      const res = await fetch("/api/baggage-tags/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemIds: [itemId], action }),
      });
      if (res.ok) {
        const updatedStatus = action === "APPROVED" ? "CHECKED_IN" : "CANCELLED";
        setLuggageItems((prev) => prev.map((i) => i.id === itemId ? { ...i, status: updatedStatus } : i));
        toast.success(`Tag ${action === "APPROVED" ? "approved" : "rejected"}`);
      } else toast.error("Failed to process tag");
    } catch { toast.error("Failed to process tag"); }
  }

  async function handleFlagLuggage(itemId: string) {
    try {
      const res = await fetch(`/api/luggage/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ flag: "LOST" }),
      });
      if (res.ok) {
        setLuggageItems((prev) => prev.map((i) => i.id === itemId ? { ...i, flag: "LOST" } : i));
        toast.success("Baggage reported as lost");
      } else toast.error("Failed to report baggage");
    } catch { toast.error("Failed to report baggage"); }
    setFlaggableItem(null);
  }

  if (!booking) {
    return (
      <div className="mx-auto max-w-5xl space-y-6">
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
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" asChild>
          <Link href="/dashboard/bookings">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back
          </Link>
        </Button>
        <h1 className="text-2xl font-bold">Booking {booking.referenceNumber}</h1>
        <span className={`ml-auto inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium ${
          booking.status === "DELIVERED" ? "border-green-300 bg-green-50 text-green-700" :
          booking.status === "CANCELLED" ? "border-red-300 bg-red-50 text-red-700" :
          booking.status === "NO_SHOW" ? "border-orange-300 bg-orange-50 text-orange-700" :
          booking.status === "PENDING" ? "border-yellow-300 bg-yellow-50 text-yellow-700" :
          "border-blue-300 bg-blue-50 text-blue-700"
        }`}>
          <span className={`h-1.5 w-1.5 rounded-full ${
            booking.status === "DELIVERED" ? "bg-green-500" :
            booking.status === "CANCELLED" ? "bg-red-500" :
            booking.status === "NO_SHOW" ? "bg-orange-500" :
            booking.status === "PENDING" ? "bg-yellow-500" :
            "bg-blue-500"
          }`} />
          {booking.status === "NO_SHOW" ? "No Show" : booking.status.replace("_", " ")}
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
            {(booking.customer.countryOfOrigin || booking.customer.cityOfOrigin) && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4 shrink-0" />
                <span>{[booking.customer.cityOfOrigin, booking.customer.countryOfOrigin].filter(Boolean).join(", ")}</span>
              </div>
            )}
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
      </div>

      <div className="grid gap-6 md:grid-cols-2">
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
                <Calendar className="h-4 w-4" /> Pickup
              </span>
              <span className="font-medium">{formatDate(booking.checkIn)}</span>
            </div>
            {booking.checkOut && (
              <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="h-4 w-4" /> Delivery
                </span>
                <span className="font-medium">{formatDate(booking.checkOut)}</span>
              </div>
            )}
            <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2">
              <span className="flex items-center gap-2 text-muted-foreground">
                <Package className="h-4 w-4" /> Bags
              </span>
              <span>{booking.numberOfBags}</span>
            </div>
            {booking.promoCode && (
              <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Tag className="h-4 w-4" /> Promo
                </span>
                <span className="font-medium text-green-600">{booking.promoCode.code} ({formatCurrency(booking.discount)})</span>
              </div>
            )}
            {booking.user && (
              <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <User className="h-4 w-4" /> Created by
                </span>
                <span className="font-medium">{booking.user.name}</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-t-2 border-t-amber-500">
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-100">
                <Receipt className="h-4 w-4 text-amber-600" />
              </div>
              <CardTitle>Payment Summary</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Charges Breakdown</p>
              <div className="flex items-center justify-between text-sm">
                <span>Subtotal ({booking.numberOfBags} bag{booking.numberOfBags > 1 ? "s" : ""})</span>
                <span>{formatCurrency(booking.totalPrice + (booking.promoCode ? booking.discount : 0))}</span>
              </div>
              {booking.numberOfBags > 3 && (
                <div className="flex items-center justify-between text-sm text-amber-600">
                  <span>Extra bag fee ({booking.numberOfBags - 3} × ₱100)</span>
                  <span>+{formatCurrency((booking.numberOfBags - 3) * 100)}</span>
                </div>
              )}
              {booking.promoCode && (
                <div className="flex items-center justify-between text-sm text-green-600">
                  <span>Promo Discount</span>
                  <span>-{formatCurrency(booking.discount)}</span>
                </div>
              )}
              <div className="flex items-center justify-between font-medium border-t pt-2">
                <span>Grand Total</span>
                <span>{formatCurrency(booking.totalPrice)}</span>
              </div>
            </div>

            {booking.payments && booking.payments.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Payment History</p>
                <div className="divide-y rounded-lg border">
                  {booking.payments.map((p) => (
                    <div key={p.id} className="flex items-center justify-between px-3 py-2 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{formatCurrency(p.amount)}</span>
                        <Badge variant="outline">{p.method}</Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={p.status === "PAID" ? "default" : "secondary"}>{p.status}</Badge>
                        {p.paidAt && <span className="text-xs text-muted-foreground">{formatDate(p.paidAt)}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="rounded-lg border p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Payment Status</span>
                <PaymentStatusBadge status={paymentStatus} />
              </div>
              {paymentStatus !== "unpaid" && (
                <div className="flex items-center justify-between text-sm">
                  <span>Total Paid</span>
                  <span className="font-medium">{formatCurrency(totalPaid)}</span>
                </div>
              )}
              {paymentStatus === "dp" && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-destructive">Balance Due</span>
                  <span className="font-medium text-destructive">{formatCurrency(balance)}</span>
                </div>
              )}
            </div>

            {paymentStatus === "dp" && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium text-amber-800">
                  <CreditCard className="h-4 w-4" />
                  Settle Remaining Balance
                </div>
                <p className="text-xs text-amber-700">
                  Balance due: <strong>{formatCurrency(balance)}</strong>
                </p>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={settleAmount}
                    onChange={(e) => setSettleAmount(parseFloat(e.target.value) || 0)}
                    max={balance}
                    className="flex h-9 w-28 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                  />
                  <select
                    value={settleMethod}
                    onChange={(e) => setSettleMethod(e.target.value)}
                    className="flex h-9 flex-1 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                  >
                    <option value="CASH">Cash</option>
                    <option value="GCASH">GCash</option>
                    <option value="MAYA">Maya</option>
                    <option value="CARD">Card</option>
                  </select>
                  <Button size="sm" onClick={handleSettleBalance} disabled={paymentSaving || settleAmount <= 0}>
                    {paymentSaving ? "..." : "Pay"}
                  </Button>
                </div>
              </div>
            )}

            <Button variant="outline" size="sm" className="w-full" onClick={() => setShowPaymentForm(!showPaymentForm)}>
              <Plus className="mr-1 h-4 w-4" />
              {showPaymentForm ? "Cancel" : "Record Additional Payment"}
            </Button>
            {showPaymentForm && (
              <form onSubmit={handleAddPayment} className="flex gap-2 p-3 border rounded-lg bg-muted/30">
                <input
                  name="amount" type="number" step="0.01" placeholder="Amount" required
                  className="flex h-9 w-28 rounded-md border border-input bg-background px-3 py-1 text-sm"
                />
                <select name="method" required className="flex h-9 flex-1 rounded-md border border-input bg-background px-3 py-1 text-sm">
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

            <div className="border-t pt-4 mt-2">
              <button
                onClick={() => setShowRefundForm(!showRefundForm)}
                className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium hover:bg-muted transition-colors"
              >
                <span className="flex items-center gap-2">
                  <RotateCcw className="h-4 w-4 text-red-500" /> Issue Refund
                </span>
                <span className="text-muted-foreground">{showRefundForm ? "−" : "+"}</span>
              </button>
              {showRefundForm && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 mt-2 space-y-3">
                  <p className="text-xs text-red-700">
                    Total paid: <strong>{formatCurrency(totalPaid)}</strong>
                    {balance > 0 && <span> · Refundable amount may not exceed total paid</span>}
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="number" step="0.01" min="0" max={totalPaid}
                      value={refundAmount} onChange={(e) => setRefundAmount(parseFloat(e.target.value) || 0)}
                      placeholder="Amount" required
                      className="flex h-9 w-28 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                    />
                    <select
                      value={refundMethod} onChange={(e) => setRefundMethod(e.target.value)}
                      className="flex h-9 flex-1 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                    >
                      <option value="CASH">Cash</option>
                      <option value="GCASH">GCash</option>
                      <option value="MAYA">Maya</option>
                      <option value="CARD">Card</option>
                    </select>
                  </div>
                  <input
                    value={refundReason} onChange={(e) => setRefundReason(e.target.value)}
                    placeholder="Reason for refund (required)" required
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                  />
                  <Button
                    size="sm" variant="destructive" className="w-full"
                    onClick={handleRefund} disabled={refunding || !refundAmount || !refundReason.trim()}
                  >
                    {refunding ? "Processing..." : `Issue Refund of ${formatCurrency(refundAmount || 0)}`}
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="self-start border-t-2 border-t-gray-500">
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100">
                <Wrench className="h-4 w-4 text-gray-600" />
              </div>
              <CardTitle>Actions</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <select
                id="status"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                value={booking.status}
                onChange={handleStatusChange}
                disabled={saving || bookingLocked}
              >
                {statusOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            <form onSubmit={handleAssign} className="space-y-2">
              <Label htmlFor="employeeId">Assign Employee</Label>
              <div className="flex gap-2">
                <select
                  id="employeeId" name="employeeId"
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                >
                  <option value="">Select employee...</option>
                  {employees.filter((e) => e.isActive !== false).map((emp) => (
                    <option key={emp.id} value={emp.id}>{emp.name}</option>
                  ))}
                </select>
                <select
                  name="phase"
                  defaultValue="PICKUP"
                  className="flex h-9 w-36 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                  aria-label="Assignment phase"
                >
                  <option value="PICKUP">Pickup</option>
                  <option value="DROPOFF">Drop-off</option>
                </select>
                <Button type="submit" disabled={saving || bookingLocked}>Assign / Replace</Button>
              </div>
            </form>

            <div className="space-y-2">
              <Button variant="outline" className="w-full justify-start" onClick={() => setShowEditModal(true)} disabled={bookingLocked}>
                <Edit3 className="mr-2 h-4 w-4" /> Edit Booking
              </Button>
              <Button variant="outline" className="w-full justify-start" asChild>
                <Link href={`/track/map/${booking.referenceNumber}`}>
                  <Navigation className="mr-2 h-4 w-4" /> Live Map
                </Link>
              </Button>
              <Button variant="outline" className="w-full justify-start" asChild>
                <Link href={`/dashboard/bookings/${booking.id}/receipt`}>
                  <Printer className="mr-2 h-4 w-4" /> Receipt
                </Link>
              </Button>
              <Button variant="outline" className="w-full justify-start" asChild>
                <Link href={`/dashboard/chat/${booking.id}`}>
                  <MessageCircle className="mr-2 h-4 w-4" /> Chat with Customer
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="self-start border-t-2 border-t-red-500">
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-100">
                <ShieldAlert className="h-4 w-4 text-red-600" />
              </div>
              <CardTitle>Danger Zone</CardTitle>
              <CardDescription>Irreversible actions</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              variant="destructive" className="w-full justify-start"
              onClick={() => setDangerModal({ action: "cancelled", mode: userRole === "ADMIN" ? "admin" : "report" })}
              disabled={["DELIVERED", "CANCELLED", "NO_SHOW"].includes(booking.status)}
            >
              <Ban className="mr-2 h-4 w-4" /> {userRole === "ADMIN" ? "Mark as Cancelled" : "Report Cancellation"}
            </Button>
            <Button
              variant="destructive" className="w-full justify-start"
              onClick={() => setDangerModal({ action: "no-show", mode: userRole === "ADMIN" ? "admin" : "report" })}
              disabled={["DELIVERED", "CANCELLED", "NO_SHOW", "RECEIVED", "IN_STORAGE", "OUT_FOR_DELIVERY"].includes(booking.status)}
            >
              <UserX className="mr-2 h-4 w-4" /> {userRole === "ADMIN" ? "Mark as No Show" : "Report No-Show"}
            </Button>
            {userRole !== "ADMIN" && (
              <p className="text-xs text-muted-foreground">
                Non-admins file a report that an admin reviews before the booking status changes.
              </p>
            )}
            <div className="border-t pt-3">
              <Button variant="destructive" className="w-full justify-start" onClick={() => setDeleteConfirm(true)}>
                <Trash2 className="mr-2 h-4 w-4" /> Delete Booking
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-t-2 border-t-purple-500">
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-100">
              <ShoppingBag className="h-4 w-4 text-purple-600" />
            </div>
            <CardTitle>Additional Services</CardTitle>
            <CardDescription>Add extra services to this booking. Additional payment is required.</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 mb-4">
            {ADDITIONAL_SERVICES.map((svc) => (
              <div
                key={svc.id}
                onClick={() => {
                  const next = new Set(selectedServices);
                  if (next.has(svc.id)) next.delete(svc.id);
                  else next.add(svc.id);
                  setSelectedServices(next);
                }}
                className={`cursor-pointer rounded-xl border-2 p-4 transition-all ${
                  selectedServices.has(svc.id)
                    ? "border-purple-400 bg-purple-50 ring-1 ring-purple-400 dark:bg-purple-950/20"
                    : "border-muted hover:border-purple-200 hover:bg-muted/50"
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {selectedServices.has(svc.id) ? (
                      <CheckCircle className="h-5 w-5 text-purple-600" />
                    ) : (
                      <div className="h-5 w-5 rounded-full border-2 border-muted-foreground/30" />
                    )}
                    <span className="text-lg">{svc.icon}</span>
                  </div>
                  <span className="text-sm font-bold text-purple-600">₱{svc.price}</span>
                </div>
                <p className="text-sm font-semibold">{svc.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{svc.description}</p>
              </div>
            ))}
          </div>

          {selectedServices.size > 0 && (
            <div className="rounded-lg border bg-muted/30 p-3 mb-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Additional Amount:</span>
                <span className="text-sm font-bold">
                  ₱{ADDITIONAL_SERVICES.filter((s) => selectedServices.has(s.id)).reduce((sum, s) => sum + s.price, 0)}
                </span>
              </div>
            </div>
          )}

          <div className="flex items-end gap-3">
            <div className="flex-1">
              <Label className="text-xs">Notes (optional)</Label>
              <input
                value={serviceNote}
                onChange={(e) => setServiceNote(e.target.value)}
                placeholder="e.g. fragile items, special instructions"
                className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
              />
            </div>
            <Button onClick={handleAddServices} disabled={selectedServices.size === 0 || bookingLocked} className="bg-orange-500 hover:bg-orange-600">
              <ShoppingBag className="mr-2 h-4 w-4" /> Add & Process
            </Button>
          </div>
        </CardContent>
      </Card>

      {booking.luggageDetails && (
        <Card>
          <CardHeader><CardTitle>Luggage Details</CardTitle></CardHeader>
          <CardContent>
            {(() => {
              try {
                const parsed = JSON.parse(booking.luggageDetails);
                if (Array.isArray(parsed)) {
                  const items = parsed.filter((item: Record<string, unknown>) => typeof item.type === "string" && typeof item.qty === "number");
                  const services = parsed.flatMap((item: Record<string, unknown>) =>
                    Array.isArray(item.services) ? (item.services as string[]) : []
                  );
                  if (items.length > 0 || services.length > 0) {
                    return (
                      <div className="space-y-1 text-sm">
                        {items.map((item, i) => (
                          <p key={i} className="flex items-center justify-between border-b border-gray-50 pb-1">
                            <span>{item.type} <strong>×{item.qty}</strong></span>
                            <span className="font-medium">&#x20B1;{(item.price * item.qty).toFixed(2)}</span>
                          </p>
                        ))}
                        {services.length > 0 && (
                          <div className="mt-2">
                            <p className="text-xs font-medium text-purple-700 mb-1">Additional Services</p>
                            {services.map((svc, i) => (
                              <p key={i} className="text-purple-700">• {svc}</p>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  }
                }
              } catch {}
              return <p className="text-sm whitespace-pre-wrap">{booking.luggageDetails}</p>;
            })()}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>Luggage Photos</CardTitle><CardDescription>Submitted photos are read-only. Employees add verification photos only while updating luggage status.</CardDescription></CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-2 mb-4">
            {booking.luggagePhotos.map((photo, i) => (
              <div key={i} className="relative group">
                <Image unoptimized width={400} height={160} src={photo} alt={`Luggage ${i + 1}`} className="rounded-lg object-cover w-full h-24" />
              </div>
            ))}
          </div>
          <span className="text-xs text-muted-foreground">{booking.luggagePhotos.length} submitted photo(s)</span>
        </CardContent>
      </Card>

      {extensions.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Extension Requests</CardTitle></CardHeader>
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
                      <Button size="sm" variant="default" onClick={() => handleReviewExtension(ext.id, "APPROVED")} disabled={reviewing === ext.id}>Approve</Button>
                      <Button size="sm" variant="destructive" onClick={() => handleReviewExtension(ext.id, "REJECTED")} disabled={reviewing === ext.id}>Reject</Button>
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
            <div><CardTitle>Additional Baggage</CardTitle><CardDescription>Register baggage added after the original booking.</CardDescription></div>
            <Button variant="outline" size="sm" onClick={handleAddLuggage} disabled={addingLuggage || bookingLocked}>
              <Plus className="mr-1 h-4 w-4" /> Add Additional Bag
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
                        {item.flag === "LOST" && <Badge variant="destructive" className="text-[10px]">Lost</Badge>}
                        <Badge>{item.status.replace("_", " ")}</Badge>
                      </div>
                      {item.description && <p className="mt-0.5 text-sm text-muted-foreground">{item.description}</p>}
                      {item.location && <p className="text-xs text-muted-foreground">Location: {item.location}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                      <select value={item.status} onChange={(e) => handleUpdateLuggageStatus(item.id, e.target.value)}
                        className="h-8 rounded border border-input bg-transparent px-2 text-xs">
                        <option value="TAG_REQUESTED">Tag Requested</option>
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

      <Card className="border-t-2 border-t-teal-500">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-100">
                <Tag className="h-4 w-4 text-teal-600" />
              </div>
              <CardTitle>Baggage Tags</CardTitle>
            </div>
          </div>
          {booking && (
            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span className="rounded-md bg-muted px-2 py-1">
                Customer bags: <strong>{booking.numberOfBags}</strong>
              </span>
              <span className="rounded-md bg-muted px-2 py-1">
                Tags assigned: <strong>{luggageItems.length}</strong>
              </span>
              {booking.numberOfBags > 3 && (
                <span className="rounded-md bg-amber-50 border border-amber-200 px-2 py-1 text-amber-700">
                  +₱{(booking.numberOfBags - 3) * 100} extra ({booking.numberOfBags - 3} bag{booking.numberOfBags - 3 > 1 ? "s" : ""} over limit)
                </span>
              )}
            </div>
          )}
        </CardHeader>
        <CardContent>
          {/* Physical tag selection */}
          <div className="mb-4 rounded-lg border bg-muted/30 p-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-muted-foreground">
                Select available physical tags (max {booking?.numberOfBags || 3} for this booking)
              </p>
              {booking && luggageItems.length >= booking.numberOfBags && (
                <span className="text-[10px] font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded">Limit reached</span>
              )}
            </div>
            <div className="mb-3 grid max-h-40 grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3">
              {availableTags.filter((tag) => !tag.isUsed).map((tag) => {
                const selected = selectedTagNumbers.has(tag.tagNumber);
                const remaining = (booking?.numberOfBags || 3) - luggageItems.length;
                return (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => setSelectedTagNumbers((prev) => {
                      const next = new Set(prev);
                      if (next.has(tag.tagNumber)) next.delete(tag.tagNumber);
                      else if (next.size < remaining) next.add(tag.tagNumber);
                      return next;
                    })}
                    className={`rounded-lg border px-2 py-2 text-xs font-mono font-semibold transition-colors ${selected ? "border-teal-600 bg-teal-600 text-white" : "bg-background hover:border-teal-400"}`}
                  >
                    {selected ? "✓ " : ""}{tag.tagNumber}
                  </button>
                );
              })}
              {availableTags.every((tag) => tag.isUsed) && <p className="col-span-full text-xs text-muted-foreground">No physical tags are currently available.</p>}
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground">{selectedTagNumbers.size} selected</span>
              <Button
                size="sm"
                onClick={handleRequestTags}
                disabled={bookingLocked || requestingTags || (booking ? luggageItems.length >= booking.numberOfBags : luggageItems.length >= 3) || selectedTagNumbers.size < 1}
                className="bg-teal-600 hover:bg-teal-700"
              >
                {requestingTags ? (
                  <><span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent mr-1" /> Requesting...</>
                ) : (
                  <><Plus className="mr-1 h-3 w-3" /> Assign {selectedTagNumbers.size} Tag{selectedTagNumbers.size > 1 ? "s" : ""}</>
                )}
              </Button>
            </div>
          </div>

          {/* Tag List */}
          {luggageItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">No baggage tags assigned yet</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {luggageItems.map((item) => {
                const isPending = item.status === "TAG_REQUESTED";
                const isAssigned = ["CHECKED_IN", "IN_STORAGE", "OUT_FOR_DELIVERY"].includes(item.status);
                const isDelivered = item.status === "DELIVERED";
                const isCancelled = item.status === "CANCELLED";
                const isLost = item.flag === "LOST";

                return (
                  <div
                    key={item.id}
                    className={`rounded-lg border p-3 transition-all ${
                      isPending ? "border-amber-300 bg-amber-50" :
                      isLost ? "border-red-300 bg-red-50 opacity-60" :
                      isDelivered || isCancelled ? "border-gray-200 bg-gray-50 opacity-50" :
                      isAssigned ? "border-green-300 bg-green-50" :
                      "hover:bg-muted"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <code className={`rounded px-2 py-0.5 text-xs font-mono font-bold ${
                          isLost ? "bg-red-200 text-red-800" :
                          isPending ? "bg-amber-200 text-amber-800" :
                          isAssigned ? "bg-green-200 text-green-800" :
                          isDelivered || isCancelled ? "bg-gray-200 text-gray-500" :
                          "bg-muted"
                        }`}>
                          {item.tagNumber}
                        </code>
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          isLost ? "bg-red-100 text-red-700" :
                          isPending ? "bg-amber-100 text-amber-700" :
                          isAssigned ? "bg-green-100 text-green-700" :
                          isDelivered ? "bg-blue-100 text-blue-700" :
                          isCancelled ? "bg-gray-100 text-gray-500" :
                          "bg-gray-100 text-gray-600"
                        }`}>
                          {isLost ? "Lost" :
                           isPending ? "Pending Approval" :
                           isAssigned ? "Active" :
                           isDelivered ? "Delivered" :
                           isCancelled ? "Cancelled" :
                           item.status.replace("_", " ")}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        {isPending && (
                          <>
                            <button
                              onClick={() => handleApproveTag(item.id, "APPROVED")}
                              className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-green-500 text-white hover:bg-green-600"
                              title="Approve"
                            ><Check className="h-3.5 w-3.5" /></button>
                            <button
                              onClick={() => handleApproveTag(item.id, "REJECTED")}
                              className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-red-500 text-white hover:bg-red-600"
                              title="Reject"
                            ><XCircle className="h-3.5 w-3.5" /></button>
                          </>
                        )}
                        {isAssigned && (
                          <button
                            onClick={() => setFlaggableItem(item.id)}
                            disabled={isLost}
                            className="inline-flex h-7 items-center gap-1 rounded-md border border-red-200 bg-white px-2 text-[10px] font-medium text-red-600 hover:bg-red-50 disabled:opacity-40"
                          >
                            <Flag className="h-3 w-3" /> Report Lost
                          </button>
                        )}
                      </div>
                    </div>
                    {item.description && <p className="mt-1 text-xs text-muted-foreground">{item.description}</p>}
                    {item.location && <p className="mt-0.5 text-xs text-muted-foreground">Location: {item.location}</p>}
                  </div>
                );
              })}
            </div>
          )}

          <div className="mt-3 flex flex-wrap gap-3 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-300" /> Pending Approval</span>
            <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-full bg-green-300" /> Active / In Use</span>
            <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-full bg-gray-300" /> Delivered / Cancelled</span>
            <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-full bg-red-300" /> Lost</span>
          </div>

          {flaggableItem && (
            <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3">
              <p className="text-xs font-medium text-red-700 mb-2">Report baggage as lost?</p>
              <div className="flex gap-2">
                <Button size="sm" variant="destructive" onClick={() => handleFlagLuggage(flaggableItem)}>Confirm Lost</Button>
                <Button size="sm" variant="outline" onClick={() => setFlaggableItem(null)}>Cancel</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <button onClick={handleLoadLogs} className="flex w-full items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100">
                <History className="h-4 w-4 text-slate-600" />
              </div>
              <CardTitle>View Log</CardTitle>
              <CardDescription>Activity history for this booking</CardDescription>
            </div>
            <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${showLog ? "rotate-180" : ""}`} />
          </button>
        </CardHeader>
        {showLog && (
          <CardContent>
            {logsLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-6 w-1/2" />
              </div>
            ) : logs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No activity log found</p>
            ) : (
              <div className="divide-y max-h-80 overflow-y-auto">
                {logs.map((log) => (
                  <div key={log.id} className="flex items-start gap-3 py-2.5 text-sm">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted">
                      <Activity className="h-3 w-3 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium capitalize">{log.action.toLowerCase()}</p>
                      {log.details && <p className="text-xs text-muted-foreground truncate">{log.details}</p>}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs text-muted-foreground">{formatDate(log.createdAt)}</p>
                      {log.user && <p className="text-[10px] text-muted-foreground">{log.user.name}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        )}
      </Card>

      <Card>
        <CardHeader><CardTitle>Assigned Employees</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="text-xs font-medium uppercase">Name</TableHead>
                <TableHead className="text-xs font-medium uppercase">Phase</TableHead>
                <TableHead className="text-xs font-medium uppercase">Email</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {booking.assignments?.map((a) => (
                <TableRow key={a.id} className="border-b transition-colors hover:bg-muted/50">
                  <TableCell className="font-medium">{a.user.name}</TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${
                      a.phase === "DROPOFF" ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"
                    }`}>
                      {a.phase === "DROPOFF" ? "Drop-off" : "Pickup"}
                    </span>
                  </TableCell>
                  <TableCell>{a.user.email}</TableCell>
                </TableRow>
              ))}
              {(!booking.assignments || booking.assignments.length === 0) && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground py-8">No employees assigned</TableCell>
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
        confirmLabel="Delete" variant="danger"
      />

      {dangerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setDangerModal(null)} />
          <div className="relative z-10 mx-4 w-full max-w-lg rounded-xl border bg-background p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
                  <ShieldAlert className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold">
                    {dangerModal.mode === "admin"
                      ? dangerModal.action === "no-show" ? "Mark as No Show" : "Mark as Cancelled"
                      : dangerModal.action === "no-show" ? "Report No-Show" : "Report Cancellation"}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {dangerModal.mode === "admin"
                      ? "Photo proof is required to confirm you are on-site."
                      : "This report is forwarded to an admin for review."}
                  </p>
                </div>
              </div>
              <button onClick={() => setDangerModal(null)} className="rounded-lg p-1 hover:bg-muted">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <Label>Photo proof {dangerModal.mode === "admin" && <span className="text-red-500">*</span>}</Label>
                {dangerPhoto ? (
                  <div className="relative mt-1 overflow-hidden rounded-lg border">
                    <Image unoptimized width={800} height={320} src={dangerPhoto} alt="Proof" className="h-40 w-full object-cover" />
                    <button
                      onClick={() => setDangerPhoto(null)}
                      className="absolute right-2 top-2 rounded-full bg-red-500 px-2.5 py-1 text-xs font-medium text-white shadow-lg"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => dangerFileRef.current?.click()}
                    className="mt-1 flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed border-muted-foreground/30 p-6 transition-colors hover:border-red-500/50 hover:bg-red-50/50"
                  >
                    <Camera className="h-8 w-8 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      {dangerModal.mode === "admin"
                        ? "Take a photo showing you are on-site"
                        : "Attach photo evidence (optional)"}
                    </p>
                  </button>
                )}
                <input
                  ref={dangerFileRef} type="file" accept="image/*" capture="environment"
                  onChange={handleDangerPhoto} className="hidden"
                />
              </div>
              <div>
                <Label>Reason / Note</Label>
                <textarea
                  value={dangerNote}
                  onChange={(e) => setDangerNote(e.target.value)}
                  placeholder={dangerModal.mode === "admin"
                    ? "Optional note"
                    : "Describe what happened (e.g. passenger not at pickup location)"}
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-xs shadow-sm"
                />
              </div>
              <Button
                variant="destructive" className="w-full"
                onClick={handleDangerConfirm}
                disabled={dangerSubmitting || (dangerModal.mode === "admin" && !dangerPhoto)}
              >
                {dangerSubmitting ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing...</>
                ) : dangerModal.mode === "admin" ? "Confirm" : "Submit Report"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowEditModal(false)} />
          <div className="relative z-10 mx-4 w-full max-w-lg rounded-xl border bg-background p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                  <Edit3 className="h-5 w-5 text-primary" />
                </div>
                <h3 className="text-lg font-semibold">Edit Booking</h3>
              </div>
              <button onClick={() => setShowEditModal(false)} className="rounded-lg p-1 hover:bg-muted">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleEditSave} className="space-y-4">
              <div>
                <Label>Pickup Location</Label>
                <input name="pickupLocation" defaultValue={booking.pickupLocation}
                  className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm" />
              </div>
              <div>
                <Label>Drop-off Location</Label>
                <input name="dropOffLocation" defaultValue={booking.dropOffLocation}
                  className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Check In</Label>
                  <input name="checkIn" type="datetime-local" defaultValue={booking.checkIn.slice(0, 16)}
                    className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm" />
                </div>
                <div>
                  <Label>Check Out</Label>
                  <input name="checkOut" type="datetime-local" defaultValue={booking.checkOut?.slice(0, 16) || ""}
                    className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Number of Bags</Label>
                  <input name="numberOfBags" type="number" min="1" defaultValue={booking.numberOfBags}
                    className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm" />
                </div>
                <div>
                  <Label>Total Price (₱)</Label>
                  <input name="totalPrice" type="number" step="0.01" min="0" defaultValue={booking.totalPrice}
                    className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm" />
                </div>
              </div>
              <div>
                <Label>Luggage Details / Notes</Label>
                <textarea name="luggageDetails" rows={3} defaultValue={booking.luggageDetails || ""}
                  className="mt-1 flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm" />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="outline" onClick={() => setShowEditModal(false)}>Cancel</Button>
                <Button type="submit" disabled={editSaving}>{editSaving ? "Saving..." : "Save Changes"}</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function PaymentStatusBadge({ status }: { status: string }) {
  if (status === "full") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-bold text-green-700">
        <CheckCircle className="h-3 w-3" /> Fully Paid
      </span>
    );
  }
  if (status === "dp") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-700">
        <CreditCard className="h-3 w-3" /> Down Payment
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-bold text-gray-500">
      <AlertTriangle className="h-3 w-3" /> Unpaid
    </span>
  );
}
