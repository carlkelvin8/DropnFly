"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { AlertCircle, Calendar, Camera, CheckCircle2, LockKeyhole, Package, Star } from "lucide-react";
import { toast } from "sonner";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { CameraQRScanner } from "@/components/scanner/CameraQRScanner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { normalizeScannedReference } from "@/lib/scan-reference";

interface FeedbackBooking {
  referenceNumber: string;
  completionDate: string;
}

interface Review {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: string;
}

export function FeedbackClient({ initialReference }: { initialReference: string }) {
  const [reference, setReference] = useState(() => normalizeScannedReference(initialReference));
  const [email, setEmail] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [booking, setBooking] = useState<FeedbackBooking | null>(null);
  const [review, setReview] = useState<Review | null>(null);
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState("");
  const emailInputRef = useRef<HTMLInputElement>(null);

  async function verifyTransaction(event?: React.FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    const normalized = normalizeScannedReference(reference);
    if (!normalized || !email.trim()) return;

    setVerifying(true);
    setError("");
    try {
      const response = await fetch("/api/public/feedback/access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reference: normalized, email }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Unable to verify transaction.");
      setReference(data.booking.referenceNumber);
      setAccessToken(data.accessToken);
      setBooking(data.booking);
      setReview(data.review || null);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Unable to verify transaction.";
      setError(message);
    } finally {
      setVerifying(false);
    }
  }

  function handleScan(raw: string) {
    const normalized = normalizeScannedReference(raw);
    setScanning(false);
    setError("");
    if (!normalized) {
      setError("The QR code does not contain a valid transaction number.");
      return;
    }
    setReference(normalized);
    window.setTimeout(() => emailInputRef.current?.focus(), 0);
  }

  async function submitFeedback() {
    if (!booking || !accessToken || rating < 1 || rating > 5) {
      toast.error("Please select a rating from 1 to 5.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch(`/api/public/feedback/${encodeURIComponent(booking.referenceNumber)}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ rating, comment: comment.trim() }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (response.status === 401) {
          setAccessToken("");
          setBooking(null);
        }
        throw new Error(data.error || "Unable to submit feedback.");
      }
      setReview(data);
      toast.success("Thank you! Your feedback was submitted.");
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Unable to submit feedback.";
      setError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  const completionDate = booking
    ? new Date(booking.completionDate).toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" })
    : "";

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/60 pt-16">
      <PublicHeader showBackToHome />
      <main className="mx-auto w-full max-w-2xl px-4 py-10 sm:py-14">
        <div className="mb-7 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-orange-100">
            <Star className="h-7 w-7 fill-orange-500 text-orange-500" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900">Share Your Feedback</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Verify your completed transaction—no account or login required.
          </p>
        </div>

        {!booking ? (
          <Card className="border-t-4 border-t-orange-500 shadow-lg">
            <CardHeader>
              <CardTitle className="text-lg">Verify your transaction</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <form onSubmit={verifyTransaction} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="feedback-reference">Transaction number</Label>
                  <Input
                    id="feedback-reference"
                    value={reference}
                    onChange={(event) => setReference(event.target.value.toUpperCase())}
                    placeholder="e.g. DNF-261007-ABC123"
                    className="font-mono uppercase"
                    autoComplete="off"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="feedback-email">Booking email</Label>
                  <Input
                    ref={emailInputRef}
                    id="feedback-email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@email.com"
                    autoComplete="email"
                    required
                  />
                </div>
                {error && (
                  <div className="flex gap-2 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-700" role="alert">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}
                <Button type="submit" disabled={verifying} className="w-full bg-orange-500 text-white hover:bg-orange-600">
                  <LockKeyhole className="mr-2 h-4 w-4" />
                  {verifying ? "Verifying..." : "Access Feedback Form"}
                </Button>
              </form>

              {scanning ? (
                <div className="border-t pt-5">
                  <CameraQRScanner
                    onScan={handleScan}
                    onClose={() => setScanning(false)}
                    title="Scan Transaction QR"
                    description="Scan the QR from your DropnFly email or booking confirmation"
                  />
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setScanning(true)}
                  className="w-full rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 p-5 text-center transition-colors hover:border-blue-400 hover:bg-blue-50"
                >
                  <Camera className="mx-auto mb-2 h-7 w-7 text-blue-600" />
                  <p className="text-sm font-medium">Scan your QR code</p>
                  <p className="mt-1 text-xs text-muted-foreground">The transaction number will be filled in automatically.</p>
                </button>
              )}

              <p className="flex items-start gap-2 text-xs text-muted-foreground">
                <LockKeyhole className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                Your transaction number and booking email must match. Access expires after 30 minutes, and only one review is allowed per transaction.
              </p>
            </CardContent>
          </Card>
        ) : review ? (
          <Card className="overflow-hidden shadow-lg">
            <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-5 text-white">
              <p className="text-xs text-emerald-100">Transaction Number</p>
              <p className="font-mono text-lg font-bold">{booking.referenceNumber}</p>
            </div>
            <CardContent className="space-y-4 p-6 text-center">
              <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" />
              <div>
                <h2 className="text-xl font-semibold">Thank you for your feedback!</h2>
                <p className="mt-1 text-sm text-muted-foreground">Only one review is accepted for each transaction.</p>
              </div>
              <div className="rounded-xl border bg-slate-50 p-4">
                <div className="flex justify-center gap-1">
                  {[1, 2, 3, 4, 5].map((value) => (
                    <Star key={value} className={`h-6 w-6 ${value <= review.rating ? "fill-yellow-400 text-yellow-400" : "text-slate-300"}`} />
                  ))}
                </div>
                {review.comment && <p className="mt-3 rounded-lg bg-white p-3 text-left text-sm text-slate-700">{review.comment}</p>}
                <p className="mt-3 text-xs text-muted-foreground">Submitted {new Date(review.createdAt).toLocaleString("en-PH")}</p>
              </div>
              <Button asChild variant="outline"><Link href="/">Back to Home</Link></Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-5">
            <Card className="overflow-hidden shadow-md">
              <div className="bg-gradient-to-r from-blue-700 to-blue-600 px-5 py-4 text-white">
                <p className="text-xs text-blue-100">Verified Transaction</p>
                <p className="font-mono text-lg font-bold">{booking.referenceNumber}</p>
              </div>
              <CardContent className="grid gap-3 p-5 sm:grid-cols-2">
                <div className="flex items-center gap-3 rounded-lg bg-slate-50 p-3">
                  <Package className="h-5 w-5 text-blue-600" />
                  <div><p className="text-xs text-muted-foreground">Status</p><p className="text-sm font-semibold text-emerald-700">Delivered</p></div>
                </div>
                <div className="flex items-center gap-3 rounded-lg bg-slate-50 p-3">
                  <Calendar className="h-5 w-5 text-blue-600" />
                  <div><p className="text-xs text-muted-foreground">Completion date</p><p className="text-sm font-semibold">{completionDate}</p></div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-lg">
              <CardHeader><CardTitle className="text-lg">How was your DropnFly experience?</CardTitle></CardHeader>
              <CardContent className="space-y-5">
                <div>
                  <Label>Rating <span className="text-red-500">*</span></Label>
                  <div className="mt-2 flex gap-1">
                    {[1, 2, 3, 4, 5].map((value) => (
                      <button
                        key={value}
                        type="button"
                        onMouseEnter={() => setHoverRating(value)}
                        onMouseLeave={() => setHoverRating(0)}
                        onClick={() => setRating(value)}
                        className="rounded p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
                        aria-label={`Rate ${value} star${value > 1 ? "s" : ""}`}
                      >
                        <Star className={`h-9 w-9 transition-colors ${(hoverRating || rating) >= value ? "fill-yellow-400 text-yellow-400" : "text-slate-300"}`} />
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <Label htmlFor="feedback-comment">Feedback message</Label>
                  <textarea
                    id="feedback-comment"
                    value={comment}
                    onChange={(event) => setComment(event.target.value)}
                    maxLength={2000}
                    rows={5}
                    placeholder="Tell us about your experience..."
                    className="mt-2 w-full resize-none rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
                  />
                  <p className="mt-1 text-right text-xs text-muted-foreground">{comment.length} / 2000</p>
                </div>
                {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{error}</p>}
                <Button onClick={submitFeedback} disabled={!rating || submitting} className="w-full bg-orange-500 text-white hover:bg-orange-600">
                  {submitting ? "Submitting..." : "Submit Feedback"}
                </Button>
                <p className="text-center text-xs text-muted-foreground">Your feedback can only be submitted once for this transaction.</p>
              </CardContent>
            </Card>
          </div>
        )}
      </main>
      <PublicFooter />
    </div>
  );
}
