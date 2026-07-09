import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";
import { notifyBookingStatusChanged } from "@/lib/notifications";

const VALID_STATUS = [
  "PENDING", "CONFIRMED", "RECEIVED", "IN_STORAGE",
  "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED", "NO_SHOW",
] as const;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const booking = await prisma.booking.findUnique({
    where: { id },
    include: {
      customer: true,
      location: true,
      user: { select: { name: true, email: true } },
      assignments: {
        include: { user: { select: { name: true, email: true } } },
      },
      payments: { select: { id: true, amount: true, method: true, status: true, paidAt: true } },
      promoCode: { select: { code: true } },
    },
  });

  if (!booking) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(booking);
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await req.json();

    const data: Record<string, unknown> = {};

    if (body.checkIn) {
      const d = new Date(body.checkIn);
      if (isNaN(d.getTime())) return NextResponse.json({ error: "Invalid check-in date" }, { status: 400 });
      data.checkIn = d;
    }
    if (body.checkOut) {
      const d = new Date(body.checkOut);
      if (isNaN(d.getTime())) return NextResponse.json({ error: "Invalid check-out date" }, { status: 400 });
      data.checkOut = d;
    }
    if (data.checkIn && data.checkOut && new Date(data.checkOut as Date) <= new Date(data.checkIn as Date)) {
      return NextResponse.json({ error: "Check-out must be after check-in" }, { status: 400 });
    }

    if (body.numberOfBags !== undefined) data.numberOfBags = body.numberOfBags;
    if (body.pickupLocation !== undefined) data.pickupLocation = body.pickupLocation;
    if (body.dropOffLocation !== undefined) data.dropOffLocation = body.dropOffLocation;
    if (body.luggageDetails !== undefined) data.luggageDetails = body.luggageDetails;
    if (body.totalPrice !== undefined) data.totalPrice = body.totalPrice;

    if (body.status) {
      if (!VALID_STATUS.includes(body.status)) {
        return NextResponse.json({ error: "Invalid status" }, { status: 400 });
      }
      data.status = body.status;
    }

    const booking = await prisma.booking.update({
      where: { id },
      data: data as any,
    });

    if (body.status) {
      await logActivity({
        userId: session.user.id,
        action: "UPDATE",
        entity: "Booking",
        entityId: id,
        details: `Status changed to ${body.status}`,
      });

      const assignments = await prisma.bookingAssignment.findMany({
        where: { bookingId: id },
        select: { userId: true },
      });

      await notifyBookingStatusChanged(
        assignments.map((a) => a.userId),
        booking.referenceNumber,
        body.status
      );

      if (body.status === "DELIVERED") {
        const pointsEarned = Math.floor(booking.totalPrice / 10);
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
    }

    return NextResponse.json(booking);
  } catch {
    return NextResponse.json(
      { error: "Failed to update booking" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const booking = await prisma.booking.findUnique({ where: { id }, select: { referenceNumber: true } });
    await prisma.booking.delete({ where: { id } });

    await logActivity({
      userId: session.user.id,
      action: "DELETE",
      entity: "Booking",
      entityId: id,
      details: `Deleted booking ${booking?.referenceNumber}`,
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Failed to delete booking" },
      { status: 500 }
    );
  }
}
