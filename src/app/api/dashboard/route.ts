import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSystemSettings, setting } from "@/lib/settings";
import { manilaDayRange, manilaMonthRange } from "@/lib/manila-time";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const now = new Date();
    const { start: startOfToday, end: endOfToday } = manilaDayRange(now);
    const startOfWeek = new Date(startOfToday.getTime() - 6 * 24 * 60 * 60 * 1000);
    const manilaToday = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Manila",
      year: "numeric",
      month: "numeric",
    }).formatToParts(now);
    const year = Number(manilaToday.find((part) => part.type === "year")?.value);
    const month = Number(manilaToday.find((part) => part.type === "month")?.value);
    const { start: startOfMonth } = manilaMonthRange(year, month);

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
      prisma.booking.aggregate({
        where: { status: { in: ["RECEIVED", "IN_STORAGE", "OUT_FOR_DELIVERY"] } },
        _sum: { numberOfBags: true },
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
        where: { checkIn: { gte: startOfToday, lt: endOfToday } },
      }),
      prisma.booking.count({
        where: { status: "DELIVERED", checkOut: { gte: startOfToday, lt: endOfToday } },
      }),
      prisma.booking.count({
        where: { status: "DELIVERED", checkOut: { gte: startOfWeek } },
      }),
      prisma.booking.count({
        where: {
          status: { in: ["RECEIVED", "IN_STORAGE", "OUT_FOR_DELIVERY"] },
          checkOut: { gte: startOfToday, lt: endOfToday },
        },
      }),
    ]);

    const settings = await getSystemSettings();
    const capacityTotal = parseInt(setting(settings, "max_simultaneous_bags", "0"));
    const bagsUsingCapacity = bookingCapacity._sum.numberOfBags || 0;
    const usagePercent = capacityTotal > 0 ? Math.round((bagsUsingCapacity / capacityTotal) * 100) : 0;
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
        capacityUsage: { used: bagsUsingCapacity, total: capacityTotal, percent: usagePercent },
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
