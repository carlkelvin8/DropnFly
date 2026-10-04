import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { manilaDateStr, manilaDayStart } from "@/lib/manila-time";

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

    const selected = manilaDayStart(date);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(selected.getTime()) || manilaDateStr(selected) !== date) {
      return NextResponse.json({ error: "Invalid date" }, { status: 400 });
    }
    const nextDay = new Date(selected.getTime() + 24 * 60 * 60 * 1000);

    const bookings = await prisma.booking.findMany({
        where: {
          OR: [
            { checkIn: { gte: selected, lt: nextDay } },
            { checkOut: { gte: selected, lt: nextDay } },
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
      });

    return NextResponse.json({ bookings });
  } catch (e) {
    if (process.env.NODE_ENV === "development") {
      console.error("Calendar API error:", e);
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
