import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });

  const allowed = await prisma.booking.findFirst({ where: { id, ...(session.user.role === "EMPLOYEE" ? { assignments: { some: { userId: session.user.id } } } : {}) }, select: { id: true } });
  if (!allowed) return new NextResponse("Forbidden", { status: 403 });

  const messages = await prisma.chatMessage.findMany({
    where: { bookingId: id },
    orderBy: { createdAt: "asc" },
    include: { sender: { select: { id: true, name: true, role: true } } },
  });

  await prisma.chatMessage.updateMany({
    where: { bookingId: id, isFromCustomer: true, isRead: false },
    data: { isRead: true },
  });

  return NextResponse.json(messages);
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });

  const allowed = await prisma.booking.findFirst({ where: { id, ...(session.user.role === "EMPLOYEE" ? { assignments: { some: { userId: session.user.id } } } : {}) }, select: { id: true } });
  if (!allowed) return new NextResponse("Forbidden", { status: 403 });

  const { message } = await req.json();
  if (typeof message !== "string" || !message.trim() || message.length > 2000) return new NextResponse("Message must be between 1 and 2000 characters", { status: 400 });

  const msg = await prisma.chatMessage.create({
    data: { bookingId: id, senderId: session.user.id, message: message.trim(), isFromCustomer: false },
    include: { sender: { select: { id: true, name: true, role: true } } },
  });

  return NextResponse.json(msg, { status: 201 });
}
