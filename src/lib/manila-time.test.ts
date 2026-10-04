import assert from "node:assert/strict";
import test from "node:test";
import { manilaDateStr, manilaDayStart, manilaMonthRange } from "./manila-time";

test("Manila calendar day boundaries do not depend on the server timezone", () => {
  const start = manilaDayStart("2026-10-04");
  assert.equal(start.toISOString(), "2026-10-03T16:00:00.000Z");
  assert.equal(manilaDateStr(start), "2026-10-04");
});

test("Manila calendar month range handles regular and year-boundary months", () => {
  const october = manilaMonthRange(2026, 10);
  assert.equal(october.start.toISOString(), "2026-09-30T16:00:00.000Z");
  assert.equal(october.end.toISOString(), "2026-10-31T16:00:00.000Z");

  const december = manilaMonthRange(2026, 12);
  assert.equal(december.start.toISOString(), "2026-11-30T16:00:00.000Z");
  assert.equal(december.end.toISOString(), "2026-12-31T16:00:00.000Z");
});
