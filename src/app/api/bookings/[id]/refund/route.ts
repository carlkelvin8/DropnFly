import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";

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
    const { amount, reason, paymentMethod } = await req.json();

    if (!amount || amount <= 0) {
      return NextResponse.json({ error: "Invalid refund amount" }, { status: 400 });
    }
    if (!reason?.trim()) {
      return NextResponse.json({ error: "Refund reason is required" }, { status: 400 });
    }

    const booking = await prisma.booking.findUnique({
      where: { id },
      select: {
        customerId: true,
        referenceNumber: true,
        payments: {
          where: { status: "PAID" },
          select: { id: true, amount: true, refundedAt: true },
        },
      },
    });

    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    const totalPaid = booking.payments
      .filter((p) => !p.refundedAt)
      .reduce((sum, p) => sum + p.amount, 0);

    if (amount > totalPaid) {
      return NextResponse.json(
        { error: `Refund amount exceeds total paid (${totalPaid})` },
        { status: 400 }
      );
    }

    const refund = await prisma.payment.create({
      data: {
        bookingId: id,
        customerId: booking.customerId,
        amount: -Math.abs(amount),
        method: paymentMethod || "CASH",
        status: "REFUNDED",
        reference: `RFND-${booking.referenceNumber}-${Date.now().toString(36).toUpperCase()}`,
        paidAt: new Date(),
        refundedAt: new Date(),
      },
    });

    let remaining = amount;
    for (const payment of booking.payments) {
      if (remaining <= 0) break;
      if (payment.refundedAt) continue;

      const toRefund = Math.min(payment.amount, remaining);
      remaining -= toRefund;

      await prisma.payment.update({
        where: { id: payment.id },
        data: { refundedAt: new Date(), status: "REFUNDED" },
      });
    }

    await logActivity({
      userId: session.user.id,
      action: "REFUND",
      entity: "Payment",
      entityId: refund.id,
      details: `Refunded ${amount} for booking ${booking.referenceNumber}: ${reason}`,
    });

    return NextResponse.json(refund, { status: 201 });
  } catch (error) {
    console.error("Refund error:", error);
    return NextResponse.json({ error: "Failed to issue refund" }, { status: 500 });
  }
}
