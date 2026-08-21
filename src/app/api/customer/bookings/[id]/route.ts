import { NextResponse } from "next/server";
import { getCustomerSession } from "@/lib/customer-auth";
import { prisma } from "@/lib/prisma";
import { notifyBookingCancelled } from "@/lib/notifications";
import { decimalsToNumbers } from "@/lib/serialize";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getCustomerSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;
  const booking = await prisma.booking.findFirst({
    where: { id, customerId: session.id },
    include: {
      location: true,
      payments: true,
      extensions: { orderBy: { requestedAt: "desc" } },
      customer: { select: { name: true, email: true, phone: true, countryOfOrigin: true, cityOfOrigin: true } },
      assignments: { include: { user: { select: { name: true, vehicleType: true, plateNumber: true } } } },
      luggageItems: { select: { id: true, tagNumber: true, description: true, status: true } },
    },
  });

  if (!booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  return NextResponse.json(decimalsToNumbers(booking));
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getCustomerSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();

  const booking = await prisma.booking.findFirst({
    where: { id, customerId: session.id },
    include: { customer: { select: { name: true } } },
  });

  if (!booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  if (body.action === "cancel") {
    if (!["PENDING", "CONFIRMED"].includes(booking.status)) {
      return NextResponse.json({ error: "Cannot cancel booking at current status" }, { status: 400 });
    }

    const paidPayments = await prisma.payment.findMany({
      where: { bookingId: id, status: "PAID", refundedAt: null },
    });

    await prisma.$transaction([
      prisma.booking.update({
        where: { id },
        data: { status: "CANCELLED" },
      }),
      prisma.payment.updateMany({
        where: { bookingId: id, status: "PENDING" },
        data: { status: "FAILED" },
      }),
      ...paidPayments.map((p) =>
        prisma.payment.update({
          where: { id: p.id },
          data: { status: "REFUNDED", refundedAt: new Date() },
        })
      ),
      ...paidPayments.map((p) =>
        prisma.payment.create({
          data: {
            bookingId: id,
            customerId: booking.customerId,
            amount: -Math.abs(Number(p.amount)),
            method: p.method,
            status: "REFUNDED",
            reference: `RFND-${booking.referenceNumber}-${Date.now().toString(36).toUpperCase()}`,
            paidAt: new Date(),
            refundedAt: new Date(),
          },
        })
      ),
    ]);

    const staff = await prisma.user.findMany({
      where: { role: { in: ["ADMIN", "STAFF"] }, isActive: true },
      select: { id: true },
    });
    await notifyBookingCancelled(staff.map((u) => u.id), booking.referenceNumber, booking.customer.name);

    return NextResponse.json({
      success: true,
      message: paidPayments.length > 0 ? "Booking cancelled and payment refunded" : "Booking cancelled",
    });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
