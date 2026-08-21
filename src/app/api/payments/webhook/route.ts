import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyWebhookSignature, type PayMongoWebhookPayload } from "@/lib/paymongo";

export async function POST(req: Request) {
  const rawBody = await req.text();
  const signature = req.headers.get("paymongo-signature");

  if (!verifyWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid webhook signature" }, { status: 400 });
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

      if (payment && payment.status !== "REFUNDED") {
        await prisma.payment.updateMany({
          where: { id: payment.id, status: { in: ["PENDING", "FAILED"] } },
          data: { status: "PAID", paidAt: payment.paidAt || new Date() },
        });

        const booking = await prisma.booking.findUnique({ where: { id: payment.bookingId } });
        if (booking && booking.status === "PENDING") {
          await prisma.booking.update({
            where: { id: booking.id },
            data: { status: "CONFIRMED", checkoutLockedUntil: null },
          });
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
    if (process.env.NODE_ENV === "development") {
      console.error("PayMongo webhook processing failed", error);
    }
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
