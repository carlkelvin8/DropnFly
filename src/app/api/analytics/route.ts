import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function toLocalDayKey(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
    employeeStats,
    storageLocations,
    bookingsByHour,
    repeatCustomers,
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
    prisma.bookingAssignment.groupBy({
      by: ["userId"],
      _count: true,
      _max: { createdAt: true },
    }),
    prisma.storageLocation.findMany({
      select: { id: true, name: true, capacity: true },
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
  ]);

  const totalRevenue = paidPayments.reduce((sum, p) => sum + p.amount, 0);

  const totalCapacity = storageLocations.reduce(
    (acc, loc) => acc + loc.capacity,
    0
  );
  const activeBookings = await prisma.booking.count({
    where: { status: { notIn: ["DELIVERED", "CANCELLED"] } },
  });

  const bookingsPerLocation = await prisma.booking.groupBy({
    by: ["locationId"],
    where: { status: { notIn: ["DELIVERED", "CANCELLED"] } },
    _count: true,
  });
  const usageMap = new Map(
    bookingsPerLocation.map((b) => [b.locationId, b._count])
  );

  const bookingsPerDay: Record<string, number> = {};
  const revenuePerDay: Record<string, number> = {};
  for (const b of bookingsByDay) {
    const day = toLocalDayKey(b.createdAt);
    bookingsPerDay[day] = (bookingsPerDay[day] || 0) + 1;
  }
  for (const p of paidPayments) {
    if (!p.paidAt) continue;
    const day = toLocalDayKey(p.paidAt);
    revenuePerDay[day] = (revenuePerDay[day] || 0) + p.amount;
  }

  const revenueByStatusMap: Record<string, number> = {};
  for (const p of paidPayments) {
    const status = p.booking.status;
    revenueByStatusMap[status] = (revenueByStatusMap[status] || 0) + p.amount;
  }

  const hourlyDistribution: Record<number, number> = {};
  for (const b of bookingsByHour) {
    const hour = b.checkIn.getHours();
    hourlyDistribution[hour] = (hourlyDistribution[hour] || 0) + 1;
  }

  const userPerformance = await Promise.all(
    employeeStats.map(async (stat) => {
      const user = await prisma.user.findUnique({
        where: { id: stat.userId },
        select: { name: true, email: true },
      });
      return {
        userId: stat.userId,
        name: user?.name || "Unknown",
        email: user?.email || "",
        totalAssigned: stat._count,
        lastAssigned: stat._max.createdAt,
      };
    })
  );

  const newCustomers = await prisma.customer.count({
    where: { createdAt: { gte: since, ...(until ? { lte: until } : {}) } },
  });
  const totalCustomers = await prisma.customer.count();

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
    storageLocations: storageLocations.map((loc) => {
      const used = usageMap.get(loc.id) || 0;
      return {
        name: loc.name,
        capacity: loc.capacity,
        used,
        utilization: loc.capacity > 0 ? (used / loc.capacity) * 100 : 0,
      };
    }),
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
  });
}
