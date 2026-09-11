import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { canAccessBooking } from "@/lib/booking-access";
import { canReadRiderLocation } from "@/lib/staff-access";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params;
  const reference = new URL(req.url).searchParams.get("reference");
  const session = await auth();
  // Staff and the rider themselves can always read the location.
  let allowed = session?.user ? await canReadRiderLocation(session.user, userId) : false;
  let bookingId: string | null = null;
  let started = false;
  if (reference) {
    const booking = await prisma.booking.findFirst({
      where: { referenceNumber: reference.trim().toUpperCase(), assignments: { some: { userId } } },
      select: { id: true, customerId: true, pickupStartedAt: true },
    });
    if (!booking) return NextResponse.json({ error: "Booking assignment not found" }, { status: 404 });
    bookingId = booking.id;
    started = Boolean(booking.pickupStartedAt);
    if (!allowed) {
      // Public tracking: only expose the live dot after the employee has
      // started the leg (start-pickup / start-delivery), and only to an
      // authorized viewer (granted booking_access cookie or the customer).
      if (started && (await canAccessBooking(booking))) allowed = true;
    }
  }
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      currentLat: true,
      currentLng: true,
      lastLocationUpdate: true,
    },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (bookingId) {
    const latest = await prisma.locationUpdate.findFirst({
      where: { bookingId, userId },
      orderBy: { createdAt: "desc" },
      select: { latitude: true, longitude: true, createdAt: true },
    });
    // Fallback to user's last known generic location if no booking-scoped ping yet
    // so map still shows last dot + NAIA pin instead of blank.
    if (latest) {
      return NextResponse.json({
        id: user.id,
        name: user.name,
        currentLat: latest.latitude,
        currentLng: latest.longitude,
        lastLocationUpdate: latest.createdAt,
      });
    }
    return NextResponse.json({
      id: user.id,
      name: user.name,
      currentLat: user.currentLat,
      currentLng: user.currentLng,
      lastLocationUpdate: user.lastLocationUpdate,
    });
  }

  return NextResponse.json(user);
}
