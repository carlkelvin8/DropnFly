import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getCustomerSession } from "@/lib/customer-auth";
import { createCheckoutSession, isPaymongoConfigured } from "@/lib/paymongo";
import { logActivity } from "@/lib/activity";
import { canAccessBooking } from "@/lib/booking-access";

export async function POST(req: Request) {
  const session = await auth();
  const customer = await getCustomerSession();
  let lockedBookingId: string | null = null;
  try {
    const body = await req.json();
    const { bookingId, method, amount } = body as {
      bookingId: string;
      method?: "GCASH" | "MAYA" | "CARD";
      amount?: number;
    };

    if (!bookingId) {
      return NextResponse.json({ error: "Missing booking ID" }, { status: 400 });
    }

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { customer: { select: { name: true, email: true } } },
    });

    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }
    if (session?.user?.role === "EMPLOYEE") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (!(await canAccessBooking(booking))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (booking.status === "CANCELLED") {
      return NextResponse.json({ error: "Cannot pay for a cancelled booking" }, { status: 400 });
    }

    if (customer && booking.customerId !== customer.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const paidAmount = await prisma.payment.aggregate({
      where: { bookingId: booking.id, status: "PAID" },
      _sum: { amount: true },
    });
    const remaining = Number(booking.totalPrice) - Number(paidAmount._sum.amount || 0);

    if (remaining <= 0) {
      return NextResponse.json({ error: "Booking is already fully paid" }, { status: 400 });
    }
    const checkoutAmount = amount == null ? remaining : Number(amount);
    if (!Number.isFinite(checkoutAmount) || checkoutAmount <= 0 || checkoutAmount > remaining) {
      return NextResponse.json({ error: "Invalid payment amount" }, { status: 400 });
    }

    const pending = await prisma.payment.findFirst({
      where: { bookingId: booking.id, status: "PENDING", gatewayRef: { not: null } },
      select: { id: true, createdAt: true },
    });
    if (pending && pending.createdAt > new Date(Date.now() - 30 * 60 * 1000)) {
      return NextResponse.json({ error: "A payment for this booking is already pending" }, { status: 409 });
    }
    if (pending) await prisma.payment.update({ where: { id: pending.id }, data: { status: "FAILED" } });

    const selectedMethod = method && ["GCASH", "MAYA", "CARD"].includes(method) ? method : "GCASH";

    if (!isPaymongoConfigured()) {
      const payment = await prisma.payment.create({
        data: {
          bookingId: booking.id,
          customerId: booking.customerId,
          amount: checkoutAmount,
          method: selectedMethod,
          status: "PENDING",
        },
      });

      if (session?.user) {
        await logActivity({
          userId: session.user.id,
          action: "CREATE",
          entity: "Payment",
          entityId: payment.id,
          details: `Payment request of ${checkoutAmount} for booking ${booking.referenceNumber}`,
        });
      }

      return NextResponse.json({
        mode: "manual",
        paymentId: payment.id,
        message: "Online payment gateway is not configured. Your payment request has been recorded — our team will confirm payment on pickup or delivery.",
      });
    }

    const now = new Date();
    const lock = await prisma.booking.updateMany({
      where: {
        id: booking.id,
        OR: [{ checkoutLockedUntil: null }, { checkoutLockedUntil: { lt: now } }],
      },
      data: { checkoutLockedUntil: new Date(now.getTime() + 30 * 60 * 1000) },
    });
    if (lock.count !== 1) {
      return NextResponse.json({ error: "A checkout is already being created for this booking" }, { status: 409 });
    }
    lockedBookingId = booking.id;

    const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
    const customerPath = customer ? `/my-account/bookings/${booking.id}` : `/book/confirm/${booking.referenceNumber}`;
    const successUrl = `${baseUrl}${customerPath}?paid=1`;
    const cancelUrl = `${baseUrl}${customerPath}`;

    const sessionResult = await createCheckoutSession({
      amount: checkoutAmount,
      description: `DropnFly luggage booking ${booking.referenceNumber}`,
      name: booking.customer.name,
      email: booking.customer.email,
      successUrl,
      cancelUrl,
      paymentMethodTypes:
        selectedMethod === "GCASH"
          ? ["gcash", "maya", "card"]
          : selectedMethod === "MAYA"
          ? ["maya", "gcash", "card"]
          : ["card", "gcash", "maya"],
      metadata: { bookingId: booking.id, referenceNumber: booking.referenceNumber },
    });

    const payment = await prisma.payment.create({
      data: {
        bookingId: booking.id,
        customerId: booking.customerId,
        amount: checkoutAmount,
        method: selectedMethod,
        status: "PENDING",
        gatewayRef: sessionResult.id,
      },
    });

    if (session?.user) {
      await logActivity({
        userId: session.user.id,
        action: "CREATE",
        entity: "Payment",
        entityId: payment.id,
        details: `Payment request of ${checkoutAmount} for booking ${booking.referenceNumber}`,
      });
    }

    return NextResponse.json({
      mode: "paymongo",
      paymentId: payment.id,
      url: sessionResult.checkoutUrl,
    });
  } catch (e) {
    if (lockedBookingId) {
      await prisma.booking.updateMany({ where: { id: lockedBookingId }, data: { checkoutLockedUntil: null } }).catch(() => undefined);
    }
    const message = e instanceof Error ? e.message : "Failed to start checkout";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
