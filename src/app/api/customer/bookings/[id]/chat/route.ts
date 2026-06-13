import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCustomerSession } from "@/lib/customer-auth";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const customer = await getCustomerSession();
  if (!customer) return new NextResponse("Unauthorized", { status: 401 });

  const booking = await prisma.booking.findUnique({ where: { id } });
  if (!booking || booking.customerId !== customer.id) return new NextResponse("Forbidden", { status: 403 });

  const messages = await prisma.chatMessage.findMany({
    where: { bookingId: id },
    orderBy: { createdAt: "asc" },
  });

  await prisma.chatMessage.updateMany({
    where: { bookingId: id, isFromCustomer: false, isRead: false },
    data: { isRead: true },
  });

  return NextResponse.json(messages);
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const customer = await getCustomerSession();
  if (!customer) return new NextResponse("Unauthorized", { status: 401 });

  const booking = await prisma.booking.findUnique({ where: { id } });
  if (!booking || booking.customerId !== customer.id) return new NextResponse("Forbidden", { status: 403 });

  const { message } = await req.json();
  if (!message?.trim()) return new NextResponse("Message is required", { status: 400 });

  const msg = await prisma.chatMessage.create({
    data: { bookingId: id, customerId: customer.id, message, isFromCustomer: true },
  });

  return NextResponse.json(msg, { status: 201 });
}
