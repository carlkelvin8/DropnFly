import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const { email } = await req.json();
    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return NextResponse.json({
        message: "If that email exists, a reset link has been generated",
        resetUrl: null,
        note: null,
      });
    }

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await prisma.passwordResetToken.create({
      data: { email, token, expiresAt },
    });

    const resetUrl = `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/reset-password?token=${token}`;

    return NextResponse.json({
      message: "Reset link generated",
      resetUrl,
      note: "In production, this would be emailed. For now, use the link below.",
    });
  } catch {
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
