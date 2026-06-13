"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, MapPin, Calendar, Luggage, Package, AlertCircle, Clock, MessageCircle, Send, Star } from "lucide-react";
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
  location?: { name: string; city: string; address: string } | null;
  payments?: { amount: number; status: string; method: string; paidAt: string | null }[];
  assignments?: { user: { name: string } }[];
}

interface ChatMsg {
  id: string;
  message: string;
  isFromCustomer: boolean;
  createdAt: string;
}

interface BookingReview {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: string;
}

interface Extension {
  id: string;
  requestedCheckOut: string;
  reason: string | null;
  status: string;
  requestedAt: string;
}

const statusColors: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-800",
  CONFIRMED: "bg-blue-100 text-blue-800",
  RECEIVED: "bg-purple-100 text-purple-800",
  IN_STORAGE: "bg-indigo-100 text-indigo-800",
  OUT_FOR_DELIVERY: "bg-orange-100 text-orange-800",
  DELIVERED: "bg-green-100 text-green-800",
  CANCELLED: "bg-red-100 text-red-800",
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
        const data = await res.json();
        setBooking(data);
      } catch {
        router.push("/my-account");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id, router]);

  useEffect(() => {
    if (!showChat || !id) return;
    fetch(`/api/customer/bookings/${id}/chat`)
      .then((r) => r.json())
      .then(setMessages)
      .catch(() => {});
  }, [showChat, id]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (booking?.status === "DELIVERED") {
      fetch(`/api/bookings/${id}/review`)
        .then((r) => r.json())
        .then((data) => { if (data) setReview(data); })
        .catch(() => {});
    }
  }, [booking?.status, id]);

  async function handleCancel() {
    if (!confirm("Are you sure you want to cancel this booking?")) return;
    setCancelling(true);
    setError("");
    try {
      const res = await fetch(`/api/customer/bookings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel" }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Failed to cancel"); return; }
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setCancelling(false);
    }
  }

  async function handleExtend(e: React.FormEvent) {
    e.preventDefault();
    if (!extendDate) return;
    setSubmittingExtend(true);
    try {
      const res = await fetch(`/api/bookings/${id}/extensions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestedCheckOut: extendDate, reason: extendReason }),
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || "Failed"); }
      const ext = await res.json();
      setExtensions((prev) => [...prev, ext]);
      setShowExtend(false);
      setExtendDate("");
      setExtendReason("");
      toast.success("Extension request submitted");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to request extension");
    }
    setSubmittingExtend(false);
  }

  async function handleSendChat() {
    if (!chatText.trim() || sendingChat) return;
    setSendingChat(true);
    try {
      const res = await fetch(`/api/customer/bookings/${id}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: chatText }),
      });
      if (!res.ok) throw new Error();
      const msg = await res.json();
      setMessages((prev) => [...prev, msg]);
      setChatText("");
    } catch {
      toast.error("Failed to send message");
    }
    setSendingChat(false);
  }

  async function handleSubmitReview() {
    if (rating === 0) return;
    setSubmittingReview(true);
    try {
      const res = await fetch(`/api/bookings/${id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, comment }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setReview(data);
      toast.success("Review submitted");
    } catch {
      toast.error("Failed to submit review");
    }
    setSubmittingReview(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  if (!booking) return null;

  const currentStep = statusSteps.indexOf(booking.status);
  const canCancel = ["PENDING", "CONFIRMED"].includes(booking.status);
  const canExtend = !["CANCELLED", "DELIVERED"].includes(booking.status);
  const payment = booking.payments?.[0];

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-50 border-b bg-white shadow-sm">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4">
          <Link href="/my-account" className="flex items-center gap-2 text-gray-600 hover:text-gray-900">
            <ArrowLeft className="h-5 w-5" />
            <span className="text-sm">Back</span>
          </Link>
          <span className="text-sm font-medium">{booking.referenceNumber}</span>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8 space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Booking Status</CardTitle>
              <Badge className={statusColors[booking.status] || ""}>
                {booking.status.replace(/_/g, " ")}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              {statusSteps.map((step, i) => (
                <div key={step} className="flex flex-col items-center">
                  <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${i <= currentStep ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-400"}`}>
                    {i + 1}
                  </div>
                  <span className="mt-1 text-[10px] text-gray-500 text-center leading-tight">
                    {step.replace(/_/g, " ")}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Booking Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-start gap-3">
              <MapPin className="mt-0.5 h-4 w-4 text-blue-600 shrink-0" />
              <div>
                <p className="font-medium">Pickup</p>
                <p className="text-gray-500">{booking.pickupLocation}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <MapPin className="mt-0.5 h-4 w-4 text-red-600 shrink-0" />
              <div>
                <p className="font-medium">Drop-off</p>
                <p className="text-gray-500">{booking.dropOffLocation}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Calendar className="mt-0.5 h-4 w-4 text-purple-600 shrink-0" />
              <div>
                <p className="font-medium">Schedule</p>
                <p className="text-gray-500">{new Date(booking.checkIn).toLocaleString()}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Package className="mt-0.5 h-4 w-4 text-green-600 shrink-0" />
              <div>
                <p className="font-medium">Bags</p>
                <p className="text-gray-500">{booking.numberOfBags} luggage</p>
              </div>
            </div>
            {booking.luggageDetails && (
              <div className="flex items-start gap-3">
                <Luggage className="mt-0.5 h-4 w-4 text-orange-600 shrink-0" />
                <div>
                  <p className="font-medium">Details</p>
                  <p className="text-gray-500">{booking.luggageDetails}</p>
                </div>
              </div>
            )}
            {booking.location && (
              <div className="flex items-start gap-3">
                <MapPin className="mt-0.5 h-4 w-4 text-indigo-600 shrink-0" />
                <div><p className="font-medium">Storage Location</p><p className="text-gray-500">{booking.location.name} - {booking.location.city}</p></div>
              </div>
            )}
          </CardContent>
        </Card>

        {payment && (
          <Card>
            <CardHeader><CardTitle>Payment</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Amount</span><span className="font-medium">₱{payment.amount.toFixed(2)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Method</span><span>{payment.method}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Status</span><Badge variant={payment.status === "PAID" ? "default" : "secondary"}>{payment.status}</Badge></div>
              {payment.paidAt && <div className="flex justify-between"><span className="text-gray-500">Paid at</span><span>{new Date(payment.paidAt).toLocaleString()}</span></div>}
            </CardContent>
          </Card>
        )}

        {booking.luggagePhotos.length > 0 && (
          <Card>
            <CardHeader><CardTitle>Luggage Photos</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-2">
                {booking.luggagePhotos.map((photo, i) => (
                  <img key={i} src={photo} alt={`Luggage ${i + 1}`} className="rounded-lg object-cover w-full h-24" />
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {canCancel && (
          <Button variant="destructive" className="w-full" onClick={handleCancel} disabled={cancelling}>
            {cancelling ? "Cancelling..." : "Cancel Booking"}
          </Button>
        )}

        <div className="flex gap-2">
          {canExtend && (
            <Button variant="outline" className="flex-1" onClick={() => setShowExtend(!showExtend)}>
              <Clock className="mr-2 h-4 w-4" />
              Extend
            </Button>
          )}
          <Button variant="outline" className="flex-1" onClick={() => setShowChat(!showChat)}>
            <MessageCircle className="mr-2 h-4 w-4" />
            Chat
          </Button>
          {booking.status === "DELIVERED" && !review && (
            <Button variant="outline" className="flex-1" onClick={() => setShowReview(true)}>
              <Star className="mr-2 h-4 w-4" />
              Rate
            </Button>
          )}
          <Link href={`/track/${booking.referenceNumber}`} className="flex-1">
            <Button variant="outline" className="w-full">Track</Button>
          </Link>
        </div>

        {showExtend && (
          <Card>
            <CardHeader><CardTitle>Request Extension</CardTitle></CardHeader>
            <CardContent>
              <form onSubmit={handleExtend} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="extendDate">New Check-out Date</Label>
                  <Input id="extendDate" type="date" value={extendDate} onChange={(e) => setExtendDate(e.target.value)} required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="extendReason">Reason (optional)</Label>
                  <Input id="extendReason" value={extendReason} onChange={(e) => setExtendReason(e.target.value)} placeholder="Why do you need to extend?" />
                </div>
                <Button type="submit" disabled={submittingExtend || !extendDate}>
                  {submittingExtend ? "Submitting..." : "Submit Request"}
                </Button>
              </form>
              {extensions.length > 0 && (
                <div className="mt-4 space-y-2">
                  <p className="text-sm font-medium">Previous Requests</p>
                  {extensions.map((ext) => (
                    <div key={ext.id} className="rounded-lg border p-3 text-sm">
                      <div className="flex items-center justify-between">
                        <span>{formatDate(ext.requestedCheckOut)}</span>
                        <Badge variant={ext.status === "APPROVED" ? "default" : ext.status === "REJECTED" ? "destructive" : "warning"}>{ext.status}</Badge>
                      </div>
                      {ext.reason && <p className="text-xs text-gray-500 mt-1">{ext.reason}</p>}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {showChat && (
          <Card>
            <CardHeader><CardTitle>Chat with Staff</CardTitle></CardHeader>
            <CardContent>
              <div className="max-h-64 space-y-3 overflow-y-auto mb-4">
                {messages.length === 0 && <p className="text-sm text-gray-500 text-center py-4">No messages yet</p>}
                {messages.map((msg) => (
                  <div key={msg.id} className={`flex ${msg.isFromCustomer ? "justify-end" : ""}`}>
                    <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${msg.isFromCustomer ? "bg-blue-600 text-white" : "bg-gray-100"}`}>
                      <p>{msg.message}</p>
                      <p className={`mt-1 text-[10px] ${msg.isFromCustomer ? "text-blue-200" : "text-gray-500"}`}>{formatDate(msg.createdAt)}</p>
                    </div>
                  </div>
                ))}
                <div ref={chatBottomRef} />
              </div>
              <div className="flex gap-2">
                <Input value={chatText} onChange={(e) => setChatText(e.target.value)} placeholder="Type a message..." onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendChat(); }}} />
                <Button size="icon" onClick={handleSendChat} disabled={!chatText.trim() || sendingChat}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {(review || showReview) && (
          <Card>
            <CardHeader><CardTitle>Your Review</CardTitle></CardHeader>
            <CardContent>
              {review ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star key={s} className={`h-5 w-5 ${s <= review.rating ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`} />
                    ))}
                  </div>
                  {review.comment && <p className="text-sm text-gray-600">{review.comment}</p>}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <button key={s} type="button" onMouseEnter={() => setHoverRating(s)} onMouseLeave={() => setHoverRating(0)} onClick={() => setRating(s)}>
                        <Star className={`h-8 w-8 cursor-pointer transition-colors ${(hoverRating || rating) >= s ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`} />
                      </button>
                    ))}
                  </div>
                  <Input placeholder="Share your feedback (optional)" value={comment} onChange={(e) => setComment(e.target.value)} />
                  <Button onClick={handleSubmitReview} disabled={rating === 0 || submittingReview}>
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
