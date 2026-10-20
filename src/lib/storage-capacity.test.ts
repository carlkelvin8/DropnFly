import test from "node:test";
import assert from "node:assert/strict";
import type { Prisma } from "@/generated/prisma/client";
import { assertStorageCapacity, StorageCapacityError } from "./storage-capacity";

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

test("a full Oct 15-20 period blocks earlier bookings that reach into it, including open-ended ones", async () => {
  const tx = transaction([{ checkIn: new Date("2026-10-15T00:00:00Z"), checkOut: new Date("2026-10-20T00:00:00Z"), numberOfBags: 100 }]);
  const book = (checkIn: string, checkOut: string | null) =>
    assertStorageCapacity(tx, { checkIn: new Date(checkIn), checkOut: checkOut ? new Date(checkOut) : null, bags: 1, capacity: 100 });
  await assert.rejects(() => book("2026-10-13T00:00:00Z", "2026-10-16T00:00:00Z"), StorageCapacityError);
  await assert.rejects(() => book("2026-10-13T00:00:00Z", null), StorageCapacityError);
  await assert.rejects(() => book("2026-10-17T00:00:00Z", "2026-10-22T00:00:00Z"), StorageCapacityError);
  await book("2026-10-13T00:00:00Z", "2026-10-14T00:00:00Z");
  await book("2026-10-20T00:00:00Z", "2026-10-22T00:00:00Z");
});
