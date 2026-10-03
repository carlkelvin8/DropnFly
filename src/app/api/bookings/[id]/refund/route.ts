import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";
import { decimalsToNumbers } from "@/lib/serialize";

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
        customerId: true,
        referenceNumber: true,
      },
    });

    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    // Keep the original collection immutable and append a negative ledger entry
    // so the payment history remains auditable.
    const refund = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`refund:${id}`}))`;
      // Re-read the ledger while holding the booking lock so two simultaneous
      // refund requests cannot both spend the same paid balance.
      const currentPayments = await tx.payment.findMany({
        where: { bookingId: id },
        select: { amount: true, status: true },
      });
      const collected = currentPayments
        .filter((payment) => payment.status === "PAID" && Number(payment.amount) > 0)
        .reduce((sum, payment) => sum + Number(payment.amount), 0);
      const alreadyRefunded = currentPayments
        .filter((payment) => payment.status === "REFUNDED")
        .reduce((sum, payment) => sum + Math.abs(Number(payment.amount)), 0);
      const refundableBalance = Math.max(0, collected - alreadyRefunded);
      if (refundableBalance <= 0) {
        throw new Error("NO_REFUNDABLE_BALANCE");
      }
      if (amountNum > refundableBalance) {
        throw new Error(`REFUND_EXCEEDS_BALANCE:${refundableBalance.toFixed(2)}`);
      }
      return tx.payment.create({
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
    if (error instanceof Error && error.message === "NO_REFUNDABLE_BALANCE") {
      return NextResponse.json({ error: "This booking has no paid amount available for refund" }, { status: 409 });
    }
    if (error instanceof Error && error.message.startsWith("REFUND_EXCEEDS_BALANCE:")) {
      const balance = error.message.split(":")[1];
      return NextResponse.json({ error: `Refund cannot exceed the remaining paid amount of ${balance}` }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to issue refund" }, { status: 500 });
  }
}
