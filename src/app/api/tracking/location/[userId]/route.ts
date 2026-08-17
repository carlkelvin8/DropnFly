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
  const session = await auth();
  let allowed = session?.user ? await canReadRiderLocation(session.user, userId) : false;
  if (!allowed) {
    const reference = new URL(req.url).searchParams.get("reference");
    if (reference) {
      const booking = await prisma.booking.findFirst({
        where: { referenceNumber: reference.trim().toUpperCase(), assignments: { some: { userId } } },
        select: { id: true, customerId: true },
      });
      allowed = Boolean(booking && await canAccessBooking(booking));
    }
  }
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

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

  return NextResponse.json(user);
}
