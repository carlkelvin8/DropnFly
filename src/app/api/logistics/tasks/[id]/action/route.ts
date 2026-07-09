import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";

// actions: start-pickup, arrive-pickup, complete-pickup, start-delivery, arrive-delivery, complete-delivery
const ACTION_MAP: Record<string, string> = {
  "start-pickup": "CONFIRMED",
  "arrive-pickup": "RECEIVED",
  "complete-pickup": "IN_STORAGE",
  "start-delivery": "OUT_FOR_DELIVERY",
  "arrive-delivery": "OUT_FOR_DELIVERY",
  "complete-delivery": "DELIVERED",
};

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const { action, photo, note, latitude, longitude } = await req.json();

    if (!action || !ACTION_MAP[action]) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    const booking = await prisma.booking.findUnique({
      where: { id },
      select: { id: true, referenceNumber: true, customerId: true, totalPrice: true },
    });

    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    const newStatus = ACTION_MAP[action];

    const [updated] = await Promise.all([
      prisma.booking.update({
        where: { id },
        data: { status: newStatus as any },
      }),
      prisma.scanEvent.create({
        data: {
          bookingId: id,
          userId: session.user.id,
          status: newStatus,
          photo: photo || null,
          note: note || `Task action: ${action}`,
          latitude: latitude || null,
          longitude: longitude || null,
        },
      }),
    ]);

    await logActivity({
      userId: session.user.id,
      action: "TASK",
      entity: "Booking",
      entityId: id,
      details: `${action} — ${booking.referenceNumber}`,
    });

    if (newStatus === "DELIVERED") {
      const pointsEarned = Math.floor(updated.totalPrice / 10);
      if (pointsEarned > 0) {
        await Promise.all([
          prisma.customer.update({
            where: { id: booking.customerId },
            data: { points: { increment: pointsEarned } },
          }),
          prisma.pointsTransaction.create({
            data: {
              customerId: booking.customerId,
              points: pointsEarned,
              type: "EARNED",
              reference: booking.id,
              description: `Earned from booking ${booking.referenceNumber}`,
            },
          }),
        ]);
      }
    }

    return NextResponse.json({ success: true, status: newStatus });
  } catch {
    return NextResponse.json({ error: "Failed to process action" }, { status: 500 });
  }
}
