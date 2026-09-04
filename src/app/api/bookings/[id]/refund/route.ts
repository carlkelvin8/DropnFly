import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";
import { decimalsToNumbers } from "@/lib/serialize";
import { isBookingLocked } from "@/lib/booking-access";

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
    const { amount, reason, paymentMethod } = await req.json();

    const amountNum = Number(amount);
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      return NextResponse.json({ error: "Invalid refund amount" }, { status: 400 });
    }
    if (!reason?.trim()) {
      return NextResponse.json({ error: "Refund reason is required" }, { status: 400 });
    }

    const booking = await prisma.booking.findUnique({
      where: { id },
      select: {
        status: true,
        customerId: true,
        referenceNumber: true,
        payments: {
          select: { id: true, amount: true, status: true, refundedAt: true },
        },
      },
    });

    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }
    if (isBookingLocked(booking.status)) {
      return NextResponse.json({ error: "Cancelled and no-show bookings are locked" }, { status: 409 });
    }

    // Net paid = sum PAID (not refunded) + sum REFUNDED negative amounts
    const totalPaid = booking.payments
      .filter((p) => p.status === "PAID" && !p.refundedAt)
      .reduce((sum, p) => sum + Number(p.amount), 0);
    const totalRefunded = booking.payments
      .filter((p) => p.status === "REFUNDED" && Number(p.amount) < 0)
      .reduce((sum, p) => sum + Math.abs(Number(p.amount)), 0);
    const netPaid = totalPaid - totalRefunded;

    if (amountNum > netPaid) {
      return NextResponse.json(
        { error: `Refund amount exceeds net paid (${netPaid})` },
        { status: 400 }
      );
    }

    const refund = await prisma.$transaction(async (tx) => {
      const created = await tx.payment.create({
        data: {
          bookingId: id,
          customerId: booking.customerId,
          amount: -Math.abs(amountNum),
          method: ["GCASH", "MAYA", "CARD", "CASH"].includes(paymentMethod) ? paymentMethod : "CASH",
          status: "REFUNDED",
          reference: `RFND-${booking.referenceNumber}-${Date.now().toString(36).toUpperCase()}`,
          paidAt: new Date(),
          refundedAt: new Date(),
        },
      });

      let remaining = amountNum;
      for (const payment of booking.payments.filter((p) => p.status === "PAID" && !p.refundedAt)) {
        if (remaining <= 0) break;
        const toRefund = Math.min(Number(payment.amount), remaining);
        remaining -= toRefund;
        if (toRefund >= Number(payment.amount)) {
          await tx.payment.update({
            where: { id: payment.id },
            data: { refundedAt: new Date(), status: "REFUNDED" },
          });
        }
        // Partial refunds keep original PAID but future netPaid accounts for negative refund
      }
      return created;
    });

    await logActivity({
      userId: session.user.id,
      action: "REFUND",
      entity: "Payment",
      entityId: refund.id,
      details: `Refunded ${amount} for booking ${booking.referenceNumber}: ${reason}`,
    });

    return NextResponse.json(decimalsToNumbers(refund), { status: 201 });
  } catch (error) {
    console.error("Refund error:", error);
    return NextResponse.json({ error: "Failed to issue refund" }, { status: 500 });
  }
}
