import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });

  const allowed = await prisma.booking.findFirst({ where: { id, ...(session.user.role === "EMPLOYEE" ? { assignments: { some: { userId: session.user.id } } } : {}) }, select: { id: true } });
  if (!allowed) return new NextResponse("Forbidden", { status: 403 });

  const baseQuery = {
    where: { bookingId: id },
    orderBy: { createdAt: "asc" as const },
    include: { sender: { select: { id: true, name: true, role: true } } },
  };

  const url = new URL(req.url);
  const limitParam = url.searchParams.get("limit");

  let messages: Awaited<ReturnType<typeof prisma.chatMessage.findMany>>;
  let total: number | undefined;

  if (limitParam) {
    const limit = Math.min(Math.max(1, parseInt(limitParam, 10) || 25), 100);
    const hasOffset = url.searchParams.has("offset");
    const offset = hasOffset ? Math.max(0, parseInt(url.searchParams.get("offset") || "0", 10) || 0) : null;
    total = await prisma.chatMessage.count({ where: { bookingId: id } });
    const skip = offset === null ? Math.max(0, total - limit) : offset;
    messages = await prisma.chatMessage.findMany({ ...baseQuery, take: limit, skip });
  } else {
    messages = await prisma.chatMessage.findMany(baseQuery);
  }

  // Only mark as read when explicitly requested or when not polling with limit (avoids clearing badge on background poll)
  const shouldMarkRead = url.searchParams.get("markRead") === "true" || !limitParam;
  if (shouldMarkRead) {
    await prisma.chatMessage.updateMany({
      where: { bookingId: id, isFromCustomer: true, isRead: false },
      data: { isRead: true },
    });
  }

  return NextResponse.json(total === undefined ? messages : { messages, total });
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
