import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";
import { notifyBookingStatusChanged } from "@/lib/notifications";
import type { BookingStatus } from "@/generated/prisma/client";
import { canReadBooking, hasStaffRole } from "@/lib/staff-access";
import { awardDeliveryPoints } from "@/lib/loyalty";
import { decimalsToNumbers } from "@/lib/serialize";
import { isBookingLocked } from "@/lib/booking-access";
import { getSystemSettings, setting } from "@/lib/settings";

const VALID_STATUS = [
  "PENDING", "CONFIRMED", "RECEIVED", "IN_STORAGE",
  "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED", "NO_SHOW",
] as const;
const NEXT_STATUS: Partial<Record<BookingStatus, BookingStatus>> = {
  PENDING: "CONFIRMED",
  CONFIRMED: "RECEIVED",
  RECEIVED: "IN_STORAGE",
  IN_STORAGE: "OUT_FOR_DELIVERY",
  OUT_FOR_DELIVERY: "DELIVERED",
};

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (!(await canReadBooking(session.user, id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const booking = await prisma.booking.findUnique({
    where: { id },
    include: {
      customer: {
        select: {
          id: true, name: true, email: true, phone: true,
          countryOfOrigin: true, cityOfOrigin: true, points: true,
        },
      },
      location: true,
      user: { select: { name: true, email: true } },
      assignments: {
        include: { user: { select: { id: true, name: true, email: true } } },
      },
      payments: { select: { id: true, amount: true, method: true, status: true, paidAt: true } },
      promoCode: { select: { code: true } },
    },
  });

  if (!booking) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(decimalsToNumbers(booking));
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!hasStaffRole(session.user, ["ADMIN", "STAFF"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { id } = await params;
    const body = await req.json();
    const existingBooking = await prisma.booking.findUnique({ where: { id }, select: { status: true, checkIn: true, checkOut: true, numberOfBags: true, totalPrice: true } });
    if (!existingBooking) return NextResponse.json({ error: "Booking not found" }, { status: 404 });

    if (isBookingLocked(existingBooking.status)) {
      return NextResponse.json({ error: "Cancelled and no-show bookings are locked and cannot be changed" }, { status: 409 });
    }

    if (body.status && ["NO_SHOW", "CANCELLED"].includes(body.status) && session.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Only admins can directly mark a booking as no-show or cancelled. Staff can file a report for admin review." },
        { status: 403 }
      );
    }

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
    const resultingCheckIn = (data.checkIn as Date | undefined) || existingBooking.checkIn;
    const resultingCheckOut = (data.checkOut as Date | undefined) || existingBooking.checkOut;
    if (resultingCheckOut && resultingCheckOut <= resultingCheckIn) {
      return NextResponse.json({ error: "Check-out must be after check-in" }, { status: 400 });
    }

    if (body.numberOfBags !== undefined) {
      if (!Number.isInteger(body.numberOfBags) || body.numberOfBags <= 0) return NextResponse.json({ error: "Invalid bag count" }, { status: 400 });
      data.numberOfBags = body.numberOfBags;
      if (body.totalPrice === undefined) {
        const settings = await getSystemSettings();
        const bagFee = Number(setting(settings, "excess_bag_fee", "100"));
        data.totalPrice = Math.max(0, Number(existingBooking.totalPrice) + (body.numberOfBags - existingBooking.numberOfBags) * bagFee);
      }
    }
    for (const field of ["pickupLocation", "dropOffLocation"] as const) {
      if (body[field] !== undefined) {
        if (typeof body[field] !== "string" || !body[field].trim() || body[field].length > 500) return NextResponse.json({ error: `Invalid ${field}` }, { status: 400 });
        data[field] = body[field].trim();
      }
    }
    if (body.luggageDetails !== undefined) {
      if (typeof body.luggageDetails !== "string" || body.luggageDetails.length > 20_000) return NextResponse.json({ error: "Invalid luggage details" }, { status: 400 });
      data.luggageDetails = body.luggageDetails;
    }
    if (body.totalPrice !== undefined) {
      if (!Number.isFinite(body.totalPrice) || body.totalPrice < 0) return NextResponse.json({ error: "Invalid total price" }, { status: 400 });
      data.totalPrice = body.totalPrice;
    }

    if (body.status) {
      if (!VALID_STATUS.includes(body.status)) {
        return NextResponse.json({ error: "Invalid status" }, { status: 400 });
      }
      const isAdminOverride = session.user.role === "ADMIN" && ["CANCELLED", "NO_SHOW"].includes(body.status);
      if (!isAdminOverride && body.status !== existingBooking.status && NEXT_STATUS[existingBooking.status] !== body.status) {
        return NextResponse.json({ error: `Invalid status transition from ${existingBooking.status} to ${body.status}` }, { status: 409 });
      }
      data.status = body.status;
    }

    const booking = await prisma.booking.update({
      where: { id },
      data: data as { status?: BookingStatus; [key: string]: unknown },
    });

    if (!body.status) {
      await logActivity({
        userId: session.user.id,
        action: "UPDATE",
        entity: "Booking",
        entityId: id,
        details: typeof body.changeNote === "string" && body.changeNote.trim()
          ? body.changeNote.trim().slice(0, 1000)
          : "Booking details updated",
      });
    }

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

      if (body.photo) {
        await prisma.scanEvent.create({
          data: {
            bookingId: id,
            userId: session.user.id,
            status: body.status,
            photo: body.photo,
            note:
              body.status === "NO_SHOW"
                ? "Admin on-site verification — passenger did not arrive (no-show)"
                : body.status === "CANCELLED"
                ? "Admin on-site verification — booking cancelled"
                : null,
            latitude: body.latitude ?? null,
            longitude: body.longitude ?? null,
          },
        });
      }

      if (body.status === "DELIVERED") await awardDeliveryPoints(booking);
    }

    return NextResponse.json(decimalsToNumbers(booking));
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
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { id } = await params;
    const booking = await prisma.booking.findUnique({ where: { id }, select: { referenceNumber: true } });

    await prisma.$transaction([
      prisma.payment.deleteMany({ where: { bookingId: id } }),
      prisma.bookingAssignment.deleteMany({ where: { bookingId: id } }),
      prisma.scanEvent.deleteMany({ where: { bookingId: id } }),
      prisma.chatMessage.deleteMany({ where: { bookingId: id } }),
      prisma.bookingReview.deleteMany({ where: { bookingId: id } }),
      prisma.bookingExtension.deleteMany({ where: { bookingId: id } }),
      prisma.incidentTimeline.deleteMany({ where: { incident: { bookingId: id } } }),
      prisma.incidentReport.deleteMany({ where: { bookingId: id } }),
      prisma.baggageTag.updateMany({ where: { bookingId: id }, data: { bookingId: null, luggageItemId: null, status: "AVAILABLE", assignedAt: null } }),
      prisma.luggageItem.deleteMany({ where: { bookingId: id } }),
      prisma.booking.delete({ where: { id } }),
    ]);

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
