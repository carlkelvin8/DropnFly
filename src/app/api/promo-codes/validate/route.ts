import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { rateLimit, requestKey } from "@/lib/rate-limit";
import { getSystemSettings, setting } from "@/lib/settings";
import { getBookingPriceSettings, computeBookingPrice, parseLuggageDetails } from "@/lib/pricing";
import { calculatePromoDiscount } from "@/lib/promo";

export async function POST(req: Request) {
  const key = requestKey(req);
  const { allowed, retryAfter } = await rateLimit(`promo-validate:${key}`, 10, 15 * 60 * 1000);
  if (!allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": String(retryAfter) } });
  }
  try {
    const settings = await getSystemSettings();
    if (setting(settings, "discount_codes_enabled", "true") === "false") {
      return NextResponse.json({ error: "Discount codes are currently disabled" }, { status: 403 });
    }
    const { code, luggageDetails, storageDays, customerEmail } = await req.json();

    if (!code || typeof code !== "string") {
      return NextResponse.json({ error: "Promo code is required" }, { status: 400 });
    }

    const normalizedCode = code.trim().toUpperCase();
    const promo = await prisma.promoCode.findUnique({ where: { code: normalizedCode } });
    if (!promo) return NextResponse.json({ error: "Promo code not found" }, { status: 400 });
    const normalizedEmail = typeof customerEmail === "string" ? customerEmail.trim().toLowerCase() : "";
    if (promo.maxUsesPerCustomer != null && normalizedEmail) {
      const customerUses = await prisma.booking.count({
        where: {
          promoCodeId: promo.id,
          OR: [
            { customerEmailSnapshot: normalizedEmail },
            { customer: { email: normalizedEmail } },
          ],
        },
      });
      if (customerUses >= promo.maxUsesPerCustomer) {
        return NextResponse.json({ error: "Promo code has reached its usage limit for this customer" }, { status: 400 });
      }
    }
    const [priceSettings] = await Promise.all([getBookingPriceSettings()]);
    const parsed = parseLuggageDetails(typeof luggageDetails === "string" ? luggageDetails : "");
    const pricing = computeBookingPrice({ luggageLines: parsed.luggageLines, services: parsed.services, discount: 0, settings: priceSettings, storageDays: Math.max(1, Math.min(365, Number(storageDays) || 1)) });
    let discount: number;
    try { discount = calculatePromoDiscount(promo, pricing.totalPrice); }
    catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Promo code is not eligible" }, { status: 400 }); }

    return NextResponse.json({
      valid: true,
      promoCodeId: promo.id,
      code: promo.code,
      discount,
      total: Math.max(0, Math.round((pricing.totalPrice - discount) * 100) / 100),
      type: promo.type,
      value: Number(promo.value),
      description: promo.description,
    });
  } catch {
    return NextResponse.json({ error: "Failed to validate promo code" }, { status: 500 });
  }
}
