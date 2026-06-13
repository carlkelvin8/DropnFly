import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const { code, amount } = await req.json();

    if (!code) {
      return NextResponse.json({ error: "Promo code is required" }, { status: 400 });
    }

    const promo = await prisma.promoCode.findUnique({ where: { code: code.toUpperCase() } });

    if (!promo) {
      return NextResponse.json({ error: "Invalid promo code" }, { status: 404 });
    }

    if (!promo.isActive) {
      return NextResponse.json({ error: "Promo code is inactive" }, { status: 400 });
    }

    if (promo.usedCount >= promo.maxUsage) {
      return NextResponse.json({ error: "Promo code has reached maximum usage" }, { status: 400 });
    }

    if (promo.expiresAt && new Date() > promo.expiresAt) {
      return NextResponse.json({ error: "Promo code has expired" }, { status: 400 });
    }

    if (amount != null && amount < promo.minAmount) {
      return NextResponse.json({ error: `Minimum amount of ${promo.minAmount} required` }, { status: 400 });
    }

    let discount = 0;
    if (promo.type === "PERCENTAGE") {
      discount = (amount || 0) * (promo.value / 100);
      if (promo.maxDiscount) {
        discount = Math.min(discount, promo.maxDiscount);
      }
    } else {
      discount = promo.value;
    }

    return NextResponse.json({
      valid: true,
      promoCodeId: promo.id,
      code: promo.code,
      discount,
      type: promo.type,
      value: promo.value,
      description: promo.description,
    });
  } catch {
    return NextResponse.json({ error: "Failed to validate promo code" }, { status: 500 });
  }
}
