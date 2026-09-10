import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";
import type { BookingStatus } from "@/generated/prisma/client";
import { isBookingLocked } from "@/lib/booking-access";
import { availableLogisticsActions, logisticsTaskType, type LogisticsAction } from "@/lib/logistics-workflow";
import { sendCustomerNotification } from "@/lib/notifications";

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
    // validate optional coords if provided
    if (latitude != null || longitude != null) {
      if (typeof latitude !== "number" || typeof longitude !== "number" || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        return NextResponse.json({ error: "Invalid coordinates" }, { status: 400 });
      }
      if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
        return NextResponse.json({ error: "Coordinates out of range" }, { status: 400 });
      }
    }
    // guard base64 photo size (prevent DB bloat DoS) — ~1.4MB decoded max (2MB dataURL)
    if (photo && typeof photo === "string" && photo.length > 2_000_000) {
      return NextResponse.json({ error: "Photo too large (max 2MB)" }, { status: 413 });
    }

    const booking = await prisma.booking.findUnique({
      where: { id },
      select: {
        id: true,
        referenceNumber: true,
        customerId: true,
        totalPrice: true,
        status: true,
        pickupStartedAt: true,
        deliveryArrivedAt: true,
        assignments: { select: { userId: true, phase: true } },
      },
    });

    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }
    if (isBookingLocked(booking.status)) {
      return NextResponse.json({ error: "Cancelled and no-show bookings are locked" }, { status: 409 });
    }

    // Bug5: idempotent guard — block duplicate arrive
    if (action === "arrive-delivery" && booking.deliveryArrivedAt) {
      return NextResponse.json({ error: "Already marked as arrived at delivery location" }, { status: 409 });
    }
    if (action === "arrive-pickup" && booking.status !== "CONFIRMED") {
      return NextResponse.json({ error: "Already marked as arrived at pickup" }, { status: 409 });
    }

    const availableActions = availableLogisticsActions(booking.status, Boolean(booking.pickupStartedAt), Boolean(booking.deliveryArrivedAt));
    if (!availableActions.includes(action as LogisticsAction)) {
      return NextResponse.json(
        { error: `Action '${action}' is not valid while the booking is ${booking.status.replaceAll("_", " ").toLowerCase()}` },
        { status: 409 }
      );
    }

    if (session.user.role === "EMPLOYEE") {
      const phase = action.includes("delivery") ? "DROPOFF" : "PICKUP";
      const assigned = booking.assignments.some((assignment) => assignment.userId === session.user.id && assignment.phase === phase);
      if (!assigned) return NextResponse.json({ error: `Only the assigned ${phase.toLowerCase()} employee can perform this action` }, { status: 403 });

      if (action === "start-pickup" || action === "start-delivery") {
        const otherActiveTask = await prisma.booking.findFirst({
          where: {
            id: { not: id },
            pickupStartedAt: { not: null },
            status: { in: ["CONFIRMED", "RECEIVED", "OUT_FOR_DELIVERY"] },
            assignments: { some: { userId: session.user.id, phase } },
          },
          select: { referenceNumber: true },
        });
        if (otherActiveTask) {
          return NextResponse.json(
            { error: `Finish active task ${otherActiveTask.referenceNumber} before starting another ${phase.toLowerCase()} task` },
            { status: 409 }
          );
        }
      }
    }

    const newStatus = ACTION_MAP[action];

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.booking.update({
        where: { id },
        data: {
          status: newStatus as BookingStatus,
          pickupStartedAt: action === "start-pickup" || action === "start-delivery"
            ? new Date()
            : action === "complete-pickup" || action === "complete-delivery"
              ? null
              : undefined,
          deliveryArrivedAt: action === "arrive-delivery"
            ? new Date()
            : action === "start-delivery" || action === "complete-delivery"
              ? null
              : undefined,
        },
      });
      await tx.scanEvent.create({
        data: {
          bookingId: id,
          userId: session.user.id,
          status: newStatus,
          photo: photo || null,
          note: note || `Task action: ${action}`,
          latitude: latitude ?? null,
          longitude: longitude ?? null,
        },
      });
      return result;
    });

    await logActivity({
      userId: session.user.id,
      action: "TASK",
      entity: "Booking",
      entityId: id,
      details: `${action} — ${booking.referenceNumber}`,
    });

    const customerMessages: Partial<Record<LogisticsAction, { title: string; message: string }>> = {
      "start-pickup": { title: "Pickup Started", message: `Pickup has started for booking ${booking.referenceNumber}. Live tracking is now available.` },
      "arrive-pickup": { title: "Rider Arrived", message: `The assigned employee has arrived for booking ${booking.referenceNumber}.` },
      "complete-pickup": { title: "Luggage Received", message: `Pickup is complete and the luggage for booking ${booking.referenceNumber} is being stored.` },
      "start-delivery": { title: "Delivery Started", message: `Delivery has started for booking ${booking.referenceNumber}. Live tracking is now available.` },
      "arrive-delivery": { title: "Delivery Rider Arrived", message: `The assigned employee has arrived at the delivery location for booking ${booking.referenceNumber}.` },
      "complete-delivery": { title: "Delivery Completed", message: `Booking ${booking.referenceNumber} has been delivered successfully.` },
    };
    const customerMessage = customerMessages[action as LogisticsAction];
    if (customerMessage) {
      try {
        await sendCustomerNotification({
          customerId: booking.customerId,
          type: action,
          title: customerMessage.title,
          message: customerMessage.message,
          link: `/track/${booking.referenceNumber}`,
        });
      } catch (notificationError) {
        console.warn("[Logistics] customer notification failed:", notificationError);
      }
    }

    if (newStatus === "DELIVERED") {
      const existingPoints = await prisma.pointsTransaction.findFirst({
        where: { reference: booking.id, type: "EARNED" },
      });
      if (!existingPoints) {
        const pointsEarned = Math.floor(Number(updated.totalPrice) / 10);
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

    return NextResponse.json({
      success: true,
      status: newStatus,
      pickupStartedAt: updated.pickupStartedAt,
      deliveryArrivedAt: updated.deliveryArrivedAt,
      taskType: logisticsTaskType(newStatus),
      availableActions: availableLogisticsActions(newStatus, Boolean(updated.pickupStartedAt), Boolean(updated.deliveryArrivedAt)),
    });
  } catch (error) {
    console.error("[Logistics] action failed:", error);
    return NextResponse.json({ error: "Failed to process action" }, { status: 500 });
  }
}
