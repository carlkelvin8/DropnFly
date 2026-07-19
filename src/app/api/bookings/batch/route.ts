import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { ids, action } = await req.json();

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "No bookings selected" }, { status: 400 });
    }

    const cappedIds = ids.slice(0, 50);

    if (action === "delete") {
      await prisma.$transaction([
        prisma.payment.deleteMany({ where: { bookingId: { in: cappedIds } } }),
        prisma.bookingAssignment.deleteMany({ where: { bookingId: { in: cappedIds } } }),
        prisma.scanEvent.deleteMany({ where: { bookingId: { in: cappedIds } } }),
        prisma.chatMessage.deleteMany({ where: { bookingId: { in: cappedIds } } }),
        prisma.bookingReview.deleteMany({ where: { bookingId: { in: cappedIds } } }),
        prisma.bookingExtension.deleteMany({ where: { bookingId: { in: cappedIds } } }),
        prisma.luggageItem.deleteMany({ where: { bookingId: { in: cappedIds } } }),
        prisma.incidentReport.deleteMany({ where: { bookingId: { in: cappedIds } } }),
        prisma.booking.deleteMany({ where: { id: { in: cappedIds } } }),
      ]);

      await logActivity({
        userId: session.user.id,
        action: "DELETE",
        entity: "Booking",
        entityId: cappedIds.join(","),
        details: `Batch deleted ${cappedIds.length} booking(s)`,
      });

      return NextResponse.json({ success: true, count: cappedIds.length });
    }

    if (action === "confirm") {
      await prisma.booking.updateMany({
        where: { id: { in: cappedIds } },
        data: { status: "CONFIRMED" },
      });

      await logActivity({
        userId: session.user.id,
        action: "UPDATE",
        entity: "Booking",
        entityId: cappedIds.join(","),
        details: `Batch confirmed ${cappedIds.length} booking(s)`,
      });

      return NextResponse.json({ success: true, count: cappedIds.length });
    }

    if (action === "deliver") {
      const bookings = await prisma.booking.findMany({
        where: { id: { in: cappedIds } },
        select: { id: true, customerId: true, totalPrice: true, referenceNumber: true },
      });

      await prisma.booking.updateMany({
        where: { id: { in: cappedIds } },
        data: { status: "DELIVERED" },
      });

      for (const b of bookings) {
        const existingPoints = await prisma.pointsTransaction.findFirst({
          where: { reference: b.id, type: "EARNED" },
        });
        if (!existingPoints) {
          const pointsEarned = Math.floor(b.totalPrice / 10);
          if (pointsEarned > 0) {
            await Promise.all([
              prisma.customer.update({
                where: { id: b.customerId },
                data: { points: { increment: pointsEarned } },
              }),
              prisma.pointsTransaction.create({
                data: {
                  customerId: b.customerId,
                  points: pointsEarned,
                  type: "EARNED",
                  reference: b.id,
                  description: `Earned from booking ${b.referenceNumber}`,
                },
              }),
            ]);
          }
        }
      }

      await logActivity({
        userId: session.user.id,
        action: "UPDATE",
        entity: "Booking",
        entityId: cappedIds.join(","),
        details: `Batch delivered ${cappedIds.length} booking(s)`,
      });

      return NextResponse.json({ success: true, count: cappedIds.length });
    }

    if (action === "cancel") {
      await prisma.booking.updateMany({
        where: { id: { in: cappedIds } },
        data: { status: "CANCELLED" },
      });

      await logActivity({
        userId: session.user.id,
        action: "UPDATE",
        entity: "Booking",
        entityId: cappedIds.join(","),
        details: `Batch cancelled ${cappedIds.length} booking(s)`,
      });

      return NextResponse.json({ success: true, count: cappedIds.length });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "Batch operation failed" }, { status: 500 });
  }
}
