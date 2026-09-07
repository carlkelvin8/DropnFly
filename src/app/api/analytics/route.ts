import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { getSystemSettings, setting } from "@/lib/settings";
import { manilaDateStr, manilaDayStart } from "@/lib/manila-time";

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

  let since = new Date(manilaDayStart(manilaDateStr(new Date())).getTime() - (days - 1) * 86400000);

  if (fromDate) {
    since = manilaDayStart(fromDate);
  }
  let until: Date | undefined;
  if (toDate) {
    until = new Date(toDate + "T23:59:59.999+08:00");
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
    periodCustomerBookings,
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
        bookingId: true,
        booking: { select: { status: true } },
      },
    }),
    prisma.booking.findMany({
      where: { ...periodFilter, status: { notIn: ["CANCELLED", "NO_SHOW"] } },
      select: { checkIn: true },
    }),
    prisma.booking.groupBy({
      by: ["customerId"],
      where: { ...periodFilter, status: { notIn: ["CANCELLED", "NO_SHOW"] } },
      _count: true,
    }),
    prisma.booking.findMany({
      where: { ...periodFilter, luggageDetails: { not: null }, status: { notIn: ["CANCELLED", "NO_SHOW"] } },
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
        AND b.status NOT IN ('CANCELLED', 'NO_SHOW')
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
  const paidBookingCount = new Set(paidPayments.map((payment) => payment.bookingId)).size;

  const settings = await getSystemSettings();
  const totalCapacity = parseInt(setting(settings, "max_simultaneous_bags", "0"));
  // Authoritative active storage: bags physically in storage (RECEIVED/IN_STORAGE/OUT_FOR_DELIVERY are in-system but not yet delivered)
  // For utilization, use ongoing bags count so capacity (bags) matches unit.
  const activeBookingsCount = await prisma.booking.count({
    where: { status: { in: ["RECEIVED", "IN_STORAGE", "OUT_FOR_DELIVERY"] } },
  });

  // Use Manila date keys so containers match the “Asia/Manila” calendar admins see (avoids UTC off-by-one)
  const bookingsPerDay: Record<string, number> = {};
  const revenuePerDay: Record<string, number> = {};
  const lastDay = until || new Date();
  for (let cursor = new Date(since); cursor <= lastDay; cursor.setDate(cursor.getDate() + 1)) {
    bookingsPerDay[manilaDateStr(cursor)] = 0;
    revenuePerDay[manilaDateStr(cursor)] = 0;
  }
  for (const b of bookingsByDay) {
    const day = manilaDateStr(b.createdAt);
    bookingsPerDay[day] = (bookingsPerDay[day] || 0) + 1;
  }
  for (const p of paidPayments) {
    if (!p.paidAt) continue;
    const day = manilaDateStr(p.paidAt);
    revenuePerDay[day] = (revenuePerDay[day] || 0) + Number(p.amount);
  }

  const revenueByStatusMap: Record<string, number> = {};
  for (const p of paidPayments) {
    const status = p.booking.status;
    revenueByStatusMap[status] = (revenueByStatusMap[status] || 0) + Number(p.amount);
  }

  // Peak hours in Manila time (consistent with time-slot system)
  const hourlyDistribution: Record<number, number> = Object.fromEntries(
    Array.from({ length: 24 }, (_, hour) => [hour, 0])
  );
  for (const b of bookingsByHour) {
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", hour: "2-digit", hourCycle: "h23" }).formatToParts(b.checkIn);
    const hour = Number(parts.find((p) => p.type === "hour")?.value || "0");
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
    where: {
      id: { in: periodCustomerBookings.map((customer) => customer.customerId) },
      createdAt: { gte: since, ...(until ? { lte: until } : {}) },
    },
  });
  const totalCustomers = periodCustomerBookings.length;
  const repeatCustomers = periodCustomerBookings.filter((customer) => customer._count > 1).length;

  const manilaTodayStr = manilaDateStr(new Date());
  const startOfToday = manilaDayStart(manilaTodayStr);
  const startOfTomorrow = new Date(startOfToday.getTime() + 86400000);
  const manilaMonthStr = manilaTodayStr.slice(0, 7) + "-01";
  const startOfMonth = manilaDayStart(manilaMonthStr);

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
    prisma.booking.count({ where: { createdAt: { gte: startOfToday, lt: startOfTomorrow } } }),
    prisma.booking.aggregate({
      where: { status: { in: ["RECEIVED", "IN_STORAGE", "OUT_FOR_DELIVERY"] } },
      _sum: { numberOfBags: true },
    }),
    prisma.booking.aggregate({
      where: {
        status: { notIn: ["CANCELLED", "NO_SHOW"] },
        scanEvents: { some: { status: { in: ["RECEIVED", "IN_STORAGE"] }, scannedAt: { gte: startOfToday, lt: startOfTomorrow } } },
      },
      _sum: { numberOfBags: true },
    }),
    prisma.booking.aggregate({
      where: {
        status: { notIn: ["CANCELLED", "NO_SHOW"] },
        scanEvents: { some: { status: { in: ["RECEIVED", "IN_STORAGE"] }, scannedAt: { gte: startOfMonth, lt: startOfTomorrow } } },
      },
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

  const ongoingBagsCount = ongoingBags._sum.numberOfBags || 0;
  const storageUtilization = totalCapacity > 0 ? (ongoingBagsCount / totalCapacity) * 100 : 0;

  const financialMetrics = {
    walkInsToday,
    ongoingBagsInStorage: ongoingBagsCount,
    bagsStoredToday: bagsStoredToday._sum.numberOfBags || 0,
    totalBagsStoredMonthly: totalBagsStoredMonthly._sum.numberOfBags || 0,
    storageUtilization,
    outstandingBalance: Number(outstandingAgg._sum.amount || 0),
    refundsIssued: refundAgg._count,
    refundsAmount: Number(refundAgg._sum.amount || 0),
    canceledNoShow,
    customerSatisfaction: satisfactionAgg._avg.rating || 0,
  };

  return NextResponse.json({
    overview: {
      totalBookings: periodBookings,
      activeBookings: activeBookingsCount,
      totalRevenue,
      averagePrice: paidBookingCount > 0 ? totalRevenue / paidBookingCount : 0,
      averageBags: periodBookingStats._avg.numberOfBags || 0,
      totalCustomers,
      newCustomers,
      storageUtilization,
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
      repeatCustomers,
      returnRate: totalCustomers > 0 ? (repeatCustomers / totalCustomers) * 100 : 0,
    },
    bagBreakdown: Object.entries(bagBreakdown)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value),
    cityDistribution,
    countryDistribution,
    financialMetrics,
    storageUtilization,
  });
}
