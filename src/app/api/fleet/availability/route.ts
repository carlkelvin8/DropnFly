import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ACTIVE_STATUSES = ["CONFIRMED", "RECEIVED", "IN_STORAGE", "OUT_FOR_DELIVERY"] as const;

type ActiveStatus = (typeof ACTIVE_STATUSES)[number];

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!["ADMIN", "STAFF"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const bookingId = new URL(req.url).searchParams.get("bookingId");
  if (!bookingId) {
    return NextResponse.json({ error: "bookingId is required" }, { status: 400 });
  }

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: { id: true, checkIn: true, checkOut: true },
  });
  if (!booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  // Same overlap window used by the assign endpoint: any other active booking
  // whose pickup/drop-off timeline intersects this booking's own window.
  const windowStart = booking.checkIn;
  const windowEnd = booking.checkOut ?? windowStart;

  const assignments = await prisma.bookingAssignment.findMany({
    where: {
      vehiclePlate: { not: null },
      bookingId: { not: bookingId },
      booking: { status: { in: [...ACTIVE_STATUSES] } },
    },
    select: {
      vehiclePlate: true,
      phase: true,
      booking: {
        select: {
          id: true,
          referenceNumber: true,
          checkIn: true,
          checkOut: true,
          status: true,
          customer: { select: { name: true } },
        },
      },
    },
    orderBy: { booking: { checkIn: "asc" } },
  });

  const conflicts: Record<
    string,
    {
      bookingId: string;
      referenceNumber: string;
      checkIn: string;
      checkOut: string | null;
      phase: "PICKUP" | "DROPOFF";
      status: string;
      customerName: string;
    }[]
  > = {};

  for (const assignment of assignments) {
    const plate = assignment.vehiclePlate as string;
    const other = assignment.booking;
    const overlaps =
      other.checkIn < windowEnd &&
      (other.checkOut === null || other.checkOut > windowStart);
    if (!overlaps) continue;
    (conflicts[plate] ||= []).push({
      bookingId: other.id,
      referenceNumber: other.referenceNumber,
      checkIn: other.checkIn.toISOString(),
      checkOut: other.checkOut ? other.checkOut.toISOString() : null,
      phase: assignment.phase === "DROPOFF" ? "DROPOFF" : "PICKUP",
      status: other.status,
      customerName: other.customer.name,
    });
  }

  return NextResponse.json({
    bookingId,
    conflicts,
  }, { headers: { "Cache-Control": "no-store, max-age=0" } });
}