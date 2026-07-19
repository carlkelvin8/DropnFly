import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const yearParam = req.nextUrl.searchParams.get("year");
    const monthParam = req.nextUrl.searchParams.get("month");
    if (!yearParam || !monthParam) {
      return NextResponse.json({ error: "year and month parameters required" }, { status: 400 });
    }

    const year = parseInt(yearParam, 10);
    const month = parseInt(monthParam, 10);
    const startOfMonth = new Date(year, month - 1, 1);
    const startOfNextMonth = new Date(year, month, 1);

    const bookings = await prisma.booking.findMany({
      where: {
        OR: [
          { checkIn: { gte: startOfMonth, lt: startOfNextMonth } },
          { checkOut: { gte: startOfMonth, lt: startOfNextMonth } },
        ],
      },
      select: { checkIn: true, checkOut: true },
    });

    const dateMap: Record<string, number> = {};
    for (const b of bookings) {
      if (b.checkIn) {
        const key = b.checkIn.toISOString().split("T")[0];
        dateMap[key] = (dateMap[key] || 0) + 1;
      }
      if (b.checkOut) {
        const key = b.checkOut.toISOString().split("T")[0];
        dateMap[key] = (dateMap[key] || 0) + 1;
      }
    }

    return NextResponse.json({ activeDates: dateMap });
  } catch (e) {
    console.error("Calendar month API error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
