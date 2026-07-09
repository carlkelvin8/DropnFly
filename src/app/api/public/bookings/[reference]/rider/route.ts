import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ reference: string }> }
) {
  const { reference } = await params;

  const booking = await prisma.booking.findUnique({
    where: { referenceNumber: reference },
    select: { id: true },
  });

  if (!booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

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
