import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getCustomerSession } from "@/lib/customer-auth";
import { canReadBooking } from "@/lib/staff-access";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const customer = await getCustomerSession();
  if (!session?.user && !customer) return new NextResponse("Unauthorized", { status: 401 });

  if (customer && !session?.user) {
    const owned = await prisma.booking.findFirst({ where: { id, customerId: customer.id }, select: { id: true } });
    if (!owned) return new NextResponse("Forbidden", { status: 403 });
  }
  if (session?.user && !(await canReadBooking(session.user, id))) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const extensions = await prisma.bookingExtension.findMany({
    where: { bookingId: id },
    include: { reviewedBy: { select: { name: true } } },
    orderBy: { requestedAt: "desc" },
  });

  return NextResponse.json(extensions);
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const customer = await getCustomerSession();
  if (!customer) return new NextResponse("Unauthorized", { status: 401 });

  const booking = await prisma.booking.findUnique({ where: { id } });
  if (!booking) return new NextResponse("Booking not found", { status: 404 });
  if (booking.customerId !== customer.id) return new NextResponse("Forbidden", { status: 403 });
  if (booking.status === "CANCELLED" || booking.status === "DELIVERED")
    return new NextResponse("Cannot extend this booking", { status: 400 });

  const body = await req.json();
  const requestedCheckOut = new Date(body.requestedCheckOut);
  if (isNaN(requestedCheckOut.getTime())) return new NextResponse("Invalid date", { status: 400 });
  if (requestedCheckOut <= new Date()) return new NextResponse("Date must be in the future", { status: 400 });

  const extension = await prisma.bookingExtension.create({
    data: { bookingId: id, requestedCheckOut, reason: body.reason || null },
  });

  return NextResponse.json(extension, { status: 201 });
}
