import { NextResponse } from "next/server";
import { trackingResetForStatus } from "@/lib/logistics-workflow";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";
import { normalizeReference } from "@/lib/utils";
import { notifyDropOffVerified } from "@/lib/notifications";
import { canAccessBooking } from "@/lib/booking-access";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ reference: string }> }
) {
  const { reference } = await params;

  try {
    const { confirmed, photo, note, latitude, longitude } = await req.json();

    if (confirmed !== true) {
      return NextResponse.json({ error: "Please confirm that you handed your baggage to the employee." }, { status: 400 });
    }

    const booking = await prisma.booking.findUnique({
      where: { referenceNumber: normalizeReference(reference) },
      select: {
        id: true,
        referenceNumber: true,
        status: true,
        customerId: true,
        customer: { select: { name: true } },
      },
    });

    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }
    if (!(await canAccessBooking(booking))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    if (photo != null && (typeof photo !== "string" || photo.length > 7_000_000) || (note && (typeof note !== "string" || note.length > 1000))) {
      return NextResponse.json({ error: "Photo or note is too large" }, { status: 413 });
    }

    if (["CANCELLED", "NO_SHOW", "DELIVERED"].includes(booking.status)) {
      return NextResponse.json({ error: "This booking can no longer be verified" }, { status: 400 });
    }

    if (booking.status !== "RECEIVED") {
      return NextResponse.json(
        { error: "Luggage must be received first before you can verify the drop-off" },
        { status: 400 }
      );
    }

    const updatedBooking = await prisma.$transaction(async (tx) => {
      // Claim RECEIVED -> IN_STORAGE atomically so a double submit cannot apply it twice.
      const claimed = await tx.booking.updateMany({
        where: { id: booking.id, status: "RECEIVED" },
        data: { status: "IN_STORAGE", ...trackingResetForStatus("IN_STORAGE") },
      });
      if (claimed.count === 0) return null;
      // Keep every physical item in the same phase as the booking (same as the scanner's storage intake).
      await tx.luggageItem.updateMany({
        where: { bookingId: booking.id, status: { notIn: ["CANCELLED", "DELIVERED"] } },
        data: { status: "IN_STORAGE" },
      });
      await tx.scanEvent.create({
        data: {
          bookingId: booking.id,
          userId: null,
          status: "IN_STORAGE",
          photo,
          note: note || "Customer confirmed baggage handover to employee",
          latitude: latitude ?? null,
          longitude: longitude ?? null,
        },
      });
      return tx.booking.findUniqueOrThrow({ where: { id: booking.id }, omit: { qrCode: true, luggagePhotos: true } });
    });
    if (!updatedBooking) {
      return NextResponse.json({ error: "This drop-off was already verified" }, { status: 409 });
    }

    await logActivity({
      userId: null,
      action: "VERIFY",
      entity: "Booking",
      entityId: booking.id,
      details: `Customer confirmed baggage handover to employee for ${booking.referenceNumber}`,
    });

    const [assigned, staff] = await Promise.all([
      prisma.bookingAssignment.findMany({
        where: { bookingId: booking.id },
        select: { userId: true },
      }),
      prisma.user.findMany({
        where: { role: { in: ["ADMIN", "STAFF"] }, isActive: true },
        select: { id: true },
      }),
    ]);

    const userIds = Array.from(
      new Set([...assigned.map((a) => a.userId), ...staff.map((s) => s.id)])
    );
    await notifyDropOffVerified(userIds, booking.referenceNumber, booking.customer.name);

    return NextResponse.json({
      success: true,
      booking: updatedBooking,
      message: `Customer confirmed baggage handover — ${booking.referenceNumber} is now In Storage`,
    });
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("Passenger verification error:", error);
    }
    return NextResponse.json({ error: "Failed to verify drop-off" }, { status: 500 });
  }
}
