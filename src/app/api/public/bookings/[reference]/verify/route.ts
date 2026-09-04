import { NextResponse } from "next/server";
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
    const { photo, note, latitude, longitude } = await req.json();

    if (!photo) {
      return NextResponse.json({ error: "A verification photo is required" }, { status: 400 });
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

    if (typeof photo !== "string" || photo.length > 7_000_000 || (note && (typeof note !== "string" || note.length > 1000))) {
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

    const [updatedBooking] = await Promise.all([
      prisma.booking.update({
        where: { id: booking.id },
        data: { status: "IN_STORAGE" },
      }),
      prisma.scanEvent.create({
        data: {
          bookingId: booking.id,
          userId: null,
          status: "IN_STORAGE",
          photo,
          note: note || "Passenger drop-off verification",
          latitude: latitude ?? null,
          longitude: longitude ?? null,
        },
      }),
    ]);

    await logActivity({
      userId: null,
      action: "VERIFY",
      entity: "Booking",
      entityId: booking.id,
      details: `Passenger drop-off verified with photo for ${booking.referenceNumber}`,
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
      message: `Drop-off verified — ${booking.referenceNumber} is now In Storage`,
    });
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("Passenger verification error:", error);
    }
    return NextResponse.json({ error: "Failed to verify drop-off" }, { status: 500 });
  }
}
