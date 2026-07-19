import { NextResponse } from "next/server";
import { getCustomerSession } from "@/lib/customer-auth";
import { prisma } from "@/lib/prisma";

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
      customer: { select: { name: true, email: true, phone: true, countryOfOrigin: true, cityOfOrigin: true } },
      assignments: { include: { user: { select: { name: true } } } },
      luggageItems: { select: { id: true, tagNumber: true, description: true, status: true } },
    },
  });

  if (!booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  return NextResponse.json(booking);
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
  });

  if (!booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  if (body.action === "cancel") {
    if (!["PENDING", "CONFIRMED"].includes(booking.status)) {
      return NextResponse.json({ error: "Cannot cancel booking at current status" }, { status: 400 });
    }

    await prisma.booking.update({
      where: { id },
      data: { status: "CANCELLED" },
    });

    return NextResponse.json({ success: true, message: "Booking cancelled" });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
