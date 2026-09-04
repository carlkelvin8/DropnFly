import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canAccessBooking } from "@/lib/booking-access";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const booking = await prisma.booking.findUnique({ where: { id }, select: { id: true, customerId: true, status: true } });
  if (!booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  if (!(await canAccessBooking(booking))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const assignments = await prisma.bookingAssignment.findMany({
    where: { bookingId: id },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          currentLat: true,
          currentLng: true,
          lastLocationUpdate: true,
          profilePic: true,
          vehicleType: true,
          plateNumber: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const activePhase = booking.status === "OUT_FOR_DELIVERY" || booking.status === "DELIVERED" ? "DROPOFF" : "PICKUP";
  assignments.sort((a, b) => Number(b.phase === activePhase) - Number(a.phase === activePhase));

  return NextResponse.json(assignments);
}
