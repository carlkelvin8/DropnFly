import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const date = req.nextUrl.searchParams.get("date");
    if (!date) {
      return NextResponse.json({ error: "Date parameter required" }, { status: 400 });
    }

    const selected = new Date(date + "T00:00:00");
    const nextDay = new Date(selected);
    nextDay.setDate(nextDay.getDate() + 1);

    const [bookings, activities] = await Promise.all([
      prisma.booking.findMany({
        where: {
          OR: [
            { checkIn: { gte: selected, lt: nextDay } },
            { checkOut: { gte: selected, lt: nextDay } },
            { createdAt: { gte: selected, lt: nextDay } },
          ],
        },
        select: {
          referenceNumber: true,
          status: true,
          checkIn: true,
          checkOut: true,
          createdAt: true,
          numberOfBags: true,
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.activityLog.findMany({
        where: { createdAt: { gte: selected, lt: nextDay } },
        select: { action: true, entity: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
    ]);

    return NextResponse.json({ bookings, activities });
  } catch (e) {
    console.error("Calendar API error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
