import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { getSystemSettings, setting } from "@/lib/settings";

function toLocalDayKey(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const period = searchParams.get("period") || "month";
  const days =
    period === "week" ? 7 : period === "month" ? 30 : period === "year" ? 365 : 30;

  const fromDate: string | null = searchParams.get("from");
  const toDate: string | null = searchParams.get("to");

  let since = new Date();
  since.setDate(since.getDate() - days);
  since.setHours(0, 0, 0, 0);

  if (fromDate) {
    since = new Date(fromDate + "T00:00:00");
    since.setHours(0, 0, 0, 0);
  }
  let until: Date | undefined;
  if (toDate) {
    until = new Date(toDate + "T00:00:00");
    until.setHours(23, 59, 59, 999);
  }

  const actualDays = period === "custom" && fromDate
    ? Math.ceil((((until || new Date()).getTime() - since.getTime()) / (1000 * 60 * 60 * 24))) || 1
    : days;

  const periodFilter = { createdAt: { gte: since, ...(until ? { lte: until } : {}) } };

  const [
    periodBookings,
    bookingsByStatus,
    bookingsByDay,
    periodBookingStats,
    paidPayments,
    bookingsByHour,
    repeatCustomers,
    luggageDetails,
    employeeUsers,
    cityCountryRows,
  ] = await Promise.all([
    prisma.booking.count({ where: periodFilter }),
    prisma.booking.groupBy({
      by: ["status"],
      where: periodFilter,
      _count: true,
    }),
    prisma.booking.findMany({
      where: periodFilter,
      select: { createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.booking.aggregate({
      where: periodFilter,
      _avg: { numberOfBags: true },
    }),
    prisma.payment.findMany({
      where: { status: "PAID", paidAt: { gte: since, ...(until ? { lte: until } : {}) } },
      select: {
        amount: true,
        paidAt: true,
        booking: { select: { status: true } },
      },
    }),
    prisma.booking.findMany({
      where: periodFilter,
      select: { checkIn: true },
    }),
    prisma.$queryRaw<Array<{ email: string; booking_count: bigint }>>`
      SELECT c.email, COUNT(b.id) as booking_count
      FROM "Customer" c
      INNER JOIN "Booking" b ON b."customerId" = c.id
      GROUP BY c.email
      HAVING COUNT(b.id) > 1
    `,
    prisma.booking.findMany({
      where: { ...periodFilter, luggageDetails: { not: null }, status: { not: "CANCELLED" as const } },
      select: { luggageDetails: true },
      take: 2000,
    }),
    prisma.user.findMany({
      where: { role: "EMPLOYEE", isActive: true },
      select: { id: true, name: true, email: true },
    }),
    prisma.$queryRaw<Array<{ city: string | null; country: string | null; count: bigint }>>`
      SELECT c."cityOfOrigin" as city, c."countryOfOrigin" as country, COUNT(b.id) as count
      FROM "Booking" b
      INNER JOIN "Customer" c ON c.id = b."customerId"
      WHERE b."createdAt" >= ${since}${until ? Prisma.sql` AND b."createdAt" <= ${until}` : Prisma.empty}
      GROUP BY c."cityOfOrigin", c."countryOfOrigin"
    `,
  ]);

  const employeeStats = employeeUsers.length
    ? await prisma.bookingAssignment.groupBy({
        by: ["userId"],
        where: {
          userId: { in: employeeUsers.map((u) => u.id) },
          createdAt: { gte: since, ...(until ? { lte: until } : {}) },
        },
        _count: true,
        _max: { createdAt: true },
      })
    : [];

  const totalRevenue = paidPayments.reduce((sum, p) => sum + Number(p.amount), 0);

  const settings = await getSystemSettings();
  const totalCapacity = parseInt(setting(settings, "max_simultaneous_bags", "0"));
  const activeBookings = await prisma.booking.count({
    where: { status: { notIn: ["DELIVERED", "CANCELLED"] } },
  });

  const bookingsPerDay: Record<string, number> = {};
  const revenuePerDay: Record<string, number> = {};
  const lastDay = until || new Date();
  for (let cursor = new Date(since); cursor <= lastDay; cursor.setDate(cursor.getDate() + 1)) {
    bookingsPerDay[toLocalDayKey(cursor)] = 0;
    revenuePerDay[toLocalDayKey(cursor)] = 0;
  }
  for (const b of bookingsByDay) {
    const day = toLocalDayKey(b.createdAt);
    bookingsPerDay[day] = (bookingsPerDay[day] || 0) + 1;
  }
  for (const p of paidPayments) {
    if (!p.paidAt) continue;
    const day = toLocalDayKey(p.paidAt);
    revenuePerDay[day] = (revenuePerDay[day] || 0) + Number(p.amount);
  }

  const revenueByStatusMap: Record<string, number> = {};
  for (const p of paidPayments) {
    const status = p.booking.status;
    revenueByStatusMap[status] = (revenueByStatusMap[status] || 0) + Number(p.amount);
  }

  const hourlyDistribution: Record<number, number> = Object.fromEntries(
    Array.from({ length: 24 }, (_, hour) => [hour, 0])
  );
  for (const b of bookingsByHour) {
    const hour = b.checkIn.getHours();
    hourlyDistribution[hour] = (hourlyDistribution[hour] || 0) + 1;
  }

  const employeeNameMap = new Map(employeeUsers.map((u) => [u.id, u]));
  const userPerformance = employeeStats.map((stat) => {
    const user = employeeNameMap.get(stat.userId);
    return {
      userId: stat.userId,
      name: user?.name || "Unknown",
      email: user?.email || "",
      totalAssigned: stat._count,
      lastAssigned: stat._max.createdAt,
    };
  });

  const bagBreakdown: Record<string, number> = {};
  for (const b of luggageDetails) {
    if (!b.luggageDetails) continue;
    try {
      const items = JSON.parse(b.luggageDetails) as { type: string; qty: number }[];
      for (const item of items) {
        bagBreakdown[item.type] = (bagBreakdown[item.type] || 0) + item.qty;
      }
    } catch {}
  }

  const cityDistributionMap: Record<string, number> = {};
  const countryDistributionMap: Record<string, number> = {};
  for (const row of cityCountryRows) {
    const city = row.city || "Unknown";
    const country = row.country || "Unknown";
    cityDistributionMap[city] = (cityDistributionMap[city] || 0) + Number(row.count);
    countryDistributionMap[country] = (countryDistributionMap[country] || 0) + Number(row.count);
  }
  const cityDistribution = Object.entries(cityDistributionMap)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
  const countryDistribution = Object.entries(countryDistributionMap)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  const newCustomers = await prisma.customer.count({
    where: { createdAt: { gte: since, ...(until ? { lte: until } : {}) } },
  });
  const totalCustomers = await prisma.customer.count();

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const startOfMonth = new Date(startOfToday.getFullYear(), startOfToday.getMonth(), 1);

  const [
    walkInsToday,
    ongoingBags,
    bagsStoredToday,
    totalBagsStoredMonthly,
    outstandingAgg,
    refundAgg,
    canceledNoShow,
    satisfactionAgg,
  ] = await Promise.all([
    prisma.booking.count({ where: { createdAt: { gte: startOfToday } } }),
    prisma.booking.aggregate({
      where: { status: { in: ["RECEIVED", "IN_STORAGE"] } },
      _sum: { numberOfBags: true },
    }),
    prisma.booking.aggregate({
      where: { checkIn: { gte: startOfToday } },
      _sum: { numberOfBags: true },
    }),
    prisma.booking.aggregate({
      where: { createdAt: { gte: startOfMonth } },
      _sum: { numberOfBags: true },
    }),
    prisma.payment.aggregate({
      where: { status: "PENDING" },
      _sum: { amount: true },
    }),
    prisma.payment.aggregate({
      where: { status: "REFUNDED" },
      _count: true,
      _sum: { amount: true },
    }),
    prisma.booking.count({
      where: { status: { in: ["CANCELLED", "NO_SHOW"] }, ...periodFilter },
    }),
    prisma.bookingReview.aggregate({
      where: { createdAt: { gte: since, ...(until ? { lte: until } : {}) } },
      _avg: { rating: true },
    }),
  ]);

  const financialMetrics = {
    walkInsToday,
    ongoingBagsInStorage: ongoingBags._sum.numberOfBags || 0,
    bagsStoredToday: bagsStoredToday._sum.numberOfBags || 0,
    totalBagsStoredMonthly: totalBagsStoredMonthly._sum.numberOfBags || 0,
    storageUtilization: totalCapacity > 0 ? (activeBookings / totalCapacity) * 100 : 0,
    outstandingBalance: Number(outstandingAgg._sum.amount || 0),
    refundsIssued: refundAgg._count,
    refundsAmount: Number(refundAgg._sum.amount || 0),
    canceledNoShow,
    customerSatisfaction: satisfactionAgg._avg.rating || 0,
  };

  return NextResponse.json({
    overview: {
      totalBookings: periodBookings,
      activeBookings,
      totalRevenue,
      averagePrice: paidPayments.length > 0 ? totalRevenue / paidPayments.length : 0,
      averageBags: periodBookingStats._avg.numberOfBags || 0,
      totalCustomers,
      newCustomers,
      storageUtilization: totalCapacity > 0 ? (activeBookings / totalCapacity) * 100 : 0,
    },
    bookingsByStatus: bookingsByStatus.map((s) => ({
      status: s.status,
      count: s._count,
    })),
    bookingsByDay: Object.entries(bookingsPerDay).map(([date, count]) => ({
      date,
      count,
      revenue: revenuePerDay[date] || 0,
    })),
    revenueByStatus: Object.entries(revenueByStatusMap).map(([status, revenue]) => ({
      status,
      revenue,
    })),
    hourlyDistribution: Object.entries(hourlyDistribution).map(
      ([hour, count]) => ({
        hour: parseInt(hour),
        count,
      })
    ),
    employeePerformance: userPerformance.sort(
      (a, b) => b.totalAssigned - a.totalAssigned
    ),
    bookingFrequency: {
      daily: actualDays > 0 ? periodBookings / actualDays : 0,
      period,
      ...(fromDate ? { fromDate } : {}),
      ...(toDate ? { toDate } : {}),
    },
    customerTrends: {
      totalCustomers,
      newCustomers,
      repeatCustomers: repeatCustomers.length,
      returnRate: totalCustomers > 0 ? (repeatCustomers.length / totalCustomers) * 100 : 0,
    },
    bagBreakdown: Object.entries(bagBreakdown)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value),
    cityDistribution,
    countryDistribution,
    financialMetrics,
    storageUtilization: totalCapacity > 0 ? (activeBookings / totalCapacity) * 100 : 0,
  });
}
