import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";
import { notifyBookingStatusChanged } from "@/lib/notifications";
import { bookingSchema } from "@/lib/validations";

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

    const parsed = bookingSchema.partial().safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    const { checkIn: checkInStr, checkOut: checkOutStr, numberOfBags, status } = parsed.data;

    if (checkInStr && isNaN(new Date(checkInStr).getTime())) {
      return NextResponse.json({ error: "Invalid check-in date" }, { status: 400 });
    }
    if (checkOutStr && isNaN(new Date(checkOutStr).getTime())) {
      return NextResponse.json({ error: "Invalid check-out date" }, { status: 400 });
    }
    if (checkInStr && checkOutStr && new Date(checkOutStr) <= new Date(checkInStr)) {
      return NextResponse.json({ error: "Check-out must be after check-in" }, { status: 400 });
    }

    const booking = await prisma.booking.update({
      where: { id },
      data: {
        ...(checkInStr ? { checkIn: new Date(checkInStr) } : {}),
        ...(checkOutStr ? { checkOut: new Date(checkOutStr) } : {}),
        ...(numberOfBags ? { numberOfBags } : {}),
        ...(status ? { status: status as "PENDING" | "CONFIRMED" | "RECEIVED" | "IN_STORAGE" | "OUT_FOR_DELIVERY" | "DELIVERED" | "CANCELLED" } : {}),
      },
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
