import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hasPaidWebhookState, verifyWebhookSignature, type PayMongoWebhookPayload } from "@/lib/paymongo";
import { sendConfirmationEmail } from "@/lib/email";

export async function POST(req: Request) {
  const rawBody = await req.text();
  const signature = req.headers.get("paymongo-signature");

  if (!verifyWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid webhook signature" }, { status: 400 });
  }

  // Reject stale signatures to prevent replay of captured webhooks (after
  // verifying signature so attacker can't probe timing).
  const t = signature
    ?.split(",")
    .map((part) => part.trim())
    .find((part) => part.startsWith("t="))
    ?.slice(2);
  const timestamp = Number(t);
  const now = Math.floor(Date.now() / 1000);
  if (!t || !Number.isFinite(timestamp) || Math.abs(now - timestamp) > 300) { // 5 minutes tolerance
    return NextResponse.json({ error: "Webhook timestamp too old" }, { status: 400 });
  }

  let payload: PayMongoWebhookPayload;
  try {
    payload = JSON.parse(rawBody) as PayMongoWebhookPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const eventType = payload.type || "";
  const resourceId = payload.data?.id;
  if (!resourceId || typeof resourceId !== "string") {
    return NextResponse.json({ error: "Invalid webhook payload" }, { status: 400 });
  }

  try {
    if (eventType === "checkout_session.payment_paid") {
      const payment = await prisma.payment.findUnique({
        where: { gatewayRef: resourceId },
      });

      if (!payment) return NextResponse.json({ received: true });

      // Idempotency: already PAID, don't re-send email or mutate booking
      if (payment.status === "PAID") {
        return NextResponse.json({ received: true });
      }

      if (payment.status !== "REFUNDED") {
        // A signed event name is not enough if the payload explicitly reports
        // a non-paid session/payment-intent state. Acknowledge but do not mutate.
        if (!hasPaidWebhookState(payload.data.attributes)) {
          return NextResponse.json({ received: true });
        }
        // Payment -> PAID and booking -> CONFIRMED must commit together. If the booking
        // update failed after the payment was marked PAID, a retried webhook would hit the
        // idempotency guard above and leave the booking PENDING forever.
        const result = await prisma.$transaction(async (tx) => {
          const updated = await tx.payment.updateMany({
            where: { id: payment.id, status: { in: ["PENDING", "FAILED"] } },
            data: { status: "PAID", paidAt: payment.paidAt || new Date() },
          });
          // If another webhook already flipped to PAID, updated.count === 0 => idempotent
          if (updated.count === 0) return { skipped: true as const };

          const booking = await tx.booking.findUnique({ where: { id: payment.bookingId } });
          if (booking && booking.status === "PENDING") {
            const confirmed = await tx.booking.update({
              where: { id: booking.id },
              data: { status: "CONFIRMED", checkoutLockedUntil: null },
              include: { customer: { select: { name: true, email: true } } },
            });
            return { skipped: false as const, confirmed };
          }
          if (booking) await tx.booking.update({ where: { id: booking.id }, data: { checkoutLockedUntil: null } });
          return { skipped: false as const, confirmed: null };
        });
        if (result.skipped) return NextResponse.json({ received: true });

        const confirmed = result.confirmed;
        if (confirmed) {
          try {
            await sendConfirmationEmail({
              to: confirmed.customer.email,
              customerName: confirmed.customer.name,
              referenceNumber: confirmed.referenceNumber,
              qrCodeBase64: confirmed.qrCode,
              pickupLocation: confirmed.pickupLocation,
              dropOffLocation: confirmed.dropOffLocation,
              scheduledDate: confirmed.checkIn.toLocaleDateString("en-PH", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              }),
              numberOfBags: confirmed.numberOfBags,
              totalPrice: Number(confirmed.totalPrice),
            });
          } catch (error) {
            console.error("Paid booking confirmation email failed:", error);
          }
        }
      }
    } else if (eventType === "checkout_session.payment_failed") {
      const failed = await prisma.payment.findFirst({ where: { gatewayRef: resourceId }, select: { bookingId: true } });
      await prisma.payment.updateMany({
        where: { gatewayRef: resourceId, status: "PENDING" },
        data: { status: "FAILED" },
      });
      if (failed) await prisma.booking.update({ where: { id: failed.bookingId }, data: { checkoutLockedUntil: null } });
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("PayMongo webhook processing failed", error);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
