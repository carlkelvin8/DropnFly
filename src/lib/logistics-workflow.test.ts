import assert from "node:assert/strict";
import test from "node:test";
import { availableLogisticsActions, logisticsTaskType } from "./logistics-workflow";

test("logistics workflow exposes only valid sequential actions", () => {
  assert.deepEqual(availableLogisticsActions("CONFIRMED", false), ["start-pickup"]);
  assert.deepEqual(availableLogisticsActions("CONFIRMED", true), ["arrive-pickup"]);
  assert.deepEqual(availableLogisticsActions("RECEIVED", true), ["complete-pickup"]);
  assert.deepEqual(availableLogisticsActions("IN_STORAGE", false), ["start-delivery"]);
  assert.deepEqual(availableLogisticsActions("OUT_FOR_DELIVERY", true), ["arrive-delivery"]);
  assert.deepEqual(availableLogisticsActions("OUT_FOR_DELIVERY", true, true), ["complete-delivery"]);
  assert.deepEqual(availableLogisticsActions("DELIVERED", false), []);
});

test("received bookings stay in pickup and stored bookings move to delivery", () => {
  assert.equal(logisticsTaskType("RECEIVED"), "pickup");
  assert.equal(logisticsTaskType("IN_STORAGE"), "delivery");
});
