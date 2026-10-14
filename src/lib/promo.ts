import type { PromoCode } from "@/generated/prisma/client";

export function calculatePromoDiscount(promo: PromoCode, amount: number, now = new Date()) {
  if (!promo.isActive) throw new Error("This promo code is inactive");
  if (promo.usedCount >= promo.maxUsage) throw new Error("This promo code has reached its usage limit");
  if (promo.expiresAt && now > promo.expiresAt) throw new Error("This promo code has expired");
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("Add eligible luggage and services before applying a promo code");
  if (amount < Number(promo.minAmount)) throw new Error(`Minimum booking amount of ₱${Number(promo.minAmount).toFixed(2)} required`);
  let discount = promo.type === "PERCENTAGE" ? amount * Number(promo.value) / 100 : Number(promo.value);
  if (promo.maxDiscount != null) discount = Math.min(discount, Number(promo.maxDiscount));
  discount = Math.min(amount, Math.max(0, discount));
  discount = Math.round(discount * 100) / 100;
  if (discount <= 0) throw new Error("This promo code does not provide a discount for this booking");
  return discount;
}
