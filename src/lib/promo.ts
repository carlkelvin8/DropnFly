import type { PromoCode } from "@/generated/prisma/client";
import type { Prisma } from "@/generated/prisma/client";

export class PromoCustomerUsageLimitError extends Error {}

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

/** Atomically claim an overall promo use and enforce the optional customer cap.
 * Callers serialize by promo id before invoking this inside their transaction. */
export async function claimPromoCodeUsage(
  tx: Prisma.TransactionClient,
  input: { promoCodeId: string; customerId: string; customerEmail: string },
) {
  const promo = await tx.promoCode.findUnique({
    where: { id: input.promoCodeId },
    select: { maxUsage: true, maxUsesPerCustomer: true },
  });
  if (!promo) throw new Error("Promo code is no longer available");

  if (promo.maxUsesPerCustomer != null) {
    const customerUses = await tx.booking.count({
      where: {
        promoCodeId: input.promoCodeId,
        OR: [
          { customerId: input.customerId },
          { customerEmailSnapshot: input.customerEmail },
        ],
      },
    });
    if (customerUses >= promo.maxUsesPerCustomer) {
      throw new PromoCustomerUsageLimitError("Promo code has reached its usage limit for this customer");
    }
  }

  const claimed = await tx.promoCode.updateMany({
    where: {
      id: input.promoCodeId,
      isActive: true,
      usedCount: { lt: promo.maxUsage },
      OR: [{ expiresAt: null }, { expiresAt: { gte: new Date() } }],
    },
    data: { usedCount: { increment: 1 } },
  });
  if (claimed.count !== 1) throw new Error("Promo code is no longer available");
}
