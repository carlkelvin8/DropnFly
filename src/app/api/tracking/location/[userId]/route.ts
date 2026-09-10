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
  let allowed = session?.user ? await canReadRiderLocation(session.user, userId) : false;
  let bookingId: string | null = null;
  if (reference) {
    const booking = await prisma.booking.findFirst({
      where: { referenceNumber: reference.trim().toUpperCase(), assignments: { some: { userId } } },
      select: { id: true, customerId: true },
    });
    if (!booking) return NextResponse.json({ error: "Booking assignment not found" }, { status: 404 });
    bookingId = booking.id;
    if (!allowed) allowed = await canAccessBooking(booking);
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
    return NextResponse.json({
      id: user.id,
      name: user.name,
      currentLat: latest?.latitude ?? null,
      currentLng: latest?.longitude ?? null,
      lastLocationUpdate: latest?.createdAt ?? null,
    });
  }

  return NextResponse.json(user);
}
