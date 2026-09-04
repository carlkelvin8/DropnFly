import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyWebhookSignature, type PayMongoWebhookPayload } from "@/lib/paymongo";
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
        // Only transition PENDING/FAILED -> PAID; verify payload state if present
        const state = (payload.data.attributes as Record<string, unknown> | undefined)?.state;
        if (state && state !== "paid" && payload.data.attributes?.payment_intent?.status && payload.data.attributes.payment_intent.status !== "paid") {
          // ignore non-paid states
        }
        const updated = await prisma.payment.updateMany({
          where: { id: payment.id, status: { in: ["PENDING", "FAILED"] } },
          data: { status: "PAID", paidAt: payment.paidAt || new Date() },
        });
        // If another webhook already flipped to PAID, updated.count ===0 => idempotent
        if (updated.count === 0) return NextResponse.json({ received: true });

        const booking = await prisma.booking.findUnique({ where: { id: payment.bookingId } });
        if (booking && booking.status === "PENDING") {
          const confirmed = await prisma.booking.update({
            where: { id: booking.id },
            data: { status: "CONFIRMED", checkoutLockedUntil: null },
            include: { customer: { select: { name: true, email: true } } },
          });
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
        } else if (booking) {
          await prisma.booking.update({ where: { id: booking.id }, data: { checkoutLockedUntil: null } });
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
