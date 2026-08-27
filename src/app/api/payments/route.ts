import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";
import { hasStaffRole } from "@/lib/staff-access";
import { decimalsToNumbers } from "@/lib/serialize";
import { isBookingLocked } from "@/lib/booking-access";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user || !hasStaffRole(session.user, ["ADMIN", "STAFF"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const createdAt = from || to
    ? {
        ...(from ? { gte: new Date(`${from}T00:00:00`) } : {}),
        ...(to ? { lte: new Date(`${to}T23:59:59.999`) } : {}),
      }
    : undefined;

  const payments = await prisma.payment.findMany({
    where: createdAt ? { createdAt } : undefined,
    orderBy: { createdAt: "desc" },
    include: {
      booking: { select: { referenceNumber: true } },
      customer: { select: { name: true, email: true } },
    },
  });

  return NextResponse.json(decimalsToNumbers(payments));
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user || !hasStaffRole(session.user, ["ADMIN", "STAFF"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { bookingId, amount, method, status } = body;

    const numericAmount = Number(amount);
    if (!bookingId || !Number.isFinite(numericAmount) || numericAmount <= 0 || !["GCASH", "MAYA", "CARD", "CASH"].includes(method) || !["PENDING", "PAID", "FAILED"].includes(status || "PAID")) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: { customerId: true, referenceNumber: true, totalPrice: true, status: true },
    });

    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }
    if (isBookingLocked(booking.status)) {
      return NextResponse.json({ error: "Cancelled and no-show bookings are locked" }, { status: 409 });
    }
    const payment = await prisma.$transaction(async (tx) => {
      // Serialize manual payments per booking so concurrent requests cannot
      // both pass the remaining-balance check.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${bookingId}))`;
      const totals = await tx.payment.aggregate({
        where: { bookingId, status: "PAID" },
        _sum: { amount: true },
      });
      const remaining = Math.max(0, Number(booking.totalPrice) - Number(totals._sum.amount || 0));
      if ((status || "PAID") === "PAID" && numericAmount > remaining) {
        throw new PaymentBalanceError(remaining);
      }

      return tx.payment.create({
        data: {
          bookingId,
          customerId: booking.customerId,
          amount: numericAmount,
          method,
          status: status || "PAID",
          paidAt: (status || "PAID") === "PAID" ? new Date() : null,
        },
      });
    });

    await logActivity({
      userId: session.user.id,
      action: "CREATE",
      entity: "Payment",
      entityId: payment.id,
      details: `Payment of ${numericAmount} for booking ${booking.referenceNumber}`,
    });

    return NextResponse.json(decimalsToNumbers(payment), { status: 201 });
  } catch (error) {
    if (error instanceof PaymentBalanceError) {
      return NextResponse.json(
        { error: `Payment exceeds remaining balance of ${error.remaining}` },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: "Failed to create payment" }, { status: 500 });
  }
}

class PaymentBalanceError extends Error {
  constructor(readonly remaining: number) {
    super("Payment exceeds remaining balance");
  }
}
