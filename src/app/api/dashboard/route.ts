import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const [
      totalLocations,
      totalBookings,
      deliveredBookings,
      monthlyBookings,
      monthlyDelivered,
      capacityResult,
      bookingCapacity,
      totalUsers,
      bookingDurations,
      luggageData,
    ] = await Promise.all([
      prisma.storageLocation.count({ where: { isActive: true } }),
      prisma.booking.count(),
      prisma.booking.count({ where: { status: "DELIVERED" } }),
      prisma.booking.count({
        where: { createdAt: { gte: startOfMonth } },
      }),
      prisma.booking.count({
        where: { status: "DELIVERED", createdAt: { gte: startOfMonth } },
      }),
      prisma.storageLocation.aggregate({
        _sum: { capacity: true },
        where: { isActive: true },
      }),
      prisma.booking.count({
        where: { status: { in: ["RECEIVED", "IN_STORAGE"] } },
      }),
      prisma.user.count(),
      prisma.booking.findMany({
        where: { checkOut: { not: null }, status: "DELIVERED" },
        select: { checkIn: true, checkOut: true },
      }),
      prisma.booking.findMany({
        where: { luggageDetails: { not: null }, status: { not: "CANCELLED" } },
        select: { luggageDetails: true },
        take: 500,
      }),
    ]);

    const capacityTotal = capacityResult._sum.capacity ?? 0;
    const usagePercent = capacityTotal > 0 ? Math.round((bookingCapacity / capacityTotal) * 100) : 0;
    const completionRate = totalBookings > 0 ? Math.round((deliveredBookings / totalBookings) * 100) : 0;

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

    return NextResponse.json({
      capacityUsage: { used: bookingCapacity, total: capacityTotal, percent: usagePercent },
      bookingsThisMonth: monthlyBookings,
      claimedThisMonth: monthlyDelivered,
      completionRate,
      totalUsers,
      totalBookings,
      deliveredBookings,
      durationBuckets,
      bagDistribution,
    });
  } catch (e) {
    console.error("Dashboard API error:", e);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
