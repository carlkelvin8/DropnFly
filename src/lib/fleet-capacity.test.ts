import assert from "node:assert/strict";
import test from "node:test";

import { fleetCapacity, movementsOverlappingSlot } from "./fleet-capacity";

test("fleet inventory is the shared logistics capacity", () => {
  assert.equal(fleetCapacity({ fleet_data: JSON.stringify([{ count: 1 }]), max_concurrent_pickups: "5", max_concurrent_deliveries: "5" }), 1);
  assert.equal(fleetCapacity({ fleet_data: "[]" }), 0);
});

test("pickup and delivery movements compete for the same overlapping slot", () => {
  const movements = [
    { startMinutes: 9 * 60, durationMinutes: 60 },
    { startMinutes: 9 * 60 + 30, durationMinutes: 60 },
  ];
  assert.equal(movementsOverlappingSlot(9 * 60, 60, movements), 2);
  assert.equal(movementsOverlappingSlot(10 * 60 + 30, 60, movements), 0);
});
