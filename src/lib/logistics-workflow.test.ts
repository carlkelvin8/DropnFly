import assert from "node:assert/strict";
import test from "node:test";
import { availableLogisticsActions, logisticsTaskType } from "./logistics-workflow";

test("logistics workflow exposes only valid sequential actions", () => {
  assert.deepEqual(availableLogisticsActions("CONFIRMED", false), ["start-pickup"]);
  assert.deepEqual(availableLogisticsActions("CONFIRMED", true), ["arrive-pickup"]);
  assert.deepEqual(availableLogisticsActions("CONFIRMED", true, false, true), []);
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

test("employee assigned to a later phase sees an upcoming task", async () => {
  const { resolveTaskAssignment } = await import("./logistics-workflow");
  const a = [{ userId: "p", phase: "PICKUP" }, { userId: "d", phase: "DROPOFF" }];
  assert.deepEqual(resolveTaskAssignment(a, "CONFIRMED", "d", false), { assignment: a[1], taskType: "delivery", isUpcoming: true });
  assert.deepEqual(resolveTaskAssignment(a, "CONFIRMED", "p", false), { assignment: a[0], taskType: "pickup", isUpcoming: false });
  assert.deepEqual(resolveTaskAssignment(a, "IN_STORAGE", "d", false), { assignment: a[1], taskType: "delivery", isUpcoming: false });
  assert.equal(resolveTaskAssignment(a, "CONFIRMED", "d", true).assignment, a[0]);
  assert.equal(resolveTaskAssignment(a, "CONFIRMED", "x", false).isUpcoming, false);
});

test("entering a new phase clears leftover tracking state", async () => {
  const { trackingResetForStatus } = await import("./logistics-workflow");
  assert.deepEqual(trackingResetForStatus("IN_STORAGE"), { pickupStartedAt: null, deliveryArrivedAt: null });
  assert.deepEqual(trackingResetForStatus("OUT_FOR_DELIVERY"), { pickupStartedAt: null, deliveryArrivedAt: null });
  assert.deepEqual(trackingResetForStatus("RECEIVED"), {});
});
