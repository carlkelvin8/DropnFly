import { test } from "node:test";
import assert from "node:assert/strict";
import { mergeChatMessages } from "./chat-messages";
test("stale polls do not erase a confirmed send and repeated responses do not duplicate it", () => {
  const first = { id: "a", createdAt: "2026-09-13T10:00:00Z" };
  const sent = { id: "b", createdAt: "2026-09-13T10:00:01Z" };
  assert.deepEqual(mergeChatMessages([first, sent], [first]), [first, sent]);
  assert.deepEqual(mergeChatMessages([first, sent], [first, sent]), [first, sent]);
});
test("incoming messages update even when the last message id is unchanged", () => {
  const first = { id: "a", createdAt: "2026-09-13T10:00:00Z", sender: "old" };
  assert.equal(mergeChatMessages([first], [{ ...first, sender: "corrected" }])[0].sender, "corrected");
});
