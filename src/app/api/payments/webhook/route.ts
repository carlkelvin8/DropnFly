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

  try {
    if (eventType === "checkout_session.payment_paid") {
      const payment = await prisma.payment.findUnique({
        where: { gatewayRef: resourceId },
      });

      if (payment) {
        await prisma.payment.update({
          where: { id: payment.id },
          data: { status: "PAID", paidAt: new Date() },
        });

        const booking = await prisma.booking.findUnique({ where: { id: payment.bookingId } });
        if (booking && booking.status === "PENDING") {
          await prisma.booking.update({
            where: { id: booking.id },
            data: { status: "CONFIRMED" },
          });
        }
      }
    } else if (eventType === "checkout_session.payment_failed") {
      await prisma.payment.updateMany({
        where: { gatewayRef: resourceId, status: "PENDING" },
        data: { status: "FAILED" },
      });
    }

    return NextResponse.json({ received: true });
  } catch {
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
