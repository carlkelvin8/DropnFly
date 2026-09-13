import assert from "node:assert/strict";
import test from "node:test";

import { fleetCapacity, movementsOverlappingSlot, nearestAvailableSlots, FLEET_SLOT_MINUTES } from "./fleet-capacity";

test("fleet inventory is the shared logistics capacity", () => {
  assert.equal(fleetCapacity({ fleet_data: JSON.stringify([{ count: 1 }]), max_concurrent_pickups: "5", max_concurrent_deliveries: "5" }), 1);
  assert.equal(fleetCapacity({ fleet_data: "[]", max_concurrent_pickups: "5", max_concurrent_deliveries: "3" }), 0);
  assert.equal(fleetCapacity({ fleet_data: "invalid" }), 0);
  assert.equal(fleetCapacity({}), 0);
});

test("two vehicles admit two movements, reject the third; registering a third increases capacity", () => {
  const bookings = [{ startMinutes: 20 * 60, durationMinutes: 60 }, { startMinutes: 20 * 60, durationMinutes: 60 }];
  const used = movementsOverlappingSlot(20 * 60, FLEET_SLOT_MINUTES, bookings);
  assert.equal(used < fleetCapacity({ fleet_data: '[{"count":2}]' }), false);
  assert.equal(used < fleetCapacity({ fleet_data: '[{"count":3}]' }), true);
  assert.equal(movementsOverlappingSlot(19 * 60, 60, bookings), 0);
  assert.equal(movementsOverlappingSlot(21 * 60, 60, bookings), 0);
});

test("full 8 PM slot recommends 7 PM and 9 PM, never past/full slots", () => {
  const slots = [
    { start: "18:00", available: true },
    { start: "19:00", available: true },
    { start: "20:00", available: false },
    { start: "21:00", available: true },
    { start: "22:00", available: true },
  ];
  assert.deepEqual(nearestAvailableSlots(slots, "20:00").map((slot) => slot.start), ["19:00", "21:00"]);
  assert.deepEqual(nearestAvailableSlots(slots.map((slot) => ({ ...slot, available: false })), "20:00"), []);
});

test("pickup and delivery movements compete for the same overlapping slot", () => {
  const movements = [
    { startMinutes: 9 * 60, durationMinutes: 60 },
    { startMinutes: 9 * 60 + 30, durationMinutes: 60 },
  ];
  assert.equal(movementsOverlappingSlot(9 * 60, 60, movements), 2);
  assert.equal(movementsOverlappingSlot(10 * 60 + 30, 60, movements), 0);
  assert.equal(movementsOverlappingSlot(0, 60, [{ startMinutes: -30, durationMinutes: 60 }]), 1);
});
