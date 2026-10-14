import test from "node:test";
import assert from "node:assert/strict";
import type { PromoCode } from "@/generated/prisma/client";
import { calculatePromoDiscount } from "./promo";

function promo(overrides: Partial<PromoCode> = {}) {
  return {
    id: "promo-1", code: "SAVE", description: null, type: "PERCENTAGE", value: 20,
    maxUsage: 10, usedCount: 0, minAmount: 100, maxDiscount: 50, expiresAt: null,
    isActive: true, createdAt: new Date(), updatedAt: new Date(),
    ...overrides,
  } as PromoCode;
}

test("promo discount uses the server amount, caps discount, and rounds cents", () => {
  assert.equal(calculatePromoDiscount(promo(), 499.99), 50);
  assert.equal(calculatePromoDiscount(promo({ maxDiscount: null }), 101), 20.2);
});

test("promo rejects inactive, expired, exhausted, under-minimum, and empty orders", () => {
  const now = new Date("2026-01-01T00:00:00Z");
  assert.throws(() => calculatePromoDiscount(promo({ isActive: false }), 200, now), /inactive/);
  assert.throws(() => calculatePromoDiscount(promo({ expiresAt: new Date("2025-12-31T23:59:59Z") }), 200, now), /expired/);
  assert.throws(() => calculatePromoDiscount(promo({ usedCount: 10 }), 200, now), /usage limit/);
  assert.throws(() => calculatePromoDiscount(promo(), 99.99, now), /Minimum/);
  assert.throws(() => calculatePromoDiscount(promo(), 0, now), /Add eligible/);
});
