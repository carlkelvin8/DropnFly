import assert from "node:assert/strict";
import test from "node:test";
import { requestKey } from "./rate-limit";

test("request key uses only the first trusted proxy address", () => {
  const request = new Request("https://example.test", { headers: { "x-forwarded-for": "203.0.113.8, 10.0.0.2" } });
  assert.equal(requestKey(request), "203.0.113.8");
});
