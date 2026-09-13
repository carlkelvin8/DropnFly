import assert from "node:assert/strict";
import test from "node:test";
import type { Prisma } from "@/generated/prisma/client";
import { assertScheduleCapacity, BookingSlotError } from "./booking-slot-capacity";

const time = new Date("2030-09-04T20:00:00+08:00");
function database(capacity: number, reservations: number) {
  const locks: unknown[][] = [];
  const queries: unknown[] = [];
  const tx = {
    $executeRaw: async (...args: unknown[]) => { locks.push(args); return 1; },
    systemSetting: { findMany: async () => [{ key: "fleet_data", value: JSON.stringify([{ count: capacity }]) }] },
    booking: { findMany: async (query: unknown) => {
      queries.push(query);
      return Array.from({ length: reservations }, () => ({ checkIn: time, checkOut: null }));
    } },
  } as unknown as Prisma.TransactionClient;
  return { tx, locks, queries };
}

test("schedule edits reject a full slot and succeed after a third fleet vehicle is registered", async () => {
  await assert.rejects(assertScheduleCapacity(database(2, 2).tx, [time], "moving-booking"), BookingSlotError);
  await assert.doesNotReject(assertScheduleCapacity(database(3, 2).tx, [time], "moving-booking"));
});

test("schedule edits acquire the same Manila date lock as creation and exclude themselves", async () => {
  const db = database(2, 1);
  await assertScheduleCapacity(db.tx, [time, time], "moving-booking");
  assert.equal(db.locks.length, 1);
  assert.equal(db.locks[0][1], "fleet-slot:2030-09-04");
  const query = db.queries[0] as { where: { id: { not: string }; status: { notIn: string[] } } };
  assert.equal(query.where.id.not, "moving-booking");
  assert.ok(query.where.status.notIn.includes("NO_SHOW"));
});

test("zero fleet and forged off-grid schedule requests fail closed", async () => {
  await assert.rejects(assertScheduleCapacity(database(0, 0).tx, [time], "booking"), /TIME SLOT FULL/);
  await assert.rejects(assertScheduleCapacity(database(2, 0).tx, [new Date("2030-09-04T20:30:00+08:00")], "booking"), /hourly/);
});
