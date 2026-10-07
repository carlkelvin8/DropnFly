import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSystemSettings, setting } from "@/lib/settings";
import { manilaDayRange, manilaMonthRange } from "@/lib/manila-time";

// The figures are global (no per-user data), and the dashboard is opened by every user on
// every navigation, so share one computed result for a short time per server instance.
const STATS_TTL_MS = 20_000;
let statsCache: { at: number; body: unknown } | null = null;
const NO_STORE = { "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0" };

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (statsCache && Date.now() - statsCache.at < STATS_TTL_MS) {
      return NextResponse.json(statsCache.body, { headers: NO_STORE });
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
      bookingCounts,
      bookingCapacity,
      totalUsers,
      bookingDurations,
      luggageData,
      settings,
    ] = await Promise.all([
      prisma.$queryRaw<Array<{
        totalBookings: number | bigint;
        deliveredBookings: number | bigint;
        monthlyBookings: number | bigint;
        monthlyDelivered: number | bigint;
        pendingDeliveries: number | bigint;
        outForDelivery: number | bigint;
        bookingsThisWeek: number | bigint;
        bookingsToday: number | bigint;
        deliveredToday: number | bigint;
        deliveredThisWeek: number | bigint;
        pendingToday: number | bigint;
      }>>`
        SELECT
          COUNT(*)::int AS "totalBookings",
          COUNT(*) FILTER (WHERE status = 'DELIVERED')::int AS "deliveredBookings",
          COUNT(*) FILTER (WHERE "createdAt" >= ${startOfMonth})::int AS "monthlyBookings",
          COUNT(*) FILTER (WHERE status = 'DELIVERED' AND "createdAt" >= ${startOfMonth})::int AS "monthlyDelivered",
          COUNT(*) FILTER (WHERE status = 'PENDING')::int AS "pendingDeliveries",
          COUNT(*) FILTER (WHERE status = 'OUT_FOR_DELIVERY')::int AS "outForDelivery",
          COUNT(*) FILTER (WHERE "createdAt" >= ${startOfWeek})::int AS "bookingsThisWeek",
          COUNT(*) FILTER (WHERE "checkIn" >= ${startOfToday} AND "checkIn" < ${endOfToday})::int AS "bookingsToday",
          COUNT(*) FILTER (WHERE status = 'DELIVERED' AND "checkOut" >= ${startOfToday} AND "checkOut" < ${endOfToday})::int AS "deliveredToday",
          COUNT(*) FILTER (WHERE status = 'DELIVERED' AND "checkOut" >= ${startOfWeek})::int AS "deliveredThisWeek",
          COUNT(*) FILTER (
            WHERE status IN ('RECEIVED', 'IN_STORAGE', 'OUT_FOR_DELIVERY')
              AND "checkOut" >= ${startOfToday}
              AND "checkOut" < ${endOfToday}
          )::int AS "pendingToday"
        FROM "Booking"
      `,
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
      getSystemSettings(),
    ]);

    const counts = bookingCounts[0];
    if (!counts) throw new Error("Dashboard count query returned no row");
    const totalBookings = Number(counts.totalBookings);
    const deliveredBookings = Number(counts.deliveredBookings);
    const monthlyBookings = Number(counts.monthlyBookings);
    const monthlyDelivered = Number(counts.monthlyDelivered);
    const pendingDeliveries = Number(counts.pendingDeliveries);
    const outForDelivery = Number(counts.outForDelivery);
    const bookingsThisWeek = Number(counts.bookingsThisWeek);
    const bookingsToday = Number(counts.bookingsToday);
    const deliveredToday = Number(counts.deliveredToday);
    const deliveredThisWeek = Number(counts.deliveredThisWeek);
    const pendingToday = Number(counts.pendingToday);
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
        const items = JSON.parse(b.luggageDetails) as { type?: unknown; qty?: unknown }[];
        for (const item of items) {
          // luggageDetails also holds a { services: [...] } entry; only count real bag lines.
          if (typeof item?.type !== "string") continue;
          const qty = Number(item.qty);
          if (!Number.isFinite(qty) || qty <= 0) continue;
          bagDistribution[item.type] = (bagDistribution[item.type] || 0) + qty;
        }
      } catch {}
    }

    const body = {
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
    };
    statsCache = { at: Date.now(), body };
    return NextResponse.json(body, { headers: NO_STORE });
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
