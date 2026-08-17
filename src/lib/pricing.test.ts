import assert from "node:assert/strict";
import test from "node:test";
import { computeBookingPrice, DEFAULT_PRICE_SETTINGS } from "./pricing";

test("discount is capped at the gross price", () => {
  const result = computeBookingPrice({
    luggageLines: [{ type: "Small Bag", qty: 1 }],
    services: [],
    discount: 1_000_000,
    settings: DEFAULT_PRICE_SETTINGS,
  });
  assert.equal(result.totalPrice, 0);
  assert.equal(result.discount, result.subtotal + result.extraFee + result.servicesCost);
});

test("negative quantities and discounts cannot reduce the price", () => {
  const result = computeBookingPrice({
    luggageLines: [{ type: "Small Bag", qty: -4 }],
    services: [],
    discount: -500,
    settings: DEFAULT_PRICE_SETTINGS,
  });
  assert.equal(result.totalBags, 0);
  assert.equal(result.totalPrice, 0);
  assert.equal(result.discount, 0);
});
