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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Package,
  MapPin,
  Calendar,
  Luggage,
  ChevronLeft,
  Navigation,
} from "lucide-react";

interface BookingData {
  referenceNumber: string;
  qrCode: string;
  pickupLocation: string;
  dropOffLocation: string;
  checkIn: string;
  checkOut: string | null;
  numberOfBags: number;
  luggageDetails: string | null;
  totalPrice: number;
  status: string;
  customer: { name: string; email: string };
}

const statusConfig: Record<string, { label: string; color: "default" | "secondary" | "success" | "warning" | "destructive" | "outline"; step: number }> = {
  PENDING: { label: "Pending", color: "warning", step: 0 },
  CONFIRMED: { label: "Confirmed", color: "secondary", step: 1 },
  RECEIVED: { label: "Received", color: "default", step: 2 },
  IN_STORAGE: { label: "In Storage", color: "default", step: 3 },
  OUT_FOR_DELIVERY: { label: "Out for Delivery", color: "default", step: 4 },
  DELIVERED: { label: "Delivered", color: "success", step: 5 },
  CANCELLED: { label: "Cancelled", color: "destructive", step: -1 },
};

const steps = [
  { label: "Pending", icon: Package },
  { label: "Confirmed", icon: Package },
  { label: "Received", icon: Package },
  { label: "In Storage", icon: Package },
  { label: "Out for Delivery", icon: Package },
  { label: "Delivered", icon: Package },
];

export default function TrackResultPage() {
  const params = useParams();
  const [booking, setBooking] = useState<BookingData | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const abort = new AbortController();
    fetch(`/api/public/bookings/${params.reference}`, { signal: abort.signal })
      .then((res) => {
        if (!res.ok) throw new Error("Not found");
        return res.json();
      })
      .then((data) => { if (!abort.signal.aborted) setBooking(data); })
      .catch(() => { if (!abort.signal.aborted) setNotFound(true); });
    return () => abort.abort();
  }, [params.reference]);

  if (notFound) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <h1 className="text-2xl font-bold">Booking Not Found</h1>
        <p className="text-gray-500">
          No booking found with reference &quot;{params.reference}&quot;
        </p>
        <Button asChild>
          <Link href="/track">Try Again</Link>
        </Button>
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

  const config = statusConfig[booking.status] || statusConfig.PENDING;
  const currentStep = config.step;

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <header className="sticky top-0 z-50 border-b bg-white/80 shadow-sm backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4">
          <Link href="/" className="text-xl font-bold">
            <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              Dropnfly
            </span>
          </Link>
          <Button variant="ghost" asChild>
            <Link href="/track" className="flex items-center gap-1">
              <ChevronLeft className="h-4 w-4" />
              Search Again
            </Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 shadow-lg shadow-blue-200">
            <Package className="h-6 w-6 text-blue-600" />
          </div>
          <h1 className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-2xl font-bold text-transparent">
            Luggage Status
          </h1>
          <p className="mt-1 font-mono text-lg tracking-wider text-blue-700">
            {booking.referenceNumber}
          </p>
        </div>

        <Card className="mb-6 border-t-4 border-blue-500 shadow-lg">
          <CardHeader>
            <CardTitle>Current Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-6 text-center">
              <Badge variant={config.color} className="px-4 py-1.5 text-sm shadow-sm">
                {config.label}
              </Badge>
            </div>

            {currentStep >= 0 && (
              <div className="relative">
                <div className="absolute left-[23px] top-2 h-[calc(100%-16px)] w-0.5 bg-gradient-to-b from-blue-500 to-gray-200" />
                <div className="space-y-0">
                  {steps.map((step, i) => {
                    const Icon = step.icon;
                    const isActive = i <= currentStep;
                    const isCurrent = i === currentStep;

                    return (
                      <div key={step.label} className="relative flex items-start gap-4 pb-8 last:pb-0">
                        <div className="relative z-10 flex flex-col items-center">
                          <div
                            className={`flex h-12 w-12 items-center justify-center rounded-full border-2 shadow-sm transition-all ${
                              isActive
                                ? "border-blue-600 bg-blue-600 text-white shadow-md shadow-blue-200"
                                : "border-gray-300 bg-white text-gray-400"
                            } ${isCurrent ? "ring-4 ring-blue-200" : ""}`}
                          >
                            <Icon className="h-5 w-5" />
                          </div>
                        </div>
                        <div className="flex flex-col justify-center pt-2.5">
                          <p
                            className={`text-sm font-semibold ${
                              isActive ? "text-blue-800" : "text-gray-400"
                            }`}
                          >
                            {step.label}
                            {isCurrent && (
                              <span className="ml-2 inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                                Current
                              </span>
                            )}
                          </p>
                          {isActive && !isCurrent && (
                            <p className="text-xs text-blue-500">Completed</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {currentStep < 0 && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-center">
                <p className="text-sm font-medium text-red-600">This booking was cancelled.</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-t-4 border-indigo-500 shadow-lg">
          <CardHeader>
            <CardTitle>Booking Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 text-sm md:grid-cols-2">
              <div className="flex items-start gap-3 rounded-lg border bg-gray-50/50 p-3">
                <MapPin className="mt-0.5 h-4 w-4 text-blue-500" />
                <div>
                  <p className="text-gray-500">Pickup Location</p>
                  <p className="font-medium">{booking.pickupLocation}</p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-lg border bg-gray-50/50 p-3">
                <MapPin className="mt-0.5 h-4 w-4 text-indigo-500" />
                <div>
                  <p className="text-gray-500">Drop-off Location</p>
                  <p className="font-medium">{booking.dropOffLocation}</p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-lg border bg-gray-50/50 p-3">
                <Calendar className="mt-0.5 h-4 w-4 text-blue-500" />
                <div>
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
              </div>
              <div className="flex items-start gap-3 rounded-lg border bg-gray-50/50 p-3">
                <Luggage className="mt-0.5 h-4 w-4 text-indigo-500" />
                <div>
                  <p className="text-gray-500">Number of Luggage</p>
                  <p className="font-medium">{booking.numberOfBags}</p>
                </div>
              </div>
            </div>

            {booking.luggageDetails && (
              <div className="mt-4 border-t pt-4">
                <p className="text-sm text-gray-500">Luggage Details</p>
                <p className="mt-1 text-sm">{booking.luggageDetails}</p>
              </div>
            )}

            <div className="mt-4 flex justify-center gap-3 border-t pt-4">
              <Button asChild className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg transition-all hover:from-blue-700 hover:to-indigo-700 hover:shadow-xl">
                <Link href={`/track/map/${params.reference}`}>
                  <Navigation className="mr-2 h-4 w-4" />
                  Live Map
                </Link>
              </Button>
              <Button asChild variant="outline" className="border-blue-200 text-blue-700 hover:bg-blue-50">
                <Link href="/book">Book Another Pickup</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
