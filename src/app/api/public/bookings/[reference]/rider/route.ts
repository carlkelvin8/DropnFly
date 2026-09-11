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
    select: { id: true, customerId: true, status: true, pickupStartedAt: true },
  });

  if (!booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  // Tracking is only revealed after the employee started the leg, and only to
  // authorized viewers (granted booking_access cookie, customer, staff, or the
  // assigned rider). Same rule as /api/public/bookings/[reference]/status.
  if (!booking.pickupStartedAt || !(await canAccessBooking(booking))) {
    return NextResponse.json({ rider: null });
  }

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

  // Surface the ASSIGNED vehicle (e.g. fleet unit) when present, falling back to
  // the rider's personal registered vehicle — so customers and maps see the actual
  // vehicle performing the leg (type + plate drive the map marker "logo").
  return NextResponse.json({
    rider: {
      ...assignment.user,
      vehicleType: assignment.vehicleType || assignment.user.vehicleType,
      plateNumber: assignment.vehiclePlate || assignment.user.plateNumber,
    },
  });
}
