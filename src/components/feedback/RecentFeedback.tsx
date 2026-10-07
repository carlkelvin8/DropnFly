"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MessageSquareQuote } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
import { FeedbackStars } from "./FeedbackStars";

interface Review {
  id: string;
  bookingId: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  customer: { name: string } | null;
  booking: { referenceNumber: string } | null;
}

/** Latest customer feedback (rating + comment), newest first. */
export function RecentFeedback({ limit = 10 }: { limit?: number }) {
  const [reviews, setReviews] = useState<Review[] | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/reviews", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => { if (active) setReviews(Array.isArray(data) ? data : []); })
      .catch(() => { if (active) setReviews([]); });
    return () => { active = false; };
  }, []);

  return (
    <Card className="border-t-2 border-t-yellow-400">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base"><MessageSquareQuote className="h-4 w-4" /> Recent Customer Feedback</CardTitle>
      </CardHeader>
      <CardContent>
        {reviews === null ? (
          <p className="text-sm text-muted-foreground">Loading feedback…</p>
        ) : reviews.length === 0 ? (
          <p className="text-sm text-muted-foreground">No customer feedback submitted yet.</p>
        ) : (
          <ul className="divide-y">
            {reviews.slice(0, limit).map((review) => (
              <li key={review.id} className="py-3 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-center gap-2">
                  <FeedbackStars rating={review.rating} />
                  <span className="text-sm font-semibold">{review.customer?.name || "Customer"}</span>
                  {review.booking?.referenceNumber && (
                    <Link href={`/dashboard/bookings/${review.bookingId}`} className="font-mono text-xs text-blue-600 hover:underline">{review.booking.referenceNumber}</Link>
                  )}
                  <span className="ml-auto text-xs text-muted-foreground">{formatDate(review.createdAt)}</span>
                </div>
                {review.comment && <p className="mt-1 text-sm text-muted-foreground">“{review.comment}”</p>}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
