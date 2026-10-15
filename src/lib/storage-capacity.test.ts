import test from "node:test";
import assert from "node:assert/strict";
import type { Prisma } from "@/generated/prisma/client";
import { assertStorageCapacity, peakBagsUsed, StorageCapacityError } from "./storage-capacity";

function transaction(bookings: Array<{ checkIn: Date; checkOut: Date | null; numberOfBags: number }>) {
  return { booking: { findMany: async () => bookings } } as unknown as Prisma.TransactionClient;
}

test("storage capacity counts overlapping reservations and allows touching date ranges", async () => {
  const tx = transaction([{ checkIn: new Date("2026-10-15T02:00:00Z"), checkOut: new Date("2026-10-17T02:00:00Z"), numberOfBags: 4 }]);
  await assertStorageCapacity(tx, { checkIn: new Date("2026-10-16T02:00:00Z"), checkOut: new Date("2026-10-18T02:00:00Z"), bags: 6, capacity: 10 });
  await assertStorageCapacity(tx, { checkIn: new Date("2026-10-17T02:00:00Z"), checkOut: new Date("2026-10-19T02:00:00Z"), bags: 10, capacity: 10 });
});

test("storage capacity rejects overbooking at any point in the requested interval", async () => {
  const tx = transaction([
    { checkIn: new Date("2026-10-15T02:00:00Z"), checkOut: new Date("2026-10-17T02:00:00Z"), numberOfBags: 4 },
    { checkIn: new Date("2026-10-16T02:00:00Z"), checkOut: new Date("2026-10-18T02:00:00Z"), numberOfBags: 5 },
  ]);
  await assert.rejects(() => assertStorageCapacity(tx, { checkIn: new Date("2026-10-15T12:00:00Z"), checkOut: new Date("2026-10-18T02:00:00Z"), bags: 2, capacity: 10 }), StorageCapacityError);
});

test("held bags past their checkout still occupy storage until delivered", async () => {
  const now = new Date("2026-10-15T00:00:00Z");
  const overdue = [{ checkIn: new Date("2026-10-10T00:00:00Z"), checkOut: new Date("2026-10-12T00:00:00Z"), numberOfBags: 8, status: "IN_STORAGE" }];
  assert.equal(peakBagsUsed(overdue, { checkIn: new Date("2026-10-16T00:00:00Z"), checkOut: new Date("2026-10-17T00:00:00Z") }, now), 8);
  assert.equal(peakBagsUsed([{ ...overdue[0], status: "CONFIRMED" }], { checkIn: new Date("2026-10-16T00:00:00Z"), checkOut: new Date("2026-10-17T00:00:00Z") }, now), 0);
});

test("a full facility rejects the exact final-slot booking with the capacity message", async () => {
  const tx = transaction([{ checkIn: new Date("2026-10-15T02:00:00Z"), checkOut: new Date("2026-10-17T02:00:00Z"), numberOfBags: 10 }]);
  await assert.rejects(
    () => assertStorageCapacity(tx, { checkIn: new Date("2026-10-16T02:00:00Z"), checkOut: new Date("2026-10-16T08:00:00Z"), bags: 1, capacity: 10 }),
    (e: Error) => e instanceof StorageCapacityError && e.message.includes("has reached its capacity") && e.message.includes("Please select another available schedule"),
  );
});
