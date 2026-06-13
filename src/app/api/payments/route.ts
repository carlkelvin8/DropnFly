import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payments = await prisma.payment.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      booking: { select: { referenceNumber: true } },
      customer: { select: { name: true, email: true } },
    },
  });

  return NextResponse.json(payments);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { bookingId, amount, method, status } = body;

    if (!bookingId || !amount || !method) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: { customerId: true, referenceNumber: true },
    });

    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    const payment = await prisma.payment.create({
      data: {
        bookingId,
        customerId: booking.customerId,
        amount,
        method,
        status: status || "PAID",
        paidAt: status === "PAID" ? new Date() : null,
      },
    });

    await logActivity({
      userId: session.user.id,
      action: "CREATE",
      entity: "Payment",
      entityId: payment.id,
      details: `Payment of ${amount} for booking ${booking.referenceNumber}`,
    });

    return NextResponse.json(payment, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to create payment" }, { status: 500 });
  }
}
