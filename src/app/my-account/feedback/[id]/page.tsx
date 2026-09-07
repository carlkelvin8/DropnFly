"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Star, ArrowLeft, CheckCircle2, AlertCircle, Calendar, Package } from "lucide-react";
import { toast } from "sonner";

interface BookingDetail {
  id: string;
  referenceNumber: string;
  status: string;
  checkIn: string;
  checkOut: string | null;
  updatedAt: string;
  createdAt: string;
}

interface Review {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: string;
}

export default function FeedbackPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [booking, setBooking] = useState<BookingDetail | null>(null);
  const [review, setReview] = useState<Review | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<number | null>(null);
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const bookingRes = await fetch(`/api/customer/bookings/${id}`, { cache: "no-store" });
        if (!bookingRes.ok) {
          const data = await bookingRes.json().catch(() => ({}));
          if (bookingRes.status === 401) {
            router.replace(`/my-account/login?callbackUrl=${encodeURIComponent(`/my-account/feedback/${id}`)}`);
            return;
          }
          if (bookingRes.status === 403) {
            if (active) {
              setError("Forbidden");
              setErrorCode(403);
            }
            return;
          }
          if (bookingRes.status === 404) {
            if (active) {
              setError(data.error || "Transaction not found");
              setErrorCode(404);
            }
            return;
          }
          throw new Error(data.error || "Failed to load booking");
        }
        const bookingJson = await bookingRes.json();
        if (!active) return;
        setBooking(bookingJson);

        // Fetch review (may be 401/403 but we handle gracefully)
        const reviewRes = await fetch(`/api/bookings/${id}/review`, { cache: "no-store" });
        if (reviewRes.ok) {
          const reviewJson = await reviewRes.json();
          if (reviewJson && reviewJson.id) setReview(reviewJson);
        } else if (reviewRes.status === 403 || reviewRes.status === 404) {
          // ignore, no review yet but booking ownership already validated via customer bookings endpoint
        }
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        if (active) setLoading(false);
      }
    }
    if (id) void load();
    return () => {
      active = false;
    };
  }, [id, router]);

  async function handleSubmit() {
    if (rating < 1 || rating > 5) {
      toast.error("Please select a rating from 1 to 5");
      return;
    }
    if (comment.length > 2000) {
      toast.error("Review must be 2000 characters or less");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/bookings/${id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, comment: comment.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 409) {
          // Already reviewed — sync state to already-submitted view
          toast.error(data.error || "Thank you! Feedback has already been submitted for this transaction.");
          // Re-fetch review to show submitted state
          const reviewRes = await fetch(`/api/bookings/${id}/review`, { cache: "no-store" });
          if (reviewRes.ok) {
            const r = await reviewRes.json();
            if (r && r.id) setReview(r);
          } else {
            // Fallback to local already-submitted display
            setReview({ id: "existing", rating, comment: comment.trim() || null, createdAt: new Date().toISOString() });
          }
          setSuccess(false);
          return;
        }
        throw new Error(data.error || "Failed to submit review");
      }
      setReview(data);
      setSuccess(true);
      toast.success("Thank you for your feedback! Your review has been successfully submitted.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to submit");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-blue-50">
        <div className="h-10 w-10 animate-spin rounded-full border-3 border-blue-200 border-t-blue-600" />
      </div>
    );
  }

  if (error) {
    const isForbidden = errorCode === 403 || error === "Forbidden";
    const isNotFound = errorCode === 404;
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/50 flex flex-col">
        <header className="sticky top-0 z-50 border-b border-gray-100/80 bg-white/80 backdrop-blur-xl">
          <div className="mx-auto flex h-14 max-w-2xl items-center px-4">
            <Link href="/my-account" className="flex items-center gap-2 text-gray-500 hover:text-gray-900 transition-colors">
              <ArrowLeft className="h-4 w-4" /> <span className="text-sm font-medium">Back</span>
            </Link>
          </div>
        </header>
        <main className="mx-auto max-w-2xl w-full px-4 py-10">
          <Card className="border-red-200">
            <CardContent className="p-8 text-center space-y-3">
              <AlertCircle className="h-10 w-10 text-red-500 mx-auto" />
              <h2 className="text-lg font-semibold">
                {isForbidden ? "Unauthorized Access" : isNotFound ? "Transaction Not Found" : "Unable to load feedback"}
              </h2>
              <p className="text-sm text-gray-500">
                {isForbidden
                  ? "You are not authorized to review this transaction. Please ensure you are logged into the correct account and use your personal feedback link."
                  : isNotFound
                    ? "The requested transaction could not be found. Please check your feedback link."
                    : error}
              </p>
              <Link href="/my-account"><Button variant="outline" className="mt-2">Go to My Account</Button></Link>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  if (!booking) return null;

  // Validate COMPLETED status (DELIVERED)
  if (booking.status !== "DELIVERED") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/50">
        <header className="sticky top-0 z-50 border-b border-gray-100/80 bg-white/80 backdrop-blur-xl">
          <div className="mx-auto flex h-14 max-w-2xl items-center px-4">
            <Link href={`/my-account/bookings/${booking.id}`} className="flex items-center gap-2 text-gray-500 hover:text-gray-900">
              <ArrowLeft className="h-4 w-4" /> <span className="text-sm font-medium">Back</span>
            </Link>
            <span className="mx-auto text-sm font-semibold">{booking.referenceNumber}</span>
            <div className="w-14" />
          </div>
        </header>
        <main className="mx-auto max-w-2xl px-4 py-6">
          <Card className="border-amber-200">
            <CardContent className="p-8 text-center space-y-3">
              <AlertCircle className="h-10 w-10 text-amber-500 mx-auto" />
              <h2 className="text-lg font-semibold">Feedback Not Available</h2>
              <p className="text-sm text-gray-500">Feedback can only be submitted for completed transactions. This booking is currently <strong>{booking.status.replace(/_/g, " ")}</strong>.</p>
              <Link href={`/my-account/bookings/${booking.id}`}><Button variant="outline" className="mt-2">View Booking</Button></Link>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  const completionDate = booking.checkOut || booking.updatedAt || booking.createdAt;
  const formattedDate = new Date(completionDate).toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" });

  // Already submitted state (also after success)
  if (review) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/50">
        <header className="sticky top-0 z-50 border-b border-gray-100/80 bg-white/80 backdrop-blur-xl">
          <div className="mx-auto flex h-14 max-w-2xl items-center px-4">
            <Link href="/my-account" className="flex items-center gap-2 text-gray-500 hover:text-gray-900">
              <ArrowLeft className="h-4 w-4" /> <span className="text-sm font-medium">Back</span>
            </Link>
            <span className="mx-auto text-sm font-semibold">Feedback</span>
            <div className="w-14" />
          </div>
        </header>
        <main className="mx-auto max-w-2xl px-4 py-6 space-y-5">
          <Card className="overflow-hidden">
            <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-4">
              <p className="text-xs text-emerald-100">Booking Reference</p>
              <p className="text-lg font-bold text-white font-mono">{booking.referenceNumber}</p>
              <p className="text-xs text-emerald-100 mt-1">Completed on {formattedDate}</p>
            </div>
            <CardContent className="p-6 text-center space-y-4">
              <div className="flex justify-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
                  <CheckCircle2 className="h-8 w-8 text-emerald-600" />
                </div>
              </div>
              <h2 className="text-lg font-semibold">Thank you! Feedback has already been submitted for this transaction.</h2>
              <p className="text-sm text-gray-500">{success ? "Thank you for your feedback! Your review has been successfully submitted." : "Your review is saved and no additional submissions are allowed for this booking."}</p>
              <div className="rounded-xl border bg-gray-50 p-4 space-y-2">
                <p className="text-xs font-medium text-gray-400 uppercase">Your Rating</p>
                <div className="flex justify-center gap-1">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star key={s} className={`h-6 w-6 ${s <= review.rating ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`} />
                  ))}
                </div>
                {review.comment && <p className="text-sm text-gray-700 bg-white rounded-lg border p-3 text-left">{review.comment}</p>}
                <p className="text-xs text-gray-400">Submitted on {new Date(review.createdAt).toLocaleString("en-PH")}</p>
              </div>
              <div className="flex gap-2 justify-center">
                <Link href={`/my-account/bookings/${booking.id}`}><Button variant="outline">View Booking</Button></Link>
                <Link href="/my-account"><Button>Back to My Account</Button></Link>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/50">
      <header className="sticky top-0 z-50 border-b border-gray-100/80 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-2xl items-center px-4">
          <Link href={`/my-account/bookings/${booking.id}`} className="flex items-center gap-2 text-gray-500 hover:text-gray-900">
            <ArrowLeft className="h-4 w-4" /> <span className="text-sm font-medium">Back</span>
          </Link>
          <span className="mx-auto text-sm font-semibold">Write Feedback</span>
          <div className="w-14" />
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-6 space-y-5">
        {/* Transaction Information */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-100">
                <Package className="h-4 w-4 text-blue-600" />
              </div>
              Transaction Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between rounded-lg border bg-gray-50 p-3">
              <div className="flex items-center gap-2.5">
                <Package className="h-4 w-4 text-gray-400" />
                <div>
                  <p className="text-[11px] text-gray-400 uppercase">Booking Reference</p>
                  <p className="text-sm font-bold font-mono">{booking.referenceNumber}</p>
                </div>
              </div>
              <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 border">DELIVERED</Badge>
            </div>
            <div className="flex items-center gap-2.5 rounded-lg border bg-gray-50 p-3">
              <Calendar className="h-4 w-4 text-gray-400" />
              <div>
                <p className="text-[11px] text-gray-400 uppercase">Completion Date</p>
                <p className="text-sm font-medium">{formattedDate}</p>
              </div>
            </div>
            <p className="text-xs text-gray-500">Your booking is marked as completed. You may now share your experience — one review per transaction.</p>
          </CardContent>
        </Card>

        {/* Feedback Form */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">How was your experience?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div>
              <label className="text-sm font-medium">Rating (1–5 stars) <span className="text-red-500">*</span></label>
              <div className="mt-2 flex gap-1">
                {[1, 2, 3, 4, 5].map((s) => (
                  <button
                    key={s}
                    type="button"
                    onMouseEnter={() => setHoverRating(s)}
                    onMouseLeave={() => setHoverRating(0)}
                    onClick={() => setRating(s)}
                    aria-label={`Rate ${s} star${s > 1 ? "s" : ""}`}
                    className="p-1"
                  >
                    <Star className={`h-9 w-9 transition-colors ${ (hoverRating || rating) >= s ? "fill-yellow-400 text-yellow-400" : "text-gray-300 hover:text-yellow-200"}`} />
                  </button>
                ))}
              </div>
              {rating > 0 && <p className="mt-1 text-xs text-gray-500">{rating} star{rating > 1 ? "s" : ""} selected</p>}
            </div>

            <div>
              <label htmlFor="review" className="text-sm font-medium">Review / Feedback message</label>
              <textarea
                id="review"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                maxLength={2000}
                rows={5}
                placeholder="Tell us about your experience with DropnFly..."
                className="mt-2 w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 resize-none"
              />
              <p className="mt-1 text-xs text-gray-400 text-right">{comment.length} / 2000</p>
            </div>

            <Button onClick={handleSubmit} disabled={rating === 0 || submitting} className="w-full bg-orange-500 hover:bg-orange-600 text-white">
              {submitting ? "Submitting..." : "Submit Feedback"}
            </Button>
            <p className="text-center text-xs text-gray-400">One review per transaction. You cannot submit another review for this booking.</p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
