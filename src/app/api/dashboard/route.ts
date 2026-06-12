import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [
    totalLocations,
    totalBookings,
    activeBookings,
    totalCustomers,
    totalEmployees,
    pendingApprovals,
    revenueResult,
    recentBookings,
    recentActivities,
    capacityResult,
  ] = await Promise.all([
    prisma.storageLocation.count({ where: { isActive: true } }),
    prisma.booking.count(),
    prisma.booking.count({
      where: { status: { in: ["PENDING", "CONFIRMED", "RECEIVED", "IN_STORAGE", "OUT_FOR_DELIVERY"] } },
    }),
    prisma.customer.count(),
    prisma.user.count(),
    prisma.user.count({ where: { isApproved: false } }),
    prisma.booking.aggregate({
      _sum: { totalPrice: true },
      where: { status: { not: "CANCELLED" } },
    }),
    prisma.booking.findMany({
      take: 10,
      orderBy: { createdAt: "desc" },
      include: {
        customer: { select: { name: true } },
      },
    }),
    prisma.activityLog.findMany({
      take: 10,
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { name: true } },
      },
    }),
    prisma.storageLocation.aggregate({
      _sum: { capacity: true },
      where: { isActive: true },
    }),
  ]);

  const bookingCapacity = await prisma.booking.count({
    where: { status: { in: ["RECEIVED", "IN_STORAGE"] } },
  });

  return NextResponse.json({
    stats: {
      totalLocations,
      totalBookings,
      activeBookings,
      totalCustomers,
      totalEmployees,
      pendingApprovals,
      totalRevenue: revenueResult._sum.totalPrice ?? 0,
    },
    recentBookings,
    recentActivities,
    capacityUsage: {
      used: bookingCapacity,
      total: capacityResult._sum.capacity ?? 0,
    },
  });
}
