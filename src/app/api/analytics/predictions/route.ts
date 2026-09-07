import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { generatePredictions } from "@/lib/gemini";
import { prisma } from "@/lib/prisma";
import { getSystemSettings, setting } from "@/lib/settings";

export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const [
      totalBookings,
      totalRevenue,
      bookingsByStatus,
      recentBookings,
      employeeCount,
    ] = await Promise.all([
      prisma.booking.count({ where: { status: { notIn: ["CANCELLED", "NO_SHOW"] } } }),
      prisma.payment.aggregate({ where: { status: "PAID", paidAt: { not: null } }, _sum: { amount: true } }),
      prisma.booking.groupBy({
        by: ["status"],
        _count: true,
      }),
      prisma.booking.findMany({
        where: {
          createdAt: { gte: new Date(Date.now() - 30 * 86400000) },
          status: { notIn: ["CANCELLED", "NO_SHOW"] },
        },
        select: { createdAt: true, totalPrice: true, checkIn: true },
        orderBy: { createdAt: "asc" },
      }),
      prisma.user.count({
        where: { role: "EMPLOYEE", isActive: true },
      }),
    ]);

    const settings = await getSystemSettings();
    const totalCapacity = parseInt(setting(settings, "max_simultaneous_bags", "0"));
    const activeBagTotal = await prisma.booking.aggregate({
      where: { status: { in: ["RECEIVED", "IN_STORAGE", "OUT_FOR_DELIVERY"] } },
      _sum: { numberOfBags: true },
    });
    const activeBags = activeBagTotal._sum.numberOfBags || 0;

    const hourlyDist: Record<number, number> = {};
    for (const b of recentBookings) {
      const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", hour: "2-digit", hourCycle: "h23" }).formatToParts(b.checkIn);
      const h = Number(parts.find((part) => part.type === "hour")?.value || "0");
      hourlyDist[h] = (hourlyDist[h] || 0) + 1;
    }

    const analyticsData = {
      totalBookings,
      totalRevenue: Number(totalRevenue._sum.amount || 0),
      bookingsByStatus,
      bookingsLast30Days: recentBookings.length,
      averageDailyBookings:
        recentBookings.length > 0 ? recentBookings.length / 30 : 0,
      peakHourCandidates: Object.entries(hourlyDist)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3)
        .map(([h]) => parseInt(h)),
      activeEmployees: employeeCount,
      storageCapacity: totalCapacity,
      storageUsed: activeBags,
      storageUtilization:
        totalCapacity > 0
          ? Math.round((activeBags / totalCapacity) * 100)
          : 0,
    };

    const result = await generatePredictions(analyticsData as Record<string, unknown>);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Prediction failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
