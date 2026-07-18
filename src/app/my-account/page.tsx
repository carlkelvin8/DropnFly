"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  LogOut, Luggage, Package, Clock, MapPin, User, Trophy,
  Bell, ChevronRight, Plane, Shield, Sparkles, CalendarDays,
} from "lucide-react";
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

const statusConfig: Record<string, { color: string; bg: string; dot: string }> = {
  PENDING: { color: "text-amber-700", bg: "bg-amber-50 border-amber-200", dot: "bg-amber-500" },
  CONFIRMED: { color: "text-blue-700", bg: "bg-blue-50 border-blue-200", dot: "bg-blue-500" },
  RECEIVED: { color: "text-purple-700", bg: "bg-purple-50 border-purple-200", dot: "bg-purple-500" },
  IN_STORAGE: { color: "text-indigo-700", bg: "bg-indigo-50 border-indigo-200", dot: "bg-indigo-500" },
  OUT_FOR_DELIVERY: { color: "text-orange-700", bg: "bg-orange-50 border-orange-200", dot: "bg-orange-500" },
  DELIVERED: { color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200", dot: "bg-emerald-500" },
  CANCELLED: { color: "text-red-700", bg: "bg-red-50 border-red-200", dot: "bg-red-500" },
};

function StatusBadge({ status }: { status: string }) {
  const config = statusConfig[status] || statusConfig.PENDING;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${config.bg} ${config.color}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${config.dot}`} />
      {status.replace(/_/g, " ")}
    </span>
  );
}

function StatCard({ icon: Icon, label, value, sublabel, href, gradient }: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sublabel?: string;
  href?: string;
  gradient: string;
}) {
  const content = (
    <div className="group relative overflow-hidden rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5">
      <div className={`absolute -right-4 -top-4 h-20 w-20 rounded-full opacity-10 blur-xl ${gradient}`} />
      <div className="relative">
        <div className={`mb-3 inline-flex rounded-xl p-2.5 ${gradient}`}>
          <Icon className="h-5 w-5 text-white" />
        </div>
        <p className="text-2xl font-bold tracking-tight text-gray-900">{value}</p>
        <p className="text-sm font-medium text-gray-500">{label}</p>
        {sublabel && <p className="mt-0.5 text-xs text-gray-400">{sublabel}</p>}
      </div>
      {href && (
        <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-300 transition-transform group-hover:translate-x-0.5" />
      )}
    </div>
  );

  if (href) return <Link href={href}>{content}</Link>;
  return content;
}

export default function CustomerDashboardPage() {
  const router = useRouter();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [points, setPoints] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [meRes, bookingsRes, loyaltyRes] = await Promise.all([
          fetch("/api/auth/customer/me"),
          fetch("/api/customer/bookings"),
          fetch("/api/customer/loyalty"),
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

        if (loyaltyRes.ok) {
          const loyaltyData = await loyaltyRes.json();
          setPoints(loyaltyData.points);
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
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="relative">
            <div className="h-10 w-10 animate-spin rounded-full border-3 border-blue-200 border-t-blue-600" />
            <Luggage className="absolute inset-0 m-auto h-4 w-4 text-blue-600" />
          </div>
          <p className="text-sm text-gray-400 animate-pulse">Loading your account...</p>
        </div>
      </div>
    );
  }

  const activeBookings = bookings.filter((b) => !["DELIVERED", "CANCELLED"].includes(b.status));
  const completedBookings = bookings.filter((b) => ["DELIVERED", "CANCELLED"].includes(b.status));
  const firstName = customer?.name.split(" ")[0] || "there";

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/50">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-gray-100/80 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-violet-600 shadow-lg shadow-blue-600/20">
              <Luggage className="h-4.5 w-4.5 text-white" />
            </div>
            <span className="text-lg font-bold tracking-tight">
              Drop<span className="text-blue-600">nfly</span>
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <PushManager
              subscribeUrl="/api/customer/notifications/subscribe"
              unsubscribeUrl="/api/customer/notifications/subscribe"
              vapidKeyUrl="/api/notifications/vapid-key"
            />
            <div className="hidden sm:flex items-center gap-2 rounded-full bg-gray-50 px-3 py-1.5">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-violet-500">
                <User className="h-3 w-3 text-white" />
              </div>
              <span className="text-sm font-medium text-gray-700">{customer?.name}</span>
            </div>
            <Button variant="ghost" size="sm" onClick={handleLogout} className="text-gray-400 hover:text-red-500 hover:bg-red-50">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 sm:px-6 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">
                Welcome back, {firstName} <span className="inline-block animate-[wave_2s_ease-in-out_infinite]">👋</span>
              </h1>
              <p className="mt-1 text-gray-500">Here&apos;s what&apos;s happening with your luggage</p>
            </div>
            <Link href="/book">
              <Button className="hidden sm:inline-flex gap-2 bg-gradient-to-r from-blue-600 to-violet-600 shadow-lg shadow-blue-600/20 hover:shadow-xl hover:shadow-blue-600/30 transition-all">
                <Plane className="h-4 w-4" />
                New Booking
              </Button>
            </Link>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4 mb-8">
          <StatCard
            icon={Package}
            label="Active"
            value={activeBookings.length}
            sublabel="In progress"
            gradient="bg-gradient-to-br from-blue-500 to-blue-600"
          />
          <StatCard
            icon={Clock}
            label="Completed"
            value={completedBookings.length}
            sublabel="All time"
            gradient="bg-gradient-to-br from-emerald-500 to-emerald-600"
          />
          <StatCard
            icon={Trophy}
            label="Points"
            value={points}
            sublabel={points >= 100 ? "Redeem available!" : `${100 - points} to redeem`}
            href="/my-account/loyalty"
            gradient="bg-gradient-to-br from-amber-500 to-orange-500"
          />
          <StatCard
            icon={Shield}
            label="Account"
            value="Active"
            sublabel={customer?.email}
            gradient="bg-gradient-to-br from-violet-500 to-purple-600"
          />
        </div>

        {/* Active Bookings */}
        {activeBookings.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
              <h2 className="text-lg font-semibold text-gray-900">Active Bookings</h2>
              <Badge variant="secondary" className="ml-1">{activeBookings.length}</Badge>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {activeBookings.map((booking) => (
                <Link key={booking.id} href={`/my-account/bookings/${booking.id}`}>
                  <div className="group relative overflow-hidden rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition-all hover:shadow-md hover:border-blue-100 hover:-translate-y-0.5">
                    <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-blue-500 to-violet-500 opacity-0 transition-opacity group-hover:opacity-100" />
                    <div className="flex items-start justify-between">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <code className="rounded-md bg-gray-100 px-2 py-0.5 text-xs font-mono font-semibold text-gray-700">
                            {booking.referenceNumber}
                          </code>
                          <StatusBadge status={booking.status} />
                        </div>
                        <div className="flex items-center gap-1.5 text-sm text-gray-500">
                          <MapPin className="h-3.5 w-3.5 text-gray-400" />
                          <span className="truncate max-w-[180px]">{booking.pickupLocation}</span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-gray-400">
                          <span className="flex items-center gap-1">
                            <Package className="h-3 w-3" />
                            {booking.numberOfBags} bag{booking.numberOfBags > 1 ? "s" : ""}
                          </span>
                          <span className="flex items-center gap-1">
                            <CalendarDays className="h-3 w-3" />
                            {new Date(booking.checkIn).toLocaleDateString("en-PH", { month: "short", day: "numeric" })}
                          </span>
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 text-gray-300 transition-transform group-hover:translate-x-0.5" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* All Bookings */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">All Bookings</h2>
            <span className="text-sm text-gray-400">{bookings.length} total</span>
          </div>

          {bookings.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-white p-12 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-50 to-violet-50">
                <Sparkles className="h-8 w-8 text-blue-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">No bookings yet</h3>
              <p className="mt-1 text-sm text-gray-500 max-w-xs mx-auto">
                Book your first luggage pickup and enjoy hassle-free travel
              </p>
              <Link href="/book">
                <Button className="mt-5 gap-2 bg-gradient-to-r from-blue-600 to-violet-600">
                  <Plane className="h-4 w-4" />
                  Book Now
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {bookings.map((booking) => (
                <Link key={booking.id} href={`/my-account/bookings/${booking.id}`}>
                  <div className="group flex items-center justify-between rounded-xl border border-gray-100 bg-white px-5 py-4 transition-all hover:shadow-sm hover:border-gray-200">
                    <div className="flex items-center gap-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-50 group-hover:bg-blue-50 transition-colors">
                        <Package className="h-5 w-5 text-gray-400 group-hover:text-blue-500 transition-colors" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-gray-900">{booking.referenceNumber}</span>
                          <StatusBadge status={booking.status} />
                        </div>
                        <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-400">
                          <span>{booking.pickupLocation}</span>
                          <span>•</span>
                          <span>{booking.numberOfBags} bag{booking.numberOfBags > 1 ? "s" : ""}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-gray-400 hidden sm:block">
                        {new Date(booking.createdAt).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}
                      </span>
                      <ChevronRight className="h-4 w-4 text-gray-300 transition-transform group-hover:translate-x-0.5" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Mobile FAB */}
        <Link href="/book" className="sm:hidden fixed bottom-6 right-6 z-40">
          <Button size="lg" className="h-14 w-14 rounded-full bg-gradient-to-br from-blue-600 to-violet-600 shadow-xl shadow-blue-600/30 p-0">
            <Plane className="h-6 w-6" />
          </Button>
        </Link>
      </main>
    </div>
  );
}
