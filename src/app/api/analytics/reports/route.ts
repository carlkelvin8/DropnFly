import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { generateReport } from "@/lib/gemini";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") || "descriptive";

  try {
    const [
      totalBookings,
      revenueAgg,
      bookingsByStatus,
      recentBookings,
      employeeCount,
      locationCapacity,
      customerCount,
      payments,
      luggageCount,
    ] = await Promise.all([
      prisma.booking.count(),
      prisma.booking.aggregate({ _sum: { totalPrice: true } }),
      prisma.booking.groupBy({ by: ["status"], _count: true }),
      prisma.booking.findMany({
        where: { createdAt: { gte: new Date(Date.now() - 90 * 86400000) } },
        select: { createdAt: true, totalPrice: true, checkIn: true, checkOut: true },
        orderBy: { createdAt: "asc" },
      }),
      prisma.user.count({ where: { role: "EMPLOYEE", isActive: true } }),
      prisma.storageLocation.aggregate({ _sum: { capacity: true } }),
      prisma.customer.count(),
      prisma.payment.aggregate({ _sum: { amount: true } }),
      prisma.luggageItem.count(),
    ]);

    const totalCapacity = locationCapacity._sum.capacity || 0;
    const activeBookings = await prisma.booking.count({
      where: { status: { notIn: ["DELIVERED", "CANCELLED"] } },
    });

    const analyticsData = {
      totalBookings,
      totalRevenue: revenueAgg._sum.totalPrice || 0,
      totalPayments: payments._sum.amount || 0,
      bookingsByStatus,
      bookingsLast90Days: recentBookings.length,
      averageDailyBookings: recentBookings.length > 0 ? recentBookings.length / 90 : 0,
      activeEmployees: employeeCount,
      storageCapacity: totalCapacity,
      storageUsed: activeBookings,
      storageUtilization: totalCapacity > 0 ? Math.round((activeBookings / totalCapacity) * 100) : 0,
      totalCustomers: customerCount,
      totalLuggageItems: luggageCount,
      avgBookingValue: totalBookings > 0 ? Math.round((revenueAgg._sum.totalPrice || 0) / totalBookings) : 0,
    };

    const result = await generateReport(type as "descriptive" | "predictive" | "financial", analyticsData as Record<string, unknown>);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Report generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
