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
    // Financial adjustments remain available after an operational cancellation
    // or no-show; locking booking edits must not block an agreed refund.

    // Refunds are negotiated adjustments, not gateway reversals. Keep the
    // original collection immutable and append a negative ledger entry. This
    // supports goodwill/compensation refunds above the collected balance while
    // preserving a complete audit trail.
    const refund = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`refund:${id}`}))`;
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
    return NextResponse.json({ error: "Failed to issue refund" }, { status: 500 });
  }
}
