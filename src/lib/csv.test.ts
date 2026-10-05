import assert from "node:assert/strict";
import test from "node:test";
import { escapeCsvCell } from "./csv";

test("CSV cells escape quotes and neutralize spreadsheet formulas", () => {
  assert.equal(escapeCsvCell('A "quoted" value'), '"A ""quoted"" value"');
  assert.equal(escapeCsvCell("=HYPERLINK(\"https://evil.example\")"), '"\'=HYPERLINK(""https://evil.example"")"');
  assert.equal(escapeCsvCell("+1-555-0100"), '"\'+1-555-0100"');
  assert.equal(escapeCsvCell(null), '""');
});
