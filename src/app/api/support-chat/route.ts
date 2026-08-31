import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { rateLimit, requestKey } from "@/lib/rate-limit";

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;

export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token") || "";
  if (!TOKEN_PATTERN.test(token)) {
    return NextResponse.json({ error: "Invalid session token" }, { status: 400 });
  }

  const thread = await prisma.supportChat.findUnique({
    where: { token },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });

  if (!thread) return NextResponse.json({ thread: null });

  await prisma.supportChatMessage.updateMany({
    where: { supportChatId: thread.id, isFromCustomer: false, isRead: false },
    data: { isRead: true },
  });

  return NextResponse.json({ thread });
}

export async function POST(req: Request) {
  const { allowed, retryAfter } = await rateLimit(`support-chat:${requestKey(req)}`, 15, 60 * 1000);
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many messages. Please wait a moment." },
      { status: 429, headers: { "Retry-After": String(retryAfter) } }
    );
  }

  let body: { token?: unknown; name?: unknown; message?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const token = typeof body.token === "string" ? body.token.trim() : "";
  const message = typeof body.message === "string" ? body.message.trim() : "";
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 120) : "";

  if (!TOKEN_PATTERN.test(token)) {
    return NextResponse.json({ error: "Invalid session token" }, { status: 400 });
  }
  if (!message || message.length > 2000) {
    return NextResponse.json({ error: "Message must be between 1 and 2000 characters" }, { status: 400 });
  }

  const thread = await prisma.supportChat.upsert({
    where: { token },
    update: { ...(name ? { customerName: name } : {}) },
    create: { token, customerName: name || null },
  });

  const created = await prisma.supportChatMessage.create({
    data: { supportChatId: thread.id, message, isFromCustomer: true },
  });

  await prisma.supportChat.update({
    where: { id: thread.id },
    data: { updatedAt: new Date() },
  });

  return NextResponse.json({ thread, message: created }, { status: 201 });
}