import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";
import { sendReceiptEmail } from "@/lib/email";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!["ADMIN", "STAFF"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { id } = await params;

    const booking = await prisma.booking.findUnique({
      where: { id },
      select: {
        id: true,
        referenceNumber: true,
        status: true,
        pickupLocation: true,
        dropOffLocation: true,
        numberOfBags: true,
        totalPrice: true,
        createdAt: true,
        customer: { select: { name: true, email: true, phone: true } },
      },
    });

    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }
    if (!booking.customer?.email) {
      return NextResponse.json({ error: "Customer has no email address" }, { status: 400 });
    }

    const sent = await sendReceiptEmail({
      to: booking.customer.email,
      customerName: booking.customer.name,
      referenceNumber: booking.referenceNumber,
      pickupLocation: booking.pickupLocation,
      dropOffLocation: booking.dropOffLocation,
      numberOfBags: booking.numberOfBags,
      totalPrice: Number(booking.totalPrice),
      createdAt: booking.createdAt.toISOString(),
      customerEmail: booking.customer.email,
      customerPhone: booking.customer.phone,
      status: booking.status,
    });

    if (!sent) {
      return NextResponse.json(
        { error: "Email notifications are disabled in settings" },
        { status: 400 }
      );
    }

    try {
      await logActivity({
        userId: session.user.id,
        action: "EMAIL",
        entity: "Booking",
        entityId: booking.id,
        details: `Receipt emailed to ${booking.customer.email} for booking ${booking.referenceNumber}`,
      });
    } catch (logErr) {
      console.warn("[RECEIPT-EMAIL] logActivity failed (non-fatal):", logErr);
    }

    return NextResponse.json({ ok: true, to: booking.customer.email });
  } catch (e) {
    console.error("[RECEIPT-EMAIL] Failed:", e);
    const message = e instanceof Error ? e.message : String(e);
    const safe = message.replace(/\s+/g, " ").slice(0, 300);
    return NextResponse.json(
      { error: `Failed to send receipt email: ${safe}` },
      { status: 500 }
    );
  }
}
