"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, ExternalLink, Home } from "lucide-react";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { PublicFooter } from "@/components/layout/PublicFooter";

interface LuggageItem {
  type: string;
  qty: number;
  price: number;
}

interface BookingData {
  referenceNumber: string;
  qrCode: string;
  pickupLocation: string;
  dropOffLocation: string;
  checkIn: string;
  numberOfBags: number;
  luggageDetails: string | null;
  totalPrice: number;
  status: string;
  customer: { name: string; email: string };
}

export default function ConfirmPage() {
  const params = useParams();
  const [booking, setBooking] = useState<BookingData | null>(null);

  useEffect(() => {
    const abort = new AbortController();
    fetch(`/api/public/bookings/${params.reference}`, { signal: abort.signal })
      .then((r) => r.json())
      .then((data) => { if (!abort.signal.aborted) setBooking(data); })
      .catch(() => {});
    return () => abort.abort();
  }, [params.reference]);

  if (!booking) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-blue-50/50">
      <PublicHeader showBackToHome />

      <main className="mx-auto max-w-3xl px-4 py-12">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-green-100 shadow-lg shadow-green-200">
            <CheckCircle className="h-10 w-10 text-green-600" />
          </div>
          <h1 className="text-3xl font-bold text-green-700">
            Booking Confirmed!
          </h1>
          <p className="mt-2 text-gray-600">
            A confirmation email has been sent to{" "}
            <strong>{booking.customer.email}</strong>
          </p>
        </div>

        <Card className="border-t-4 border-green-500 shadow-lg">
          <CardHeader>
            <CardTitle>Booking Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="rounded-lg bg-blue-50 p-4 text-center shadow-sm">
              <p className="text-sm text-gray-600">Reference Number</p>
              <p className="mt-1 text-2xl font-bold tracking-wider text-blue-700">
                {booking.referenceNumber}
              </p>
            </div>

            <div className="grid gap-4 text-sm md:grid-cols-2">
              <div className="rounded-lg border bg-gray-50/50 p-3">
                <p className="text-gray-500">Customer</p>
                <p className="font-medium">{booking.customer.name}</p>
              </div>
              <div className="rounded-lg border bg-gray-50/50 p-3">
                <p className="text-gray-500">Status</p>
                <p className="font-medium capitalize text-yellow-600">
                  {booking.status.replace("_", " ")}
                </p>
              </div>
              <div className="rounded-lg border bg-gray-50/50 p-3">
                <p className="text-gray-500">Pickup Location</p>
                <p className="font-medium">{booking.pickupLocation}</p>
              </div>
              <div className="rounded-lg border bg-gray-50/50 p-3">
                <p className="text-gray-500">Drop-off Location</p>
                <p className="font-medium">{booking.dropOffLocation}</p>
              </div>
              <div className="rounded-lg border bg-gray-50/50 p-3">
                <p className="text-gray-500">Scheduled Date</p>
                <p className="font-medium">
                  {new Date(booking.checkIn).toLocaleDateString("en-PH", {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
              <div className="rounded-lg border bg-gray-50/50 p-3">
                <p className="text-gray-500">Luggage</p>
                {(() => {
                  let items: LuggageItem[] = [];
                  try {
                    if (booking.luggageDetails) items = JSON.parse(booking.luggageDetails);
                  } catch {}
                  return items.length > 0 ? (
                    <div className="mt-1 space-y-0.5">
                      {items.map((item, i) => (
                        <p key={i} className="text-sm font-medium">
                          {item.type}: {item.qty}x (&#x20B1;{(item.price * item.qty).toFixed(2)})
                        </p>
                      ))}
                      <p className="pt-1 text-xs text-gray-500">Total: {booking.numberOfBags} bag{booking.numberOfBags > 1 ? "s" : ""}</p>
                    </div>
                  ) : (
                    <p className="font-medium">{booking.numberOfBags} bag{booking.numberOfBags > 1 ? "s" : ""}</p>
                  );
                })()}
              </div>
            </div>

            {booking.totalPrice > 0 && (
              <div className="rounded-lg border border-green-200 bg-green-50/50 p-3 text-sm">
                <p className="text-gray-500">Payment</p>
                <p className="mt-1 font-medium text-green-700">
                  Total: &#x20B1;{booking.totalPrice.toFixed(2)}
                </p>
                <p className="text-xs text-green-600">Down payment processed. Remaining balance collectible on pickup/delivery.</p>
              </div>
            )}

            <div className="flex justify-center">
              <div className="rounded-xl border-2 border-dashed border-gray-200 bg-gray-50/50 p-4 shadow-sm">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`data:image/png;base64,${booking.qrCode}`}
                  alt="QR Code"
                  className="h-48 w-48"
                />
              </div>
            </div>

            <div className="flex flex-wrap justify-center gap-3">
              <Button asChild className="bg-blue-600 text-white shadow-lg transition-all hover:bg-blue-700 hover:shadow-xl">
                <Link href={`/track/${booking.referenceNumber}`}>
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Track My Luggage
                </Link>
              </Button>
              <Button asChild variant="outline" className="border-gray-200 text-gray-700 hover:bg-gray-50">
                <Link href="/"><Home className="mr-2 h-4 w-4" /> Back to Home</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>

      <PublicFooter />
    </div>
  );
}
