import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canReadBooking, hasStaffRole } from "@/lib/staff-access";

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
    const body = await req.json().catch(() => ({}));
    const count = Number(body.count ?? 1);
    if (!Number.isInteger(count) || count < 1 || count > 100) {
      return NextResponse.json({ error: "Count must be an integer from 1 to 100" }, { status: 400 });
    }

    const booking = await prisma.booking.findUnique({
      where: { id },
      select: { referenceNumber: true, numberOfBags: true },
    });
    if (!booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 });

    const existingCount = await prisma.luggageItem.count({ where: { bookingId: id } });
    const maxAllowed = booking.numberOfBags;
    const canCreate = Math.min(count, maxAllowed - existingCount);
    if (canCreate <= 0) {
      return NextResponse.json({ error: "All baggage slots already filled" }, { status: 400 });
    }

    const items = [];
    for (let i = 0; i < canCreate; i++) {
      const tagNumber = `TAG-${booking.referenceNumber}-${existingCount + i + 1}`;
      const item = await prisma.luggageItem.create({
        data: { bookingId: id, tagNumber },
      });
      items.push(item);
    }

    return NextResponse.json(items, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to create luggage items" }, { status: 500 });
  }
}
