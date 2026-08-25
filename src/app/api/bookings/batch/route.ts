import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";
import { hasStaffRole } from "@/lib/staff-access";
import { awardDeliveryPoints } from "@/lib/loyalty";

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { ids, action } = await req.json();

    if (!hasStaffRole(session.user, ["ADMIN", "STAFF"])) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (["delete", "cancel"].includes(action) && session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Only administrators may delete or cancel bookings" }, { status: 403 });
    }

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "No bookings selected" }, { status: 400 });
    }

    const cappedIds = ids.slice(0, 50);
    const lockedCount = await prisma.booking.count({
      where: { id: { in: cappedIds }, status: { in: ["CANCELLED", "NO_SHOW"] } },
    });
    if (lockedCount > 0) {
      return NextResponse.json({ error: `${lockedCount} cancelled or no-show booking(s) are locked; remove them from the selection` }, { status: 409 });
    }

    if (action === "delete") {
      await prisma.$transaction([
        prisma.payment.deleteMany({ where: { bookingId: { in: cappedIds } } }),
        prisma.bookingAssignment.deleteMany({ where: { bookingId: { in: cappedIds } } }),
        prisma.scanEvent.deleteMany({ where: { bookingId: { in: cappedIds } } }),
        prisma.chatMessage.deleteMany({ where: { bookingId: { in: cappedIds } } }),
        prisma.bookingReview.deleteMany({ where: { bookingId: { in: cappedIds } } }),
        prisma.bookingExtension.deleteMany({ where: { bookingId: { in: cappedIds } } }),
        prisma.incidentTimeline.deleteMany({ where: { incident: { bookingId: { in: cappedIds } } } }),
        prisma.incidentReport.deleteMany({ where: { bookingId: { in: cappedIds } } }),
        prisma.baggageTag.updateMany({ where: { bookingId: { in: cappedIds } }, data: { bookingId: null, luggageItemId: null, status: "AVAILABLE", assignedAt: null } }),
        prisma.luggageItem.deleteMany({ where: { bookingId: { in: cappedIds } } }),
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

      for (const booking of bookings) await awardDeliveryPoints(booking);

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
