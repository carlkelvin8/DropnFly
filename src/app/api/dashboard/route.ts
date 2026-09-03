import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSystemSettings, setting } from "@/lib/settings";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const startOfDurations = new Date(now);
    startOfDurations.setFullYear(startOfDurations.getFullYear() - 1);

    const [
      totalBookings,
      deliveredBookings,
      monthlyBookings,
      monthlyDelivered,
      bookingCapacity,
      totalUsers,
      bookingDurations,
      luggageData,
      pendingDeliveries,
      outForDelivery,
      bookingsThisWeek,
      bookingsToday,
      deliveredToday,
      deliveredThisWeek,
      pendingToday,
    ] = await Promise.all([
      prisma.booking.count(),
      prisma.booking.count({ where: { status: "DELIVERED" } }),
      prisma.booking.count({
        where: { createdAt: { gte: startOfMonth } },
      }),
      prisma.booking.count({
        where: { status: "DELIVERED", createdAt: { gte: startOfMonth } },
      }),
      prisma.booking.count({
        where: { status: { in: ["RECEIVED", "IN_STORAGE"] } },
      }),
      prisma.user.count(),
      prisma.booking.findMany({
        where: { status: "DELIVERED", checkOut: { not: null, gte: startOfDurations } },
        select: { checkIn: true, checkOut: true },
        orderBy: { checkOut: "desc" },
        take: 5000,
      }),
      prisma.booking.findMany({
        where: { luggageDetails: { not: null }, status: { not: "CANCELLED" } },
        select: { luggageDetails: true },
        take: 500,
      }),
      prisma.booking.count({
        where: { status: "PENDING" },
      }),
      prisma.booking.count({
        where: { status: "OUT_FOR_DELIVERY" },
      }),
      prisma.booking.count({
        where: { createdAt: { gte: startOfWeek } },
      }),
      prisma.booking.count({
        where: { checkIn: { gte: startOfToday } },
      }),
      prisma.booking.count({
        where: { status: "DELIVERED", checkOut: { gte: startOfToday } },
      }),
      prisma.booking.count({
        where: { status: "DELIVERED", checkOut: { gte: startOfWeek } },
      }),
      prisma.booking.count({
        where: {
          status: { in: ["RECEIVED", "IN_STORAGE", "OUT_FOR_DELIVERY"] },
          checkOut: { gte: startOfToday },
        },
      }),
    ]);

    const settings = await getSystemSettings();
    const capacityTotal = parseInt(setting(settings, "max_simultaneous_bags", "0"));
    const usagePercent = capacityTotal > 0 ? Math.round((bookingCapacity / capacityTotal) * 100) : 0;
    const completionRateWeekly = bookingsThisWeek > 0 ? Math.round((deliveredThisWeek / bookingsThisWeek) * 100) : 0;

    const durationBuckets: Record<string, number> = { "0-1": 0, "2-3": 0, "4-7": 0, "8-14": 0, "15+": 0 };
    for (const b of bookingDurations) {
      if (b.checkIn && b.checkOut) {
        const days = Math.ceil((b.checkOut.getTime() - b.checkIn.getTime()) / (1000 * 60 * 60 * 24));
        if (days <= 1) durationBuckets["0-1"]++;
        else if (days <= 3) durationBuckets["2-3"]++;
        else if (days <= 7) durationBuckets["4-7"]++;
        else if (days <= 14) durationBuckets["8-14"]++;
        else durationBuckets["15+"]++;
      }
    }

    const bagDistribution: Record<string, number> = {};
    for (const b of luggageData) {
      if (!b.luggageDetails) continue;
      try {
        const items = JSON.parse(b.luggageDetails) as { type: string; qty: number }[];
        for (const item of items) {
          bagDistribution[item.type] = (bagDistribution[item.type] || 0) + item.qty;
        }
      } catch {}
    }

    return NextResponse.json(
      {
        capacityUsage: { used: bookingCapacity, total: capacityTotal, percent: usagePercent },
        bookingsThisMonth: monthlyBookings,
        claimedThisMonth: monthlyDelivered,
        totalUsers,
        totalBookings,
        deliveredBookings,
        pendingDeliveries,
        outForDelivery,
        bookingsThisWeek,
        bookingsToday,
        deliveredToday,
        deliveredThisWeek,
        completionRateWeekly,
        pendingToday,
        durationBuckets,
        bagDistribution,
      },
      {
        headers: { "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0" },
      }
    );
  } catch (e) {
    if (process.env.NODE_ENV === "development") {
      console.error("Dashboard API error:", e);
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
