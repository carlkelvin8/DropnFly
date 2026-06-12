import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { generatePredictions } from "@/lib/gemini";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [
      totalBookings,
      totalRevenue,
      bookingsByStatus,
      recentBookings,
      employeeCount,
      locationCapacity,
    ] = await Promise.all([
      prisma.booking.count(),
      prisma.booking.aggregate({ _sum: { totalPrice: true } }),
      prisma.booking.groupBy({
        by: ["status"],
        _count: true,
      }),
      prisma.booking.findMany({
        where: {
          createdAt: { gte: new Date(Date.now() - 30 * 86400000) },
        },
        select: { createdAt: true, totalPrice: true, checkIn: true },
        orderBy: { createdAt: "asc" },
      }),
      prisma.user.count({
        where: { role: "EMPLOYEE", isActive: true },
      }),
      prisma.storageLocation.aggregate({ _sum: { capacity: true } }),
    ]);

    const totalCapacity = locationCapacity._sum.capacity || 0;
    const activeBookings = await prisma.booking.count({
      where: { status: { notIn: ["DELIVERED", "CANCELLED"] } },
    });

    const hourlyDist: Record<number, number> = {};
    for (const b of recentBookings) {
      const h = b.checkIn.getHours();
      hourlyDist[h] = (hourlyDist[h] || 0) + 1;
    }

    const analyticsData = {
      totalBookings,
      totalRevenue: totalRevenue._sum.totalPrice || 0,
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
      storageUsed: activeBookings,
      storageUtilization:
        totalCapacity > 0
          ? Math.round((activeBookings / totalCapacity) * 100)
          : 0,
    };

    const result = await generatePredictions(analyticsData as Record<string, unknown>);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Prediction failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
