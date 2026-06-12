"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import Link from "next/link";
import { AlertCircle, User, MapPin, Luggage, ArrowRight } from "lucide-react";

export default function BookPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get("name") as string,
      email: formData.get("email") as string,
      phone: formData.get("phone") as string,
      pickupLocation: formData.get("pickupLocation") as string,
      dropOffLocation: formData.get("dropOffLocation") as string,
      numberOfBags: formData.get("numberOfBags") as string,
      luggageDetails: formData.get("luggageDetails") as string,
      preferredDate: formData.get("preferredDate") as string,
    };

    let res: Response;
    try {
      res = await fetch("/api/public/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
    } catch {
      setError("Network error. Please check your connection.");
      setLoading(false);
      return;
    }

    if (!res.ok) {
      try {
        const err = await res.json();
        setError(err.error || "Something went wrong");
      } catch {
        setError("Something went wrong");
      }
      setLoading(false);
      return;
    }

    const result = await res.json();
    router.push(`/book/confirm/${result.referenceNumber}`);
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <header className="sticky top-0 z-50 border-b bg-white/80 shadow-sm backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
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
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-12">
        <div className="mb-8 text-center">
          <h1 className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-3xl font-bold text-transparent">
            Book a Pickup
          </h1>
          <p className="mt-2 text-gray-600">
            Schedule your luggage pickup. No registration needed.
          </p>
        </div>

        <Card className="border-t-4 border-blue-500 shadow-lg">
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-8">
              <div>
                <div className="mb-4 flex items-center gap-2">
                  <User className="h-5 w-5 text-blue-600" />
                  <h3 className="text-lg font-semibold">Contact Information</h3>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="name">Full Name</Label>
                    <Input id="name" name="name" placeholder="Juan Dela Cruz" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address</Label>
                    <Input id="email" name="email" type="email" placeholder="juan@email.com" required />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input id="phone" name="phone" type="tel" placeholder="+63 912 345 6789" required />
                  </div>
                </div>
              </div>

              <div className="border-t" />

              <div>
                <div className="mb-4 flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-blue-600" />
                  <h3 className="text-lg font-semibold">Pickup Details</h3>
                </div>
                <div className="grid gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="pickupLocation">Pickup Location</Label>
                    <Input id="pickupLocation" name="pickupLocation" placeholder="Enter pickup address" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dropOffLocation">Drop-off Location</Label>
                    <Input id="dropOffLocation" name="dropOffLocation" placeholder="Enter destination address" required />
                  </div>
                </div>
              </div>

              <div className="border-t" />

              <div>
                <div className="mb-4 flex items-center gap-2">
                  <Luggage className="h-5 w-5 text-blue-600" />
                  <h3 className="text-lg font-semibold">Luggage Details</h3>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="numberOfBags">Number of Luggage</Label>
                    <Input id="numberOfBags" name="numberOfBags" type="number" min="1" defaultValue="1" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="preferredDate">Preferred Date & Time</Label>
                    <Input id="preferredDate" name="preferredDate" type="datetime-local" required />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="luggageDetails">Luggage Details (optional)</Label>
                    <textarea
                      id="luggageDetails"
                      name="luggageDetails"
                      className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm"
                      placeholder="Describe your luggage (color, size, special instructions)"
                    />
                  </div>
                </div>
              </div>

              {error && (
                <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg transition-all hover:from-blue-700 hover:to-indigo-700 hover:shadow-xl"
                size="lg"
                disabled={loading}
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Submitting...
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    Confirm Booking
                    <ArrowRight className="h-5 w-5" />
                  </span>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
