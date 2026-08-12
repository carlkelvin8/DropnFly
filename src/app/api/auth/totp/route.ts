import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateSecret, verifyTotp, otpauthURL } from "@/lib/totp";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const { action } = await req.json();

    if (action === "setup") {
      const secret = generateSecret();
      const user = await prisma.user.findUnique({ where: { id: session.user.id } });
      if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
      const url = otpauthURL(secret, user.email);
      const qrDataUrl = await QRCode.toDataURL(url);
      return NextResponse.json({ secret, otpauthUrl: url, qrDataUrl });
    }

    if (action === "confirm") {
      const { secret, code } = await req.json();
      if (!secret || !code || !verifyTotp(secret, code)) {
        return NextResponse.json({ error: "Invalid verification code" }, { status: 400 });
      }
      await prisma.user.update({
        where: { id: session.user.id },
        data: { totpSecret: secret, totpEnabled: true },
      });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "Failed to process request" }, { status: 500 });
  }
}

export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    await prisma.user.update({
      where: { id: session.user.id },
      data: { totpSecret: null, totpEnabled: false },
    });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to disable two-factor authentication" }, { status: 500 });
  }
}
