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
    select: { id: true, customerId: true },
  });

  if (!booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }
  if (!(await canAccessBooking(booking))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const assignment = await prisma.bookingAssignment.findFirst({
    where: { bookingId: booking.id },
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
