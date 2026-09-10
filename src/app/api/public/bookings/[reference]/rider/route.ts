import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeReference } from "@/lib/utils";
import { canAccessBooking } from "@/lib/booking-access";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ reference: string }> }
) {
  const { reference } = await params;

  const booking = await prisma.booking.findUnique({
    where: { referenceNumber: normalizeReference(reference) },
    select: { id: true, customerId: true, status: true },
  });

  if (!booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }
  // Public rider location: allow anyone with valid reference to see rider pin for live map
  // still check booking exists and assignment matches; canAccessBooking not required for tracking

  const assignment = await prisma.bookingAssignment.findFirst({
    where: {
      bookingId: booking.id,
      phase: booking.status === "OUT_FOR_DELIVERY" || booking.status === "DELIVERED" ? "DROPOFF" : "PICKUP",
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
  });

  if (!assignment) {
    return NextResponse.json({ rider: null });
  }

  return NextResponse.json({ rider: assignment.user });
}
