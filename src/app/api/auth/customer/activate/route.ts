import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { setCustomerCookie, signCustomerToken } from "@/lib/customer-auth";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (typeof body?.token !== "string" || body.token.length < 32) return NextResponse.json({ error: "Invalid activation token" }, { status: 400 });
  const tokenHash = crypto.createHash("sha256").update(body.token).digest("hex");
  const pending = await prisma.customerActivationToken.findUnique({ where: { tokenHash } });
  if (!pending || pending.expiresAt <= new Date()) {
    if (pending) await prisma.customerActivationToken.delete({ where: { id: pending.id } });
    return NextResponse.json({ error: "Activation link is invalid or expired" }, { status: 400 });
  }

  const customer = await prisma.$transaction(async (tx) => {
    const updated = await tx.customer.update({
      where: { id: pending.customerId },
      data: {
        password: pending.passwordHash,
        name: pending.pendingName,
        phone: pending.pendingPhone,
        emailVerifiedAt: new Date(),
        isActive: true,
        authVersion: { increment: 1 },
      },
    });
    await tx.customerActivationToken.deleteMany({ where: { customerId: pending.customerId } });
    return updated;
  });
  const token = await signCustomerToken({ id: customer.id, email: customer.email, name: customer.name, authVersion: customer.authVersion });
  await setCustomerCookie(token);
  return NextResponse.json({ success: true });
}
