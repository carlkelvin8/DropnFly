"use client";

import { useEffect, useState } from "react";
import { MessageSquareQuote } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
import { FeedbackStars } from "./FeedbackStars";

interface Review { rating: number; comment: string | null; createdAt: string; customer?: { name: string } | null }

/** Shows the customer's rating and comment for a completed booking (operations view). */
export function BookingFeedbackCard({ bookingId, status }: { bookingId: string; status: string }) {
  const [review, setReview] = useState<Review | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (status !== "DELIVERED") return;
    let active = true;
    fetch(`/api/bookings/${bookingId}/review`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (active) setReview(data && typeof data.rating === "number" ? data : null); })
      .catch(() => {})
      .finally(() => { if (active) setLoaded(true); });
    return () => { active = false; };
  }, [bookingId, status]);

  if (status !== "DELIVERED") return null;
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base"><MessageSquareQuote className="h-4 w-4" /> Customer Feedback</CardTitle>
      </CardHeader>
      <CardContent>
        {!loaded ? (
          <p className="text-sm text-muted-foreground">Loading feedback…</p>
        ) : review ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2"><FeedbackStars rating={review.rating} size="h-5 w-5" /><span className="text-sm font-semibold">{review.rating} / 5</span></div>
            {review.comment ? <p className="rounded-lg bg-muted/40 p-3 text-sm">“{review.comment}”</p> : <p className="text-sm text-muted-foreground">No written comment.</p>}
            <p className="text-xs text-muted-foreground">Submitted {formatDate(review.createdAt)}{review.customer?.name ? ` by ${review.customer.name}` : ""}</p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">The customer has not submitted feedback for this transaction yet.</p>
        )}
      </CardContent>
    </Card>
  );
}
