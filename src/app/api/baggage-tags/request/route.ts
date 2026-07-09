import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { bookingId, count } = await req.json();
    if (!bookingId || !count || count < 1) {
      return NextResponse.json({ error: "Booking ID and count are required" }, { status: 400 });
    }

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: { referenceNumber: true, numberOfBags: true },
    });
    if (!booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 });

    const existingCount = await prisma.luggageItem.count({ where: { bookingId } });
    const maxAllowed = booking.numberOfBags;
    const canCreate = Math.min(count, maxAllowed - existingCount);
    if (canCreate <= 0) {
      return NextResponse.json({ error: "All baggage slots already filled" }, { status: 400 });
    }

    const items = [];
    for (let i = 0; i < canCreate; i++) {
      const tagNumber = `TAG-${booking.referenceNumber}-${existingCount + i + 1}`;
      const item = await prisma.luggageItem.create({
        data: { bookingId, tagNumber, status: "TAG_REQUESTED" },
      });
      items.push(item);
    }

    await logActivity({
      userId: session.user.id,
      action: "CREATE",
      entity: "LuggageItem",
      entityId: items[0]?.id ?? "",
      details: `Requested ${canCreate} baggage tag(s) for booking ${booking.referenceNumber}`,
    });

    return NextResponse.json(items, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to request baggage tags" }, { status: 500 });
  }
}
