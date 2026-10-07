import assert from "node:assert/strict";
import test from "node:test";
import { availableLogisticsActions, LOGISTICS_ACTION_STATUS, logisticsTaskType } from "./logistics-workflow";

test("logistics workflow exposes only valid sequential actions", () => {
  assert.deepEqual(availableLogisticsActions("CONFIRMED", false), ["start-pickup"]);
  assert.deepEqual(availableLogisticsActions("CONFIRMED", true), ["arrive-pickup"]);
  assert.deepEqual(availableLogisticsActions("CONFIRMED", true, false, true), []);
  assert.deepEqual(availableLogisticsActions("RECEIVED", true), ["complete-pickup"]);
  assert.deepEqual(availableLogisticsActions("RECEIVED", false, false, true, true), []);
  assert.deepEqual(availableLogisticsActions("IN_STORAGE", false), ["start-delivery"]);
  assert.deepEqual(availableLogisticsActions("OUT_FOR_DELIVERY", true), ["arrive-delivery"]);
  assert.deepEqual(availableLogisticsActions("OUT_FOR_DELIVERY", true, true), ["complete-delivery"]);
  assert.deepEqual(availableLogisticsActions("DELIVERED", false), []);
});

test("received bookings stay in pickup and stored bookings move to delivery", () => {
  assert.equal(LOGISTICS_ACTION_STATUS["complete-pickup"], "RECEIVED");
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

test("duplicate services are charged and matched once", async () => {
  const { parseLuggageDetails, computeBookingPrice, DEFAULT_PRICE_SETTINGS } = await import("./pricing");
  const raw = JSON.stringify([{ type: "Small", qty: 1 }, { services: ["Pick-up from Customer", "Pick-up from Customer"] }]);
  const parsed = parseLuggageDetails(raw);
  assert.deepEqual(parsed.services, ["Pick-up from Customer"]);
  const price = computeBookingPrice({ luggageLines: parsed.luggageLines, services: parsed.services, discount: 0, settings: DEFAULT_PRICE_SETTINGS });
  assert.equal(price.servicesCost, DEFAULT_PRICE_SETTINGS.pickupFee);
});

test("a finished earlier phase is not shown as upcoming", async () => {
  const { resolveTaskAssignment } = await import("./logistics-workflow");
  const a = [{ userId: "p", phase: "PICKUP" }, { userId: "d", phase: "DROPOFF" }];
  assert.equal(resolveTaskAssignment(a, "IN_STORAGE", "p", false).isUpcoming, false);
  assert.equal(resolveTaskAssignment(a, "OUT_FOR_DELIVERY", "p", false).isUpcoming, false);
  assert.equal(resolveTaskAssignment(a, "RECEIVED", "d", false).isUpcoming, true);
});

test("task date filter covers today, week (Mon-Sun), month and all", async () => {
  const { matchesTaskDateFilter, taskDay } = await import("./task-date-filter");
  const today = "2026-10-07"; // Wednesday
  assert.equal(matchesTaskDateFilter("2026-10-07", "today", today), true);
  assert.equal(matchesTaskDateFilter("2026-10-08", "today", today), false);
  assert.equal(matchesTaskDateFilter("2026-10-05", "week", today), true); // Monday
  assert.equal(matchesTaskDateFilter("2026-10-11", "week", today), true); // Sunday
  assert.equal(matchesTaskDateFilter("2026-10-04", "week", today), false);
  assert.equal(matchesTaskDateFilter("2026-10-12", "week", today), false);
  assert.equal(matchesTaskDateFilter("2026-10-31", "month", today), true);
  assert.equal(matchesTaskDateFilter("2026-11-01", "month", today), false);
  assert.equal(matchesTaskDateFilter("2020-01-01", "all", today), true);
  const t = { checkIn: "2026-10-07T01:00:00+08:00", checkOut: "2026-10-09T10:00:00+08:00", createdAt: "2026-10-01T00:00:00Z" };
  assert.equal(taskDay({ ...t, taskType: "pickup" }), "2026-10-07");
  assert.equal(taskDay({ ...t, taskType: "delivery" }), "2026-10-09");
});

test("self-pickup is detected from the booking services", async () => {
  const { isSelfPickup, bookingStatusLabel } = await import("./booking-services");
  assert.equal(isSelfPickup(JSON.stringify([{ type: "Small", qty: 1 }, { services: ["Pick-up from Customer"] }])), true);
  assert.equal(isSelfPickup(JSON.stringify([{ type: "Small", qty: 1 }, { services: ["Deliver to Customer"] }])), false);
  assert.equal(isSelfPickup(null), true);
  assert.equal(bookingStatusLabel("DELIVERED", true), "Claimed by Customer");
  assert.equal(bookingStatusLabel("OUT_FOR_DELIVERY"), "Out For Delivery");
});
