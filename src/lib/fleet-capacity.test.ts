import assert from "node:assert/strict";
import test from "node:test";

import { fleetCapacity, movementsOverlappingSlot } from "./fleet-capacity";

test("fleet inventory is the shared logistics capacity", () => {
  assert.equal(fleetCapacity({ fleet_data: JSON.stringify([{ count: 1 }]), max_concurrent_pickups: "5", max_concurrent_deliveries: "5" }), 1);
  // Empty fleet_data falls back to legacy concurrency so stale "[]" doesn't block all bookings
  assert.equal(fleetCapacity({ fleet_data: "[]", max_concurrent_pickups: "5", max_concurrent_deliveries: "3" }), 3);
  assert.equal(fleetCapacity({ fleet_data: "[]", max_concurrent_pickups: "2", max_concurrent_deliveries: "2" }), 2);
  assert.equal(fleetCapacity({ fleet_data: "[]"}), 1);
});

test("pickup and delivery movements compete for the same overlapping slot", () => {
  const movements = [
    { startMinutes: 9 * 60, durationMinutes: 60 },
    { startMinutes: 9 * 60 + 30, durationMinutes: 60 },
  ];
  assert.equal(movementsOverlappingSlot(9 * 60, 60, movements), 2);
  assert.equal(movementsOverlappingSlot(10 * 60 + 30, 60, movements), 0);
});
