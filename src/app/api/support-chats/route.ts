import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const threads = await prisma.supportChat.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      _count: { select: { messages: true } },
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  const unread = await prisma.supportChatMessage.groupBy({
    by: ["supportChatId"],
    where: { isFromCustomer: true, isRead: false },
    _count: { _all: true },
  });
  const unreadMap = new Map(unread.map((u) => [u.supportChatId, u._count._all]));

  return NextResponse.json(
    threads.map((t) => ({
      id: t.id,
      customerName: t.customerName || "Anonymous",
      status: t.status,
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
      messageCount: t._count.messages,
      unreadCustomerCount: unreadMap.get(t.id) || 0,
      lastMessage: t.messages[0]
        ? {
            message: t.messages[0].message,
            createdAt: t.messages[0].createdAt.toISOString(),
            isFromCustomer: t.messages[0].isFromCustomer,
          }
        : null,
    }))
  );
}