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
  const period = searchParams.get("period") || "month";
  const days = period === "week" ? 7 : period === "year" ? 365 : 30;
  const since = searchParams.get("from") ? new Date(`${searchParams.get("from")}T00:00:00`) : new Date(Date.now() - days * 86400000);
  const until = searchParams.get("to") ? new Date(`${searchParams.get("to")}T23:59:59.999`) : new Date();
  const bookingWhere = { createdAt: { gte: since, lte: until } };
  const paymentWhere = { status: "PAID" as const, paidAt: { gte: since, lte: until } };

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
      paymentsByStatus,
      paymentsByMethod,
      repeatCustomers,
    ] = await Promise.all([
      prisma.booking.count({ where: bookingWhere }),
      prisma.booking.aggregate({ where: bookingWhere, _sum: { totalPrice: true } }),
      prisma.booking.groupBy({ by: ["status"], where: bookingWhere, _count: true }),
      prisma.booking.findMany({
        where: bookingWhere,
        select: { createdAt: true, totalPrice: true, checkIn: true, checkOut: true },
        orderBy: { createdAt: "asc" },
      }),
      prisma.user.count({ where: { role: "EMPLOYEE", isActive: true } }),
      prisma.storageLocation.aggregate({ _sum: { capacity: true } }),
      prisma.customer.count({ where: { createdAt: { gte: since, lte: until } } }),
      prisma.payment.aggregate({ where: paymentWhere, _sum: { amount: true } }),
      prisma.luggageItem.count({ where: { booking: bookingWhere } }),
      prisma.payment.groupBy({ by: ["status"], where: { createdAt: { gte: since, lte: until } }, _count: true, _sum: { amount: true } }),
      prisma.payment.groupBy({ by: ["method"], where: paymentWhere, _count: true, _sum: { amount: true } }),
      prisma.booking.groupBy({ by: ["customerId"], where: bookingWhere, having: { customerId: { _count: { gt: 1 } } }, _count: true }),
    ]);

    const totalCapacity = locationCapacity._sum.capacity || 0;
    const activeBookings = await prisma.booking.count({
      where: { ...bookingWhere, status: { notIn: ["DELIVERED", "CANCELLED"] } },
    });

    const paidRevenue = Number(payments._sum.amount || 0);
    const bookedValue = Number(revenueAgg._sum.totalPrice || 0);
    const periodDays = Math.max(1, Math.ceil((until.getTime() - since.getTime()) / 86400000) + 1);
    const dailyTrend = new Map<string, { bookings: number; bookedValue: number }>();
    for (const booking of recentBookings) {
      const date = booking.createdAt.toISOString().slice(0, 10);
      const current = dailyTrend.get(date) || { bookings: 0, bookedValue: 0 };
      current.bookings += 1;
      current.bookedValue += Number(booking.totalPrice);
      dailyTrend.set(date, current);
    }

    const analyticsData = {
      totalBookings,
      bookedValue,
      totalRevenue: paidRevenue,
      outstandingValue: Math.max(0, bookedValue - paidRevenue),
      collectionRate: bookedValue > 0 ? Number(((paidRevenue / bookedValue) * 100).toFixed(1)) : 0,
      bookingsByStatus: bookingsByStatus.map((row) => ({ status: row.status, count: row._count })),
      paymentsByStatus: paymentsByStatus.map((row) => ({ status: row.status, count: row._count, amount: Number(row._sum.amount || 0) })),
      paymentsByMethod: paymentsByMethod.map((row) => ({ method: row.method, count: row._count, amount: Number(row._sum.amount || 0) })),
      dailyTrend: Array.from(dailyTrend, ([date, values]) => ({ date, ...values })),
      averageDailyBookings: totalBookings / periodDays,
      activeEmployees: employeeCount,
      storageCapacity: totalCapacity,
      storageUsed: activeBookings,
      storageUtilization: totalCapacity > 0 ? Math.round((activeBookings / totalCapacity) * 100) : 0,
      totalCustomers: customerCount,
      repeatCustomers: repeatCustomers.length,
      totalLuggageItems: luggageCount,
      avgBookingValue: totalBookings > 0 ? bookedValue / totalBookings : 0,
      avgPaidRevenuePerBooking: totalBookings > 0 ? paidRevenue / totalBookings : 0,
      reportPeriod: { from: since.toISOString(), to: until.toISOString() },
    };

    const result = await generateReport(type as "descriptive" | "predictive" | "financial", analyticsData as Record<string, unknown>);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Report generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
