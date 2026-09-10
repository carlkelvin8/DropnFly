import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canReadRiderLocation } from "@/lib/staff-access";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { userId } = await params;
  if (!(await canReadRiderLocation(session.user, userId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const bookingId = searchParams.get("bookingId");
  const rawLimit = parseInt(searchParams.get("limit") || "500", 10);
  const limit = isNaN(rawLimit) ? 500 : Math.min(Math.max(rawLimit, 1), 2000);

  const where: Record<string, unknown> = { userId };
  if (bookingId) where.bookingId = bookingId;

  if (from || to) {
    const createdAt: Record<string, Date> = {};
    if (from) {
      const d = new Date(from);
      if (!isNaN(d.getTime())) createdAt.gte = d;
    }
    if (to) {
      const d = new Date(to);
      if (!isNaN(d.getTime())) {
        // use Manila end-of-day: set to 23:59:59 PH = 15:59:59 UTC
        // simpler: add 1 day then -1ms after parsing as date-only
        const toDate = new Date(d);
        toDate.setHours(23, 59, 59, 999);
        createdAt.lte = toDate;
      }
    }
    if (Object.keys(createdAt).length > 0) where.createdAt = createdAt;
  }

  const updates = await prisma.locationUpdate.findMany({
    where,
    orderBy: { createdAt: "asc" },
    take: limit,
  });

  return NextResponse.json(updates);
}
