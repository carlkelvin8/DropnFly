"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft, MapPin, Calendar, Luggage, Package, AlertCircle, Clock,
  MessageCircle, Send, Star, User, CreditCard, Tag, ShoppingBag,
  Phone, Mail, Globe, Building,
} from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/utils";

interface BookingDetail {
  id: string;
  referenceNumber: string;
  status: string;
  pickupLocation: string;
  dropOffLocation: string;
  numberOfBags: number;
  totalPrice: number;
  discount: number;
  luggageDetails: string | null;
  luggagePhotos: string[];
  checkIn: string;
  checkOut: string | null;
  createdAt: string;
  customer?: {
    name: string;
    email: string;
    phone: string;
    countryOfOrigin?: string | null;
    cityOfOrigin?: string | null;
  };
  location?: { name: string; city: string; address: string } | null;
  payments?: { amount: number; status: string; method: string; paidAt: string | null }[];
  assignments?: { user: { name: string; vehicleType?: string | null; plateNumber?: string | null } }[];
  luggageItems?: { id: string; tagNumber: string; description: string | null; status: string }[];
}

interface ChatMsg { id: string; message: string; isFromCustomer: boolean; createdAt: string; }
interface BookingReview { id: string; rating: number; comment: string | null; createdAt: string; }
interface Extension { id: string; requestedCheckOut: string; reason: string | null; status: string; requestedAt: string; }

const statusConfig: Record<string, { label: string; color: string; step: number }> = {
  PENDING: { label: "Pending", color: "bg-amber-100 text-amber-800 border-amber-200", step: 0 },
  CONFIRMED: { label: "Confirmed", color: "bg-blue-100 text-blue-800 border-blue-200", step: 1 },
  RECEIVED: { label: "Picked Up", color: "bg-purple-100 text-purple-800 border-purple-200", step: 2 },
  IN_STORAGE: { label: "In Storage", color: "bg-indigo-100 text-indigo-800 border-indigo-200", step: 3 },
  OUT_FOR_DELIVERY: { label: "Out for Delivery", color: "bg-orange-100 text-orange-800 border-orange-200", step: 4 },
  DELIVERED: { label: "Delivered", color: "bg-emerald-100 text-emerald-800 border-emerald-200", step: 5 },
  CANCELLED: { label: "Cancelled", color: "bg-red-100 text-red-800 border-red-200", step: -1 },
};

const statusSteps = ["PENDING", "CONFIRMED", "RECEIVED", "IN_STORAGE", "OUT_FOR_DELIVERY", "DELIVERED"];

export default function CustomerBookingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [booking, setBooking] = useState<BookingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState("");
  const [showExtend, setShowExtend] = useState(false);
  const [extendDate, setExtendDate] = useState("");
  const [extendReason, setExtendReason] = useState("");
  const [submittingExtend, setSubmittingExtend] = useState(false);
  const [extensions, setExtensions] = useState<Extension[]>([]);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [chatText, setChatText] = useState("");
  const [sendingChat, setSendingChat] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const [review, setReview] = useState<BookingReview | null>(null);
  const [showReview, setShowReview] = useState(false);
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/customer/bookings/${id}`);
        if (!res.ok) throw new Error("Not found");
        setBooking(await res.json());
      } catch { router.push("/my-account"); }
      finally { setLoading(false); }
    }
    load();
  }, [id, router]);

  useEffect(() => {
    if (!showChat || !id) return;
    fetch(`/api/customer/bookings/${id}/chat`).then((r) => r.json()).then(setMessages).catch(() => {});
  }, [showChat, id]);

  useEffect(() => { chatBottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  useEffect(() => {
    if (booking?.status === "DELIVERED") {
      fetch(`/api/bookings/${id}/review`).then((r) => r.json()).then((d) => { if (d) setReview(d); }).catch(() => {});
    }
  }, [booking?.status, id]);

  async function handleCancel() {
    if (!confirm("Are you sure you want to cancel this booking?")) return;
    setCancelling(true); setError("");
    try {
      const res = await fetch(`/api/customer/bookings/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "cancel" }) });
      if (!res.ok) { const d = await res.json(); setError(d.error || "Failed"); return; }
      router.refresh();
    } catch { setError("Network error"); }
    finally { setCancelling(false); }
  }

  async function handleExtend(e: React.FormEvent) {
    e.preventDefault(); if (!extendDate) return;
    setSubmittingExtend(true);
    try {
      const res = await fetch(`/api/bookings/${id}/extensions`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ requestedCheckOut: extendDate, reason: extendReason }) });
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || "Failed"); }
      const ext = await res.json();
      setExtensions((prev) => [...prev, ext]);
      setShowExtend(false); setExtendDate(""); setExtendReason("");
      toast.success("Extension request submitted");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    setSubmittingExtend(false);
  }

  async function handleSendChat() {
    if (!chatText.trim() || sendingChat) return;
    setSendingChat(true);
    try {
      const res = await fetch(`/api/customer/bookings/${id}/chat`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: chatText }) });
      if (!res.ok) throw new Error();
      const msg = await res.json();
      setMessages((prev) => [...prev, msg]); setChatText("");
    } catch { toast.error("Failed to send"); }
    setSendingChat(false);
  }

  async function handleSubmitReview() {
    if (rating === 0) return;
    setSubmittingReview(true);
    try {
      const res = await fetch(`/api/bookings/${id}/review`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rating, comment }) });
      if (!res.ok) throw new Error();
      setReview(await res.json()); toast.success("Review submitted");
    } catch { toast.error("Failed"); }
    setSubmittingReview(false);
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-blue-50">
      <div className="h-10 w-10 animate-spin rounded-full border-3 border-blue-200 border-t-blue-600" />
    </div>
  );
  if (!booking) return null;

  const currentStep = statusSteps.indexOf(booking.status);
  const canCancel = ["PENDING", "CONFIRMED"].includes(booking.status);
  const canExtend = !["CANCELLED", "DELIVERED"].includes(booking.status);
  const extraBags = Math.max(0, booking.numberOfBags - 3);
  const extraBagFee = extraBags * 100;
  let luggageSubtotal = 0;
  try {
    const parsed: { type: string; qty: number; price: number }[] = booking.luggageDetails ? JSON.parse(booking.luggageDetails) : [];
    luggageSubtotal = parsed.reduce((sum, item) => sum + item.price * item.qty, 0);
  } catch {}
  const basePrice = luggageSubtotal > 0 ? luggageSubtotal : booking.totalPrice - extraBagFee + booking.discount;
  const additionalServices = (() => {
    const services: string[] = [];
    if (booking.luggageDetails) {
      try {
        const parsed = JSON.parse(booking.luggageDetails);
        if (Array.isArray(parsed)) {
          const svc = parsed.find((item: Record<string, unknown>) => item.services || item.additionalServices);
          if (svc) {
            const list = (svc.services || svc.additionalServices) as string[];
            if (Array.isArray(list)) services.push(...list);
          }
        }
      } catch {
        // Not JSON, check for text pattern
      }
    }
    const textMatches = booking.luggageDetails?.match(/\[Additional Services:.*?\]/g) || [];
    textMatches.forEach((m) => services.push(m));
    return services;
  })();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/50">
      <header className="sticky top-0 z-50 border-b border-gray-100/80 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-3xl items-center px-4">
          <Link href="/my-account" className="flex items-center gap-2 text-gray-500 hover:text-gray-900 transition-colors">
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm font-medium">Back</span>
          </Link>
          <span className="mx-auto text-sm font-semibold">{booking.referenceNumber}</span>
          <div className="w-14" />
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6 space-y-5">
        {/* Status Tracker */}
        <Card className="overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-blue-100">Booking Status</p>
                <p className="text-lg font-bold text-white">{statusConfig[booking.status]?.label || booking.status}</p>
              </div>
              <Badge className={`${statusConfig[booking.status]?.color || ""} border`}>
                {statusConfig[booking.status]?.label || booking.status}
              </Badge>
            </div>
          </div>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              {statusSteps.map((step, i) => (
                <div key={step} className="flex flex-col items-center flex-1">
                  <div className={`flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold transition-all ${
                    i <= currentStep ? "bg-blue-600 text-white shadow-md" : "bg-gray-100 text-gray-400"
                  }`}>{i + 1}</div>
                  <span className="mt-1.5 text-[9px] text-gray-400 text-center leading-tight max-w-[60px]">
                    {step.replace(/_/g, " ")}
                  </span>
                  {i < statusSteps.length - 1 && (
                    <div className={`absolute h-0.5 w-full ${i < currentStep ? "bg-blue-600" : "bg-gray-200"}`} />
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* 1. Customer Information */}
        {booking.customer && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-100">
                  <User className="h-4 w-4 text-blue-600" />
                </div>
                Customer Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex items-center gap-2.5 text-sm">
                  <User className="h-4 w-4 text-gray-400" />
                  <div><p className="text-[11px] text-gray-400">Name</p><p className="font-medium">{booking.customer.name}</p></div>
                </div>
                <div className="flex items-center gap-2.5 text-sm">
                  <Mail className="h-4 w-4 text-gray-400" />
                  <div><p className="text-[11px] text-gray-400">Email</p><p className="font-medium">{booking.customer.email}</p></div>
                </div>
                <div className="flex items-center gap-2.5 text-sm">
                  <Phone className="h-4 w-4 text-gray-400" />
                  <div><p className="text-[11px] text-gray-400">Phone</p><p className="font-medium">{booking.customer.phone}</p></div>
                </div>
                {booking.customer.countryOfOrigin && (
                  <div className="flex items-center gap-2.5 text-sm">
                    <Globe className="h-4 w-4 text-gray-400" />
                    <div><p className="text-[11px] text-gray-400">Origin</p><p className="font-medium">{booking.customer.cityOfOrigin ? `${booking.customer.cityOfOrigin}, ` : ""}{booking.customer.countryOfOrigin}</p></div>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-4 rounded-lg border bg-blue-50/50 px-4 py-3">
                <div>
                  <p className="text-[11px] text-gray-400 uppercase">Booking Reference</p>
                  <p className="text-sm font-bold font-mono text-blue-700">{booking.referenceNumber}</p>
                </div>
                <div className="h-8 w-px bg-blue-200" />
                <div>
                  <p className="text-[11px] text-gray-400 uppercase">Booked On</p>
                  <p className="text-sm font-medium">{new Date(booking.createdAt).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 2. Booking Details */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-100">
                <Package className="h-4 w-4 text-violet-600" />
              </div>
              Booking Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border bg-gray-50 p-3">
                <div className="flex items-center gap-2 mb-1">
                  <MapPin className="h-3.5 w-3.5 text-emerald-500" />
                  <p className="text-[11px] font-medium text-gray-400 uppercase">Pickup</p>
                </div>
                <p className="text-sm font-medium">{booking.pickupLocation}</p>
                {booking.pickupLocation.includes(" - ") && (
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    {booking.pickupLocation.split(" - ")[1]?.trim()}
                  </p>
                )}
              </div>
              <div className="rounded-lg border bg-gray-50 p-3">
                <div className="flex items-center gap-2 mb-1">
                  <MapPin className="h-3.5 w-3.5 text-red-500" />
                  <p className="text-[11px] font-medium text-gray-400 uppercase">Drop-off</p>
                </div>
                <p className="text-sm font-medium">{booking.dropOffLocation}</p>
                {booking.dropOffLocation.includes(" - ") && (
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    {booking.dropOffLocation.split(" - ")[1]?.trim()}
                  </p>
                )}
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border bg-gray-50 p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Calendar className="h-3.5 w-3.5 text-purple-500" />
                  <p className="text-[11px] font-medium text-gray-400 uppercase">Check-in</p>
                </div>
                <p className="text-sm font-medium">{new Date(booking.checkIn).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}</p>
                <p className="text-[11px] text-gray-400">{new Date(booking.checkIn).toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit" })}</p>
              </div>
              {booking.checkOut && (
                <div className="rounded-lg border bg-gray-50 p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Calendar className="h-3.5 w-3.5 text-indigo-500" />
                    <p className="text-[11px] font-medium text-gray-400 uppercase">Check-out</p>
                  </div>
                  <p className="text-sm font-medium">{new Date(booking.checkOut).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}</p>
                  <p className="text-[11px] text-gray-400">{new Date(booking.checkOut).toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit" })}</p>
                </div>
              )}
              {booking.location && (
                <div className="rounded-lg border bg-gray-50 p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Building className="h-3.5 w-3.5 text-cyan-500" />
                    <p className="text-[11px] font-medium text-gray-400 uppercase">Storage</p>
                  </div>
                  <p className="text-sm font-medium">{booking.location.name}</p>
                  <p className="text-[11px] text-gray-400">{booking.location.city}</p>
                </div>
              )}
            </div>
            {booking.checkIn && booking.checkOut && (
              <div className="flex items-center gap-2 rounded-lg border bg-indigo-50/50 px-3 py-2">
                <Clock className="h-3.5 w-3.5 text-indigo-500" />
                <span className="text-xs text-indigo-700">
                  Storage Duration:{" "}
                  <strong>
                    {(() => {
                      const diff = Math.abs(new Date(booking.checkOut).getTime() - new Date(booking.checkIn).getTime());
                      const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
                      return `${days} day${days !== 1 ? "s" : ""}`;
                    })()}
                  </strong>
                </span>
              </div>
            )}
            {booking.assignments && booking.assignments.length > 0 && (
              <div className="rounded-lg border bg-gray-50 px-3 py-2">
                <p className="text-[11px] text-gray-400 uppercase mb-1">Assigned Rider</p>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">{booking.assignments[0].user.name}</p>
                  {booking.assignments[0].user.vehicleType && (
                    <Badge variant="secondary" className="text-[10px]">
                      {booking.assignments[0].user.vehicleType}
                      {booking.assignments[0].user.plateNumber ? ` · ${booking.assignments[0].user.plateNumber}` : ""}
                    </Badge>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 3. Bags & Charges */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-100">
                <Luggage className="h-4 w-4 text-amber-600" />
              </div>
              Bags &amp; Charges
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between rounded-lg bg-gray-50 border p-3">
              <span className="text-sm text-gray-600">Total Bags</span>
              <span className="text-lg font-bold">{booking.numberOfBags}</span>
            </div>
            {(() => {
              let parsed: { type: string; qty: number; price: number }[] = [];
              try {
                if (booking.luggageDetails) parsed = JSON.parse(booking.luggageDetails);
              } catch {}
              if (parsed.length === 0) return null;
              const typeColorMap: Record<string, string> = {
                "Extra Small": "bg-emerald-100 text-emerald-700",
                Small: "bg-blue-100 text-blue-700",
                Standard: "bg-violet-100 text-violet-700",
                Large: "bg-amber-100 text-amber-700",
              };
              return (
                <div>
                  <p className="text-xs font-medium text-gray-400 uppercase mb-2">Luggage Breakdown</p>
                  <div className="rounded-lg border divide-y">
                    {parsed.map((item, i) => (
                      <div key={i} className="flex items-center justify-between px-3 py-2.5">
                        <div className="flex items-center gap-2.5">
                          <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${typeColorMap[item.type] || "bg-gray-100 text-gray-700"}`}>
                            {item.type}
                          </span>
                          <span className="text-xs text-gray-500">×{item.qty}</span>
                        </div>
                        <span className="text-sm font-medium">₱{(item.price * item.qty).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
            {extraBags > 0 && (
              <div className="flex items-center justify-between rounded-lg bg-amber-50 border border-amber-200 p-3">
                <div>
                  <p className="text-sm font-medium text-amber-800">Extra bag fee</p>
                  <p className="text-xs text-amber-600">{extraBags} bag{extraBags > 1 ? "s" : ""} over 3-bag limit × ₱100</p>
                </div>
                <span className="text-sm font-bold text-amber-800">+₱{extraBagFee}</span>
              </div>
            )}
            {booking.luggageItems && booking.luggageItems.length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-400 uppercase mb-2">Baggage Tags</p>
                <div className="grid gap-2 sm:grid-cols-3">
                  {booking.luggageItems.map((item) => (
                    <div key={item.id} className="flex items-center gap-2 rounded-lg border p-2.5">
                      <Tag className="h-3.5 w-3.5 text-teal-500" />
                      <div>
                        <code className="text-xs font-mono font-bold">{item.tagNumber}</code>
                        <p className="text-[10px] text-gray-400">{item.status.replace(/_/g, " ")}</p>
                        {item.description && <p className="text-[10px] text-gray-400">{item.description}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 4. Payment */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100">
                <CreditCard className="h-4 w-4 text-emerald-600" />
              </div>
              Payment
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2 rounded-lg border p-4">
              <p className="text-xs font-medium text-gray-400 uppercase mb-1">Price Breakdown</p>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Luggage ({Math.min(booking.numberOfBags, 3)} bag{Math.min(booking.numberOfBags, 3) > 1 ? "s" : ""})</span>
                <span>₱{basePrice.toFixed(2)}</span>
              </div>
              {extraBags > 0 && (
                <div className="flex justify-between text-sm text-amber-600">
                  <span>Extra bag fee ({extraBags} × ₱100)</span>
                  <span>+₱{extraBagFee.toFixed(2)}</span>
                </div>
              )}
              {booking.discount > 0 && (
                <div className="flex justify-between text-sm text-emerald-600">
                  <span>Discount</span>
                  <span>-₱{booking.discount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between font-semibold border-t pt-2 mt-2">
                <span>Grand Total</span>
                <span className="text-lg">₱{booking.totalPrice.toFixed(2)}</span>
              </div>
            </div>
            {booking.payments && booking.payments.length > 0 && (() => {
              const totalPaid = booking.payments!.filter((p) => p.status === "PAID").reduce((s, p) => s + p.amount, 0);
              const remaining = booking.totalPrice - totalPaid;
              return (
                <div className="rounded-lg border p-4">
                  <p className="text-xs font-medium text-gray-400 uppercase mb-2">Payment Summary</p>
                  <div className="flex gap-3">
                    <div className="flex-1 rounded-lg bg-emerald-50 px-3 py-2">
                      <p className="text-[11px] text-emerald-600">Paid</p>
                      <p className="text-sm font-bold text-emerald-700">₱{totalPaid.toFixed(2)}</p>
                    </div>
                    {remaining > 0 && (
                      <div className="flex-1 rounded-lg bg-amber-50 px-3 py-2">
                        <p className="text-[11px] text-amber-600">Remaining</p>
                        <p className="text-sm font-bold text-amber-700">₱{remaining.toFixed(2)}</p>
                      </div>
                    )}
                    {remaining <= 0 && (
                      <div className="flex-1 rounded-lg bg-blue-50 px-3 py-2">
                        <p className="text-[11px] text-blue-600">Status</p>
                        <p className="text-sm font-bold text-blue-700">Fully Paid</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
            {booking.payments && booking.payments.length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-400 uppercase mb-2">Payment History</p>
                <div className="space-y-2">
                  {booking.payments.map((p, i) => {
                    const methodIcons: Record<string, string> = { GCASH: "G", MAYA: "M", CARD: "C", CASH: "$" };
                    const methodColors: Record<string, string> = { GCASH: "bg-blue-600", MAYA: "bg-green-600", CARD: "bg-violet-600", CASH: "bg-gray-600" };
                    return (
                      <div key={i} className="flex items-center justify-between rounded-lg bg-gray-50 border p-3 text-sm">
                        <div className="flex items-center gap-3">
                          <div className={`flex h-8 w-8 items-center justify-center rounded-full text-white text-xs font-bold ${methodColors[p.method] || "bg-gray-400"}`}>
                            {methodIcons[p.method] || "?"}
                          </div>
                          <div>
                            <p className="font-medium">{p.method}</p>
                            <p className="text-xs text-gray-400">{p.paidAt ? new Date(p.paidAt).toLocaleString("en-PH", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }) : "Pending"}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold">₱{p.amount.toFixed(2)}</p>
                          <Badge variant={p.status === "PAID" ? "default" : "secondary"} className="text-[10px]">{p.status}</Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 5. Additional Services */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-100">
                <ShoppingBag className="h-4 w-4 text-purple-600" />
              </div>
              Additional Services
            </CardTitle>
          </CardHeader>
          <CardContent>
            {additionalServices.length > 0 ? (
              <div className="space-y-2">
                {additionalServices.map((svc, i) => {
                  const cleaned = svc.replace(/[\[\]]/g, "").replace("Additional Services:", "").trim();
                  return (
                    <div key={i} className="flex items-center gap-2.5 rounded-lg border bg-purple-50/50 px-3 py-2.5 text-sm">
                      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-purple-100">
                        <svg className="h-3 w-3 text-purple-600" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                      </div>
                      <span className="text-purple-800 font-medium">{cleaned}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-gray-400 text-center py-2">No additional services requested.</p>
            )}
          </CardContent>
        </Card>

        {/* Luggage Photos */}
        {booking.luggagePhotos.length > 0 && (
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Luggage Photos</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-2">
                {booking.luggagePhotos.map((photo, i) => (
                  <img key={i} src={photo} alt={`Luggage ${i + 1}`} className="rounded-xl object-cover w-full h-24 border" />
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><span>{error}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2">
          {canCancel && (
            <Button variant="destructive" className="flex-1" onClick={handleCancel} disabled={cancelling}>
              {cancelling ? "Cancelling..." : "Cancel Booking"}
            </Button>
          )}
          {canExtend && (
            <Button variant="outline" className="flex-1" onClick={() => setShowExtend(!showExtend)}>
              <Clock className="mr-2 h-4 w-4" /> Extend
            </Button>
          )}
          <Button variant="outline" className="flex-1" onClick={() => setShowChat(!showChat)}>
            <MessageCircle className="mr-2 h-4 w-4" /> Chat
          </Button>
          {booking.status === "DELIVERED" && !review && (
            <Button variant="outline" className="flex-1" onClick={() => setShowReview(true)}>
              <Star className="mr-2 h-4 w-4" /> Rate
            </Button>
          )}
          <Link href={`/track/${booking.referenceNumber}`} className="flex-1">
            <Button variant="outline" className="w-full">Track</Button>
          </Link>
        </div>

        {/* Extend Form */}
        {showExtend && (
          <Card>
            <CardHeader><CardTitle className="text-base">Request Extension</CardTitle></CardHeader>
            <CardContent>
              <form onSubmit={handleExtend} className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="extendDate" className="text-xs">New Check-out Date</Label>
                  <Input id="extendDate" type="date" value={extendDate} onChange={(e) => setExtendDate(e.target.value)} required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="extendReason" className="text-xs">Reason (optional)</Label>
                  <Input id="extendReason" value={extendReason} onChange={(e) => setExtendReason(e.target.value)} placeholder="Why do you need to extend?" />
                </div>
                <Button type="submit" disabled={submittingExtend || !extendDate} className="w-full">
                  {submittingExtend ? "Submitting..." : "Submit Request"}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Chat */}
        {showChat && (
          <Card>
            <CardHeader><CardTitle className="text-base">Chat with Staff</CardTitle></CardHeader>
            <CardContent>
              <div className="max-h-64 space-y-3 overflow-y-auto mb-4">
                {messages.length === 0 && <p className="text-sm text-gray-400 text-center py-4">No messages yet</p>}
                {messages.map((msg) => (
                  <div key={msg.id} className={`flex ${msg.isFromCustomer ? "justify-end" : ""}`}>
                    <div className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${msg.isFromCustomer ? "bg-blue-600 text-white" : "bg-gray-100"}`}>
                      <p>{msg.message}</p>
                      <p className={`mt-1 text-[10px] ${msg.isFromCustomer ? "text-blue-200" : "text-gray-400"}`}>{formatDate(msg.createdAt)}</p>
                    </div>
                  </div>
                ))}
                <div ref={chatBottomRef} />
              </div>
              <div className="flex gap-2">
                <Input value={chatText} onChange={(e) => setChatText(e.target.value)} placeholder="Type a message..." onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendChat(); } }} />
                <Button size="icon" onClick={handleSendChat} disabled={!chatText.trim() || sendingChat}><Send className="h-4 w-4" /></Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Review */}
        {(review || showReview) && (
          <Card>
            <CardHeader><CardTitle className="text-base">Your Review</CardTitle></CardHeader>
            <CardContent>
              {review ? (
                <div className="space-y-2">
                  <div className="flex gap-1">{[1,2,3,4,5].map((s) => <Star key={s} className={`h-5 w-5 ${s <= review.rating ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`} />)}</div>
                  {review.comment && <p className="text-sm text-gray-600">{review.comment}</p>}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex gap-1">{[1,2,3,4,5].map((s) => <button key={s} type="button" onMouseEnter={() => setHoverRating(s)} onMouseLeave={() => setHoverRating(0)} onClick={() => setRating(s)}><Star className={`h-8 w-8 cursor-pointer transition-colors ${(hoverRating || rating) >= s ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`} /></button>)}</div>
                  <Input placeholder="Share your feedback (optional)" value={comment} onChange={(e) => setComment(e.target.value)} />
                  <Button onClick={handleSubmitReview} disabled={rating === 0 || submittingReview} className="w-full">
                    {submittingReview ? "Submitting..." : "Submit Review"}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
