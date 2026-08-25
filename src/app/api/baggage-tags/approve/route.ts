import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";
import { isBookingLocked } from "@/lib/booking-access";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  try {
    const { itemIds, action } = await req.json();
    if (!itemIds?.length || !["APPROVED", "REJECTED"].includes(action)) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const status = action === "APPROVED" ? "CHECKED_IN" : "CANCELLED";
    const bookingIds = new Set<string>();

    const items = await prisma.luggageItem.findMany({
      where: { id: { in: itemIds } },
      select: { id: true, booking: { select: { status: true } } },
    });
    if (items.length !== itemIds.length) return NextResponse.json({ error: "One or more luggage items were not found" }, { status: 404 });
    if (items.some((item) => isBookingLocked(item.booking.status))) {
      return NextResponse.json({ error: "Cancelled and no-show bookings are locked" }, { status: 409 });
    }

    for (const id of itemIds) {
      const item = await prisma.luggageItem.update({
        where: { id },
        data: { status },
        select: { bookingId: true, tagNumber: true },
      });
      bookingIds.add(item.bookingId);

      await logActivity({
        userId: session.user.id,
        action: action === "APPROVED" ? "APPROVE" : "REJECT",
        entity: "LuggageItem",
        entityId: id,
        details: `${action} baggage tag ${item.tagNumber} for booking ${item.bookingId}`,
      });
    }

    return NextResponse.json({ count: itemIds.length, action });
  } catch {
    return NextResponse.json({ error: "Failed to process request" }, { status: 500 });
  }
}
