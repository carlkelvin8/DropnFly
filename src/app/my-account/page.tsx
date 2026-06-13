"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LogOut, Luggage, Package, Clock, MapPin, User, Bell } from "lucide-react";
import { PushManager } from "@/components/PushManager";

interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
}

interface Booking {
  id: string;
  referenceNumber: string;
  status: string;
  pickupLocation: string;
  dropOffLocation: string;
  numberOfBags: number;
  totalPrice: number;
  checkIn: string;
  createdAt: string;
  location?: { name: string; city: string } | null;
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

export default function CustomerDashboardPage() {
  const router = useRouter();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [meRes, bookingsRes] = await Promise.all([
          fetch("/api/auth/customer/me"),
          fetch("/api/customer/bookings"),
        ]);

        if (!meRes.ok) {
          router.push("/my-account/login");
          return;
        }

        const meData = await meRes.json();
        setCustomer(meData);

        if (bookingsRes.ok) {
          const bookingsData = await bookingsRes.json();
          setBookings(bookingsData);
        }
      } catch {
        router.push("/my-account/login");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [router]);

  async function handleLogout() {
    await fetch("/api/auth/customer/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  const activeBookings = bookings.filter((b) => !["DELIVERED", "CANCELLED"].includes(b.status));
  const completedBookings = bookings.filter((b) => ["DELIVERED", "CANCELLED"].includes(b.status));

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-50 border-b bg-white shadow-sm">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-violet-600">
              <Luggage className="h-5 w-5 text-white" />
            </div>
            <span className="text-lg font-bold">Dropnfly</span>
          </Link>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">{customer?.name}</span>
            <PushManager
              subscribeUrl="/api/customer/notifications/subscribe"
              unsubscribeUrl="/api/customer/notifications/subscribe"
              vapidKeyUrl="/api/notifications/vapid-key"
            />
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold">My Account</h1>
          <p className="text-gray-500">Manage your bookings and profile</p>
        </div>

        <div className="grid gap-6 md:grid-cols-3 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Package className="h-5 w-5 text-blue-600" />
                Active Bookings
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{activeBookings.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Clock className="h-5 w-5 text-green-600" />
                Completed
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{completedBookings.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <User className="h-5 w-5 text-purple-600" />
                Account
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-gray-600">
              <p>{customer?.email}</p>
              <p>{customer?.phone}</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>My Bookings</span>
              <Link href="/book">
                <Button size="sm">New Booking</Button>
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {bookings.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Package className="mx-auto h-12 w-12 mb-3 text-gray-300" />
                <p>No bookings yet</p>
                <Link href="/book">
                  <Button className="mt-4" variant="outline">Book a Pickup</Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {bookings.map((booking) => (
                  <Link key={booking.id} href={`/my-account/bookings/${booking.id}`}>
                    <div className="flex items-center justify-between rounded-lg border p-4 transition-colors hover:bg-gray-50">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{booking.referenceNumber}</span>
                          <Badge className={statusColors[booking.status] || ""}>
                            {booking.status.replace(/_/g, " ")}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-gray-500">
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {booking.pickupLocation}
                          </span>
                          <span>{booking.numberOfBags} bag(s)</span>
                        </div>
                      </div>
                      <div className="text-right text-sm">
                        <p className="text-gray-500">{new Date(booking.createdAt).toLocaleDateString()}</p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
