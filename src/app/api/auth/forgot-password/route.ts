import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { sendPasswordResetEmail } from "@/lib/email";
import { rateLimit, requestKey } from "@/lib/rate-limit";

export async function POST(req: Request) {
  const limited = await rateLimit(`forgot-password:${requestKey(req)}`, 5, 15 * 60 * 1000);
  if (!limited.allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": String(limited.retryAfter) } });
  try {
    const { email } = await req.json();
    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (!user) {
      return NextResponse.json({ message: "If that email exists, a reset link has been sent" });
    }

    const token = crypto.randomBytes(32).toString("base64url");
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await prisma.$transaction([
      prisma.passwordResetToken.deleteMany({ where: { email: normalizedEmail } }),
      prisma.passwordResetToken.create({ data: { email: normalizedEmail, token: tokenHash, expiresAt } }),
    ]);
    await sendPasswordResetEmail({ to: normalizedEmail, token }).catch((error) => {
      if (process.env.NODE_ENV === "development") {
        console.error("Password reset email delivery failed", error);
      }
    });
    return NextResponse.json({ message: "If that email exists, a reset link has been sent" });
  } catch {
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
