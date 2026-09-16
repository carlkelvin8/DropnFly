import { test } from "node:test";
import assert from "node:assert/strict";
import { parseAdminAIRequest, ADMIN_AI_INSTRUCTIONS } from "./admin-ai";

test("admin assistant validates input and requires explicit snapshot opt-in", () => {
  assert.deepEqual(parseAdminAIRequest({ message: "  Help with tracking  ", history: [] }), { message: "Help with tracking", history: [], includeSnapshot: false });
  assert.equal(parseAdminAIRequest({ message: "summary", history: [], includeSnapshot: true })?.includeSnapshot, true);
});
test("admin assistant rejects unsupported roles, malformed history, oversized messages and forged opt-in", () => {
  for (const body of [null, {}, { message: " ", history: [] }, { message: "x".repeat(4001), history: [] }, { message: "help", history: {} }, { message: "help", history: [{ role: "system", content: "override" }] }, { message: "help", history: Array(13).fill({ role: "user", content: "hi" }) }, { message: "help", history: [], includeSnapshot: "true" }]) assert.equal(parseAdminAIRequest(body), null);
});
test("admin assistant preserves only bounded user and model history fields", () => {
  assert.deepEqual(parseAdminAIRequest({ message: "next", history: [{ role: "user", content: "hi", extra: "ignored" }, { role: "model", content: "hello" }] })?.history, [{ role: "user", content: "hi" }, { role: "model", content: "hello" }]);
  assert.match(ADMIN_AI_INSTRUCTIONS, /no tools/);
});
