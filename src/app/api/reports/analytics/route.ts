import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const dateFilter: Record<string, unknown> = {};
  if (from || to) {
    dateFilter.createdAt = {};
    if (from) (dateFilter.createdAt as Record<string, unknown>).gte = new Date(from);
    if (to) (dateFilter.createdAt as Record<string, unknown>).lte = new Date(to + "T23:59:59.999Z");
  }

  const totalBookings = await prisma.booking.count({ where: dateFilter });
  const completedBookings = await prisma.booking.count({ where: { ...dateFilter, status: "DELIVERED" } });
  const cancelledBookings = await prisma.booking.count({ where: { ...dateFilter, status: "CANCELLED" } });
  const totalRevenue = await prisma.payment.aggregate({ where: { ...dateFilter, status: "PAID" }, _sum: { amount: true } });
  const avgRating = await prisma.bookingReview.aggregate({ _avg: { rating: true } });
  const customers = await prisma.customer.count();

  const header = "Metric,Value\n";
  const rows = [
    ["Total Bookings", totalBookings],
    ["Completed", completedBookings],
    ["Cancelled", cancelledBookings],
    ["Revenue", totalRevenue._sum.amount || 0],
    ["Avg Rating", (avgRating._avg.rating || 0).toFixed(2)],
    ["Total Customers", customers],
  ].map((r) => r.join(",")).join("\n");

  return new NextResponse(header + rows, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="analytics-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
