import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeReference } from "@/lib/utils";
import { canAccessBooking } from "@/lib/booking-access";
import { decimalsToNumbers } from "@/lib/serialize";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ reference: string }> }
) {
  const { reference } = await params;

  const booking = await prisma.booking.findUnique({
    where: { referenceNumber: normalizeReference(reference) },
    include: { customer: { select: { name: true, email: true } } },
  });

  if (!booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  if (!(await canAccessBooking(booking))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [assignment, scans] = await Promise.all([
    prisma.bookingAssignment.findFirst({
      where: {
        bookingId: booking.id,
        phase:
          booking.status === "OUT_FOR_DELIVERY" || booking.status === "DELIVERED"
            ? "DROPOFF"
            : "PICKUP",
      },
      orderBy: { createdAt: "desc" },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            profilePic: true,
            vehicleType: true,
            plateNumber: true,
            currentLat: true,
            currentLng: true,
            lastLocationUpdate: true,
          },
        },
      },
    }),
    prisma.scanEvent.findMany({
      where: { bookingId: booking.id },
      orderBy: { scannedAt: "asc" },
      include: { user: { select: { name: true } } },
    }),
  ]);

  return NextResponse.json({
    booking: decimalsToNumbers(booking),
    rider: assignment?.user ?? null,
    scans,
  });
}