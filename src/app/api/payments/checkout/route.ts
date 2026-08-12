import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getCustomerSession } from "@/lib/customer-auth";
import { createCheckoutSession, isPaymongoConfigured } from "@/lib/paymongo";
import { logActivity } from "@/lib/activity";

export async function POST(req: Request) {
  const session = await auth();
  const customer = await getCustomerSession();
  if (!session?.user && !customer) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { bookingId, method } = body as {
      bookingId: string;
      method?: "GCASH" | "MAYA" | "CARD";
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
    const remaining = booking.totalPrice - (paidAmount._sum.amount || 0);

    if (remaining <= 0) {
      return NextResponse.json({ error: "Booking is already fully paid" }, { status: 400 });
    }

    const selectedMethod = method && ["GCASH", "MAYA", "CARD"].includes(method) ? method : "GCASH";

    if (!isPaymongoConfigured()) {
      const payment = await prisma.payment.create({
        data: {
          bookingId: booking.id,
          customerId: booking.customerId,
          amount: remaining,
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
          details: `Payment request of ${remaining} for booking ${booking.referenceNumber}`,
        });
      }

      return NextResponse.json({
        mode: "manual",
        paymentId: payment.id,
        message: "Online payment gateway is not configured. Your payment request has been recorded — our team will confirm payment on pickup or delivery.",
      });
    }

    const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
    const successUrl = `${baseUrl}/my-account/bookings/${booking.id}?paid=1`;
    const cancelUrl = `${baseUrl}/my-account/bookings/${booking.id}`;

    const sessionResult = await createCheckoutSession({
      amount: remaining,
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
        amount: remaining,
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
        details: `Payment request of ${remaining} for booking ${booking.referenceNumber}`,
      });
    }

    return NextResponse.json({
      mode: "paymongo",
      paymentId: payment.id,
      url: sessionResult.checkoutUrl,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to start checkout";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
