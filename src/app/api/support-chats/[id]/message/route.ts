import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const thread = await prisma.supportChat.findUnique({ where: { id } });
  if (!thread) {
    return NextResponse.json({ error: "Chat not found" }, { status: 404 });
  }
  if (thread.status !== "OPEN") {
    return NextResponse.json({ error: "This chat is closed" }, { status: 400 });
  }

  let body: { message?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message || message.length > 2000) {
    return NextResponse.json({ error: "Message must be between 1 and 2000 characters" }, { status: 400 });
  }

  const created = await prisma.supportChatMessage.create({
    data: {
      supportChatId: id,
      senderId: session.user.id,
      message,
      isFromCustomer: false,
    },
  });

  await prisma.supportChat.update({
    where: { id },
    data: { updatedAt: new Date() },
  });

  return NextResponse.json({ message: created }, { status: 201 });
}