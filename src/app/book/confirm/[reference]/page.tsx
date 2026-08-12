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
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const abort = new AbortController();
    fetch(`/api/public/bookings/${params.reference}`, { signal: abort.signal })
      .then((r) => {
        if (!r.ok) {
          if (r.status === 404) throw new Error("Booking not found");
          throw new Error("Failed to load booking");
        }
        return r.json();
      })
      .then((data) => { if (!abort.signal.aborted) setBooking(data); })
      .catch((e: unknown) => { if (!abort.signal.aborted) setError(e instanceof Error ? e.message : "Failed to load booking"); });
    return () => abort.abort();
  }, [params.reference]);

  if (error) {
    return (
      <div className="min-h-screen bg-blue-50/50">
        <PublicHeader showBackToHome />
        <main className="mx-auto flex max-w-xl flex-col items-center px-4 py-24 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
            <Home className="h-8 w-8 text-red-500" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Booking not found</h1>
          <p className="mt-2 text-sm text-gray-500">
            We couldn&apos;t find a booking with reference &quot;{String(params.reference)}&quot;.
            Check the reference number in your confirmation email and try again.
          </p>
          <div className="mt-6 flex gap-3">
            <Button asChild className="bg-orange-500 text-white">
              <Link href="/book">Book Luggage</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/track">Track Booking</Link>
            </Button>
          </div>
        </main>
        <PublicFooter />
      </div>
    );
  }

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
                  let items: Array<{ type?: string; qty?: number; price?: number; services?: string[] }> = [];
                  try {
                    if (booking.luggageDetails) items = JSON.parse(booking.luggageDetails);
                  } catch {}
                  const luggageItems = items.filter(
                    (i): i is { type: string; qty: number; price: number } =>
                      !!i && typeof i.type === "string" && typeof i.qty === "number"
                  );
                  const services = items.flatMap((i) =>
                    Array.isArray(i?.services) ? i.services : []
                  );
                  return luggageItems.length > 0 ? (
                    <div className="mt-1 space-y-0.5">
                      {luggageItems.map((item, i) => (
                        <p key={i} className="text-sm font-medium">
                          {item.type}: {item.qty}x (&#x20B1;{(item.price * item.qty).toFixed(2)})
                        </p>
                      ))}
                      {services.length > 0 && (
                        <div className="pt-1">
                          <p className="text-xs font-medium text-purple-700">Additional Services</p>
                          {services.map((svc, i) => (
                            <p key={i} className="text-sm text-purple-700">• {svc}</p>
                          ))}
                        </div>
                      )}
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
                <p className="text-xs text-green-600">Booking confirmed. Your down payment is recorded as pending — our team will confirm payment on pickup, or pay securely online from My Account.</p>
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
              <Button asChild className="bg-orange-500 text-white shadow-lg transition-all hover:bg-orange-600 hover:shadow-xl">
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
