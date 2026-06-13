"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, MapPin, Calendar, Luggage, Package, AlertCircle } from "lucide-react";

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
      if (!res.ok) {
        setError(data.error || "Failed to cancel");
        setCancelling(false);
        return;
      }

      router.refresh();
    } catch {
      setError("Network error");
      setCancelling(false);
    }
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
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
                      i <= currentStep
                        ? "bg-blue-600 text-white"
                        : "bg-gray-200 text-gray-400"
                    }`}
                  >
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
                <div>
                  <p className="font-medium">Storage Location</p>
                  <p className="text-gray-500">{booking.location.name} - {booking.location.city}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {payment && (
          <Card>
            <CardHeader>
              <CardTitle>Payment</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Amount</span>
                <span className="font-medium">₱{payment.amount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Method</span>
                <span>{payment.method}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Status</span>
                <Badge variant={payment.status === "PAID" ? "default" : "secondary"}>
                  {payment.status}
                </Badge>
              </div>
              {payment.paidAt && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Paid at</span>
                  <span>{new Date(payment.paidAt).toLocaleString()}</span>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {booking.luggagePhotos.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Luggage Photos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-2">
                {booking.luggagePhotos.map((photo, i) => (
                  <img
                    key={i}
                    src={photo}
                    alt={`Luggage ${i + 1}`}
                    className="rounded-lg object-cover w-full h-24"
                  />
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
          <Button
            variant="destructive"
            className="w-full"
            onClick={handleCancel}
            disabled={cancelling}
          >
            {cancelling ? "Cancelling..." : "Cancel Booking"}
          </Button>
        )}

        <div className="flex gap-2">
          <Link href={`/track/${booking.referenceNumber}`} className="flex-1">
            <Button variant="outline" className="w-full">Track</Button>
          </Link>
          <Link href={`/track/map/${booking.referenceNumber}`} className="flex-1">
            <Button variant="outline" className="w-full">Live Map</Button>
          </Link>
        </div>
      </main>
    </div>
  );
}
