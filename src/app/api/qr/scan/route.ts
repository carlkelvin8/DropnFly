import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";

const VALID_STATUS_FLOW = [
  "PENDING",
  "CONFIRMED",
  "RECEIVED",
  "IN_STORAGE",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
];

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { referenceNumber, status, photo, note, latitude, longitude } = await req.json();

    if (!referenceNumber || !status) {
      return NextResponse.json({ error: "Reference number and status are required" }, { status: 400 });
    }

    if (!VALID_STATUS_FLOW.includes(status)) {
      return NextResponse.json({ error: `Invalid status. Must be one of: ${VALID_STATUS_FLOW.join(", ")}` }, { status: 400 });
    }

    const booking = await prisma.booking.findUnique({
      where: { referenceNumber },
      select: { id: true, referenceNumber: true, status: true, customerId: true },
    });

    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    const currentIdx = VALID_STATUS_FLOW.indexOf(booking.status);
    const newIdx = VALID_STATUS_FLOW.indexOf(status);
    if (newIdx <= currentIdx && booking.status !== "PENDING") {
      return NextResponse.json({ error: "Cannot move to a previous or same status" }, { status: 400 });
    }

    const [updatedBooking] = await Promise.all([
      prisma.booking.update({
        where: { id: booking.id },
        data: { status: status as any },
      }),
      prisma.scanEvent.create({
        data: {
          bookingId: booking.id,
          userId: session.user.id,
          status,
          photo: photo || null,
          note: note || null,
          latitude: latitude || null,
          longitude: longitude || null,
        },
      }),
    ]);

    await logActivity({
      userId: session.user.id,
      action: "SCAN",
      entity: "Booking",
      entityId: booking.id,
      details: `QR scan: status updated to ${status} for ${booking.referenceNumber}`,
    });

    if (status === "DELIVERED") {
      const pointsEarned = Math.floor(updatedBooking.totalPrice / 10);
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

    return NextResponse.json({
      success: true,
      booking: updatedBooking,
      status,
      message: `Booking ${booking.referenceNumber} updated to ${status}`,
    });
  } catch (error) {
    console.error("QR scan error:", error);
    return NextResponse.json({ error: "Failed to process QR scan" }, { status: 500 });
  }
}
