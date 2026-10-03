import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import crypto from "node:crypto";
import { sendPasswordChangedEmail } from "@/lib/email";
import { rateLimit, requestKey } from "@/lib/rate-limit";

export async function POST(req: Request) {
  try {
    const limited = await rateLimit(`reset-password:${requestKey(req)}`, 5, 15 * 60 * 1000);
    if (!limited.allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": String(limited.retryAfter) } });
    const { token, email, password } = await req.json();

    if (typeof token !== "string" || typeof email !== "string" || typeof password !== "string" || password.length < 10 || password.length > 128) {
      return NextResponse.json({ error: "Email, token, and a password between 10 and 128 characters are required" }, { status: 400 });
    }

    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { tokenHash },
    });

    if (!resetToken || resetToken.expiresAt < new Date()) {
      return NextResponse.json({ error: "Invalid or expired reset token" }, { status: 400 });
    }
    if (resetToken.email !== email.trim().toLowerCase()) {
      return NextResponse.json({ error: "The email does not match this reset request" }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    await prisma.$transaction([
      prisma.user.update({ where: { email: resetToken.email }, data: { password: hashedPassword, passwordChangedAt: new Date(), authVersion: { increment: 1 } } }),
      prisma.passwordResetToken.deleteMany({ where: { tokenHash } }),
    ]);

    await sendPasswordChangedEmail({ to: resetToken.email }).catch(() => {});

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
