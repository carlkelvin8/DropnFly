import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { rateLimit, requestKey } from "@/lib/rate-limit";
import { sendCustomerActivationEmail } from "@/lib/email";
import crypto from "node:crypto";

export async function POST(req: Request) {
  const limited = await rateLimit(`register:${requestKey(req)}`, 5, 15 * 60 * 1000);
  if (!limited.allowed) return NextResponse.json({ error: "Too many registration attempts" }, { status: 429, headers: { "Retry-After": String(limited.retryAfter) } });
  try {
    const { name, email, phone, password } = await req.json();

    if (!name || !email || !phone || !password) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    if (typeof email !== "string" || !/^\S+@\S+\.\S+$/.test(email) || typeof password !== "string" || password.length < 10 || password.length > 128) {
      return NextResponse.json({ error: "Enter a valid email and a password between 10 and 128 characters" }, { status: 400 });
    }
    const normalizedEmail = email.trim().toLowerCase();

    const existing = await prisma.customer.findUnique({ where: { email: normalizedEmail } });

    const hashedPassword = await bcrypt.hash(password, 12);
    if (existing?.password && existing.emailVerifiedAt) {
      return NextResponse.json({ error: "Email already registered" }, { status: 409 });
    }

    const customer = existing || await prisma.customer.create({
      data: { name: String(name).trim().slice(0, 120), email: normalizedEmail, phone: String(phone).trim().slice(0, 40) },
    });
    const rawToken = crypto.randomBytes(32).toString("base64url");
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    await prisma.$transaction([
      prisma.customerActivationToken.deleteMany({ where: { customerId: customer.id } }),
      prisma.customerActivationToken.create({
        data: {
          customerId: customer.id,
          tokenHash,
          passwordHash: hashedPassword,
          pendingName: String(name).trim().slice(0, 120),
          pendingPhone: String(phone).trim().slice(0, 40),
          expiresAt: new Date(Date.now() + 30 * 60 * 1000),
        },
      }),
    ]);
    await sendCustomerActivationEmail({ to: normalizedEmail, customerName: String(name), token: rawToken });
    return NextResponse.json({ success: true, requiresVerification: true }, { status: 202 });
  } catch (error) {
    console.error("Customer register error:", error);
    return NextResponse.json({ error: "Failed to register" }, { status: 500 });
  }
}
