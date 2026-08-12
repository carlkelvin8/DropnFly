import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";
import { notifyPickupStarted, sendCustomerNotification } from "@/lib/notifications";

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
    const { action } = await req.json();

    if (!["start", "cancel"].includes(action)) {
      return NextResponse.json({ error: "Action must be 'start' or 'cancel'" }, { status: 400 });
    }

    const booking = await prisma.booking.findUnique({
      where: { id },
      select: {
        id: true,
        referenceNumber: true,
        status: true,
        pickupStartedAt: true,
        customerId: true,
        customer: { select: { name: true } },
        assignments: {
          orderBy: { createdAt: "desc" },
          select: { phase: true, user: { select: { id: true, name: true } } },
        },
      },
    });

    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    if (action === "start") {
      if (booking.pickupStartedAt) {
        return NextResponse.json({ error: "Pickup has already been started" }, { status: 400 });
      }
      if (["CANCELLED", "NO_SHOW", "DELIVERED"].includes(booking.status)) {
        return NextResponse.json({ error: "This booking cannot start pickup" }, { status: 400 });
      }

      const updated = await prisma.booking.update({
        where: { id },
        data: { pickupStartedAt: new Date() },
      });

      await prisma.scanEvent.create({
        data: {
          bookingId: id,
          userId: session.user.id,
          status: booking.status,
          note: "Pickup started — live geolocation tracking enabled",
        },
      });

      await logActivity({
        userId: session.user.id,
        action: "PICKUP_START",
        entity: "Booking",
        entityId: id,
        details: `Pickup started for booking ${booking.referenceNumber} — live tracking enabled`,
      });

      const assigned =
        booking.assignments.find((a) => a.phase !== "DROPOFF")?.user ||
        booking.assignments[0]?.user;
      if (assigned) {
        await notifyPickupStarted(assigned.id, booking.referenceNumber);
      }

      await sendCustomerNotification({
        customerId: booking.customerId,
        type: "pickup_started",
        title: "Pickup Started — Live Tracking",
        message: `Your pickup for booking ${booking.referenceNumber} has started. You can now track the assigned employee's live location.`,
        link: `/track/${booking.referenceNumber}`,
      });

      return NextResponse.json({
        booking: updated,
        started: true,
        message: `Pickup started for ${booking.referenceNumber}`,
      });
    }

    // cancel — admin only
    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Only admins can cancel live tracking" }, { status: 403 });
    }
    if (!booking.pickupStartedAt) {
      return NextResponse.json({ error: "Pickup has not been started" }, { status: 400 });
    }

    const updated = await prisma.booking.update({
      where: { id },
      data: { pickupStartedAt: null },
    });

    await prisma.scanEvent.create({
      data: {
        bookingId: id,
        userId: session.user.id,
        status: booking.status,
        note: "Geolocation tracking cancelled by admin",
      },
    });

    await logActivity({
      userId: session.user.id,
      action: "PICKUP_CANCEL",
      entity: "Booking",
      entityId: id,
      details: `Live tracking cancelled by admin for booking ${booking.referenceNumber}`,
    });

    await sendCustomerNotification({
      customerId: booking.customerId,
      type: "tracking_cancelled",
      title: "Live Tracking Disabled",
      message: `Live tracking for booking ${booking.referenceNumber} has been disabled by our team.`,
      link: `/track/${booking.referenceNumber}`,
    });

    return NextResponse.json({
      booking: updated,
      started: false,
      message: `Live tracking cancelled for ${booking.referenceNumber}`,
    });
  } catch {
    return NextResponse.json({ error: "Failed to update pickup tracking" }, { status: 500 });
  }
}
