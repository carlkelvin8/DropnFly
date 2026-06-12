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
import { CheckCircle, Luggage, ExternalLink } from "lucide-react";

interface BookingData {
  referenceNumber: string;
  qrCode: string;
  pickupLocation: string;
  dropOffLocation: string;
  checkIn: string;
  numberOfBags: number;
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
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white">
      <header className="sticky top-0 z-50 border-b bg-white/80 shadow-sm backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4">
          <Link href="/" className="text-xl font-bold">
            <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              Dropnfly
            </span>
          </Link>
          <nav className="flex items-center gap-4">
            <Link
              href="/track"
              className="text-sm font-medium text-gray-600 transition-colors hover:text-blue-600"
            >
              Track Luggage
            </Link>
            <Button asChild className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md hover:from-blue-700 hover:to-indigo-700">
              <Link href="/book">Book Again</Link>
            </Button>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-12">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-green-100 shadow-lg shadow-green-200">
            <CheckCircle className="h-10 w-10 text-green-600" />
          </div>
          <h1 className="bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-3xl font-bold text-transparent">
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
            <div className="rounded-lg bg-gradient-to-r from-blue-50 to-indigo-50 p-4 text-center shadow-sm">
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
                <p className="text-gray-500">Number of Luggage</p>
                <p className="font-medium">{booking.numberOfBags}</p>
              </div>
            </div>

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

            <div className="flex justify-center gap-4">
              <Button asChild className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg transition-all hover:from-blue-700 hover:to-indigo-700 hover:shadow-xl">
                <Link href={`/track/${booking.referenceNumber}`}>
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Track My Luggage
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
