import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";
import { isBookingLocked } from "@/lib/booking-access";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!["ADMIN", "STAFF"].includes(session.user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const { bookingId, tagNumbers } = await req.json();
    const requestedTags = Array.isArray(tagNumbers)
      ? Array.from(new Set(tagNumbers.map((tag) => String(tag).trim().toUpperCase()).filter(Boolean)))
      : [];
    if (!bookingId || requestedTags.length < 1 || requestedTags.length > 100) {
      return NextResponse.json({ error: "Select at least one available baggage tag" }, { status: 400 });
    }

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: { referenceNumber: true, numberOfBags: true, status: true },
    });
    if (!booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    if (isBookingLocked(booking.status)) return NextResponse.json({ error: "This booking is locked" }, { status: 409 });

    const items = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`tags:${bookingId}`}))`;
      const existingCount = await tx.luggageItem.count({ where: { bookingId } });
      if (existingCount + requestedTags.length > booking.numberOfBags) {
        throw new Error(`Only ${Math.max(0, booking.numberOfBags - existingCount)} baggage slot(s) remain`);
      }
      const available = await tx.baggageTag.findMany({
        where: { tagNumber: { in: requestedTags }, status: "AVAILABLE", bookingId: null, luggageItemId: null },
        select: { id: true, tagNumber: true },
      });
      if (available.length !== requestedTags.length) throw new Error("One or more selected tags are no longer available");
      const created = [];
      for (const physicalTag of available) {
        const item = await tx.luggageItem.create({ data: { bookingId, tagNumber: physicalTag.tagNumber, status: "TAG_REQUESTED" } });
        await tx.baggageTag.update({
          where: { id: physicalTag.id },
          data: { status: "ASSIGNED", bookingId, luggageItemId: item.id, assignedAt: new Date() },
        });
        created.push(item);
      }
      return created;
    });

    await logActivity({
      userId: session.user.id,
      action: "CREATE",
      entity: "LuggageItem",
      entityId: items[0]?.id ?? "",
      details: `Assigned tags ${requestedTags.join(", ")} to booking ${booking.referenceNumber}`,
    });

    return NextResponse.json(items, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to assign baggage tags" }, { status: 400 });
  }
}
