import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { rateLimit, requestKey } from "@/lib/rate-limit";

export async function POST(req: Request) {
  const key = requestKey(req);
  const { allowed, retryAfter } = await rateLimit(`promo-validate:${key}`, 10, 15 * 60 * 1000);
  if (!allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": String(retryAfter) } });
  }
  try {
    const { code, amount } = await req.json();

    if (!code) {
      return NextResponse.json({ error: "Promo code is required" }, { status: 400 });
    }

    const promo = await prisma.promoCode.findUnique({ where: { code: code.toUpperCase() } });

    if (!promo || !promo.isActive || promo.usedCount >= promo.maxUsage || (promo.expiresAt && new Date() > promo.expiresAt)) {
      return NextResponse.json({ error: "Invalid or unavailable code" }, { status: 400 });
    }

    if (amount != null && amount < Number(promo.minAmount)) {
      return NextResponse.json({ error: `Minimum amount of ${promo.minAmount} required` }, { status: 400 });
    }

    let discount = 0;
    if (promo.type === "PERCENTAGE") {
      discount = (amount || 0) * (Number(promo.value) / 100);
      if (promo.maxDiscount) {
        discount = Math.min(discount, Number(promo.maxDiscount));
      }
    } else {
      discount = Number(promo.value);
    }

    return NextResponse.json({
      valid: true,
      promoCodeId: promo.id,
      code: promo.code,
      discount,
      type: promo.type,
      value: Number(promo.value),
      description: promo.description,
    });
  } catch {
    return NextResponse.json({ error: "Failed to validate promo code" }, { status: 500 });
  }
}
