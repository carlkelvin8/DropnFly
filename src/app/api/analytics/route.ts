import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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
    since = new Date(fromDate);
    since.setHours(0, 0, 0, 0);
  }
  let until: Date | undefined;
  if (toDate) {
    until = new Date(toDate);
    until.setHours(23, 59, 59, 999);
  }

  const actualDays = period === "custom" && fromDate
    ? Math.ceil(((until || new Date()).getTime() - since.getTime()) / (1000 * 60 * 60 * 24)) || 1
    : days;

  const [
    totalBookings,
    bookingsByStatus,
    bookingsByDay,
    revenueAgg,
    revenueByDay,
    employeeStats,
    storageLocations,
    bookingsByHour,
    repeatCustomers,
  ] = await Promise.all([
    prisma.booking.count(),
    prisma.booking.groupBy({
      by: ["status"],
      _count: true,
    }),
    prisma.booking.findMany({
      where: { createdAt: { gte: since, ...(until ? { lte: until } : {}) } },
      select: { createdAt: true, totalPrice: true, status: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.booking.aggregate({
      _sum: { totalPrice: true },
      _avg: { totalPrice: true, numberOfBags: true },
    }),
    prisma.booking.groupBy({
      by: ["status"],
      where: { createdAt: { gte: since, ...(until ? { lte: until } : {}) } },
      _sum: { totalPrice: true },
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
      where: { createdAt: { gte: since, ...(until ? { lte: until } : {}) } },
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
    const day = b.createdAt.toISOString().slice(0, 10);
    bookingsPerDay[day] = (bookingsPerDay[day] || 0) + 1;
    revenuePerDay[day] = (revenuePerDay[day] || 0) + b.totalPrice;
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
      totalBookings,
      activeBookings,
      totalRevenue: revenueAgg._sum.totalPrice || 0,
      averagePrice: revenueAgg._avg.totalPrice || 0,
      averageBags: revenueAgg._avg.numberOfBags || 0,
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
    revenueByStatus: revenueByDay.map((r) => ({
      status: r.status,
      revenue: r._sum.totalPrice || 0,
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
      daily: bookingsByDay.length > 0 ? bookingsByDay.length / actualDays : 0,
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
