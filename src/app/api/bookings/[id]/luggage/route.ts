import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canReadBooking, hasStaffRole } from "@/lib/staff-access";
import { isBookingLocked } from "@/lib/booking-access";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!(await canReadBooking(session.user, id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const items = await prisma.luggageItem.findMany({
    where: { bookingId: id },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(items);
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasStaffRole(session.user, ["ADMIN", "STAFF"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { id } = await params;
    await req.json().catch(() => ({}));

    const booking = await prisma.booking.findUnique({
      where: { id },
      select: { status: true },
    });
    if (!booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    if (isBookingLocked(booking.status)) return NextResponse.json({ error: "This booking is locked" }, { status: 409 });

    return NextResponse.json(
      { error: "Choose an available physical tag from the Baggage Tags section" },
      { status: 400 }
    );
  } catch {
    return NextResponse.json({ error: "Failed to create luggage items" }, { status: 500 });
  }
}
