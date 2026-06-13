import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });

  const messages = await prisma.chatMessage.findMany({
    where: { bookingId: id },
    orderBy: { createdAt: "asc" },
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

  const { message } = await req.json();
  if (!message?.trim()) return new NextResponse("Message is required", { status: 400 });

  const msg = await prisma.chatMessage.create({
    data: { bookingId: id, senderId: session.user.id, message, isFromCustomer: false },
  });

  return NextResponse.json(msg, { status: 201 });
}
