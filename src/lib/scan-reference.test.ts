import assert from "node:assert/strict";
import test from "node:test";
import { normalizeScannedReference } from "./scan-reference";

test("QR references normalize from plain text and tracking URLs", () => {
  assert.equal(normalizeScannedReference(" dnf-260910-76cz4p "), "DNF-260910-76CZ4P");
  assert.equal(
    normalizeScannedReference("https://dropnfly.example/track/DNF-260910-76CZ4P?source=email#status"),
    "DNF-260910-76CZ4P",
  );
  assert.equal(
    normalizeScannedReference("https://dropn-fly.vercel.app/feedback?reference=DNF-261007-ABC123"),
    "DNF-261007-ABC123",
  );
});

test("legacy QR references with a duplicated prefix are accepted", () => {
  assert.equal(normalizeScannedReference("DNF-DNF-260911-X5HJ3P"), "DNF-260911-X5HJ3P");
});
