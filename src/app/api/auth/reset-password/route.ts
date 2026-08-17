import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import crypto from "node:crypto";

export async function POST(req: Request) {
  try {
    const { token, password } = await req.json();

    if (typeof token !== "string" || typeof password !== "string" || password.length < 10 || password.length > 128) {
      return NextResponse.json({ error: "Password must be between 10 and 128 characters" }, { status: 400 });
    }

    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { token: tokenHash },
    });

    if (!resetToken || resetToken.expiresAt < new Date()) {
      return NextResponse.json({ error: "Invalid or expired reset token" }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    await prisma.$transaction([
      prisma.user.update({ where: { email: resetToken.email }, data: { password: hashedPassword, passwordChangedAt: new Date(), authVersion: { increment: 1 } } }),
      prisma.passwordResetToken.deleteMany({ where: { email: resetToken.email } }),
    ]);

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
