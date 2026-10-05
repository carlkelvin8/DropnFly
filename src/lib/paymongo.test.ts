import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";
import { hasPaidWebhookState, verifyWebhookSignature } from "./paymongo";

test("webhook verification fails closed when no secret is configured", () => {
  const previous = process.env.PAYMONGO_WEBHOOK_SECRET;
  delete process.env.PAYMONGO_WEBHOOK_SECRET;
  try {
    assert.equal(verifyWebhookSignature("{}", null), false);
  } finally {
    if (previous) process.env.PAYMONGO_WEBHOOK_SECRET = previous;
  }
});

test("webhook verification accepts a matching HMAC and rejects tampering", () => {
  const previous = process.env.PAYMONGO_WEBHOOK_SECRET;
  process.env.PAYMONGO_WEBHOOK_SECRET = "unit-test-secret";
  try {
    const timestamp = "1700000000";
    const body = '{"type":"checkout_session.payment_paid"}';
    const signature = crypto.createHmac("sha256", "unit-test-secret").update(`${timestamp}.${body}`).digest("base64");
    const header = `t=${timestamp},v1=${signature}`;
    assert.equal(verifyWebhookSignature(body, header), true);
    assert.equal(verifyWebhookSignature(`${body} `, header), false);
  } finally {
    if (previous) process.env.PAYMONGO_WEBHOOK_SECRET = previous;
    else delete process.env.PAYMONGO_WEBHOOK_SECRET;
  }
});

test("paid webhook state fails closed when supplied states are not paid", () => {
  assert.equal(hasPaidWebhookState(undefined), true);
  assert.equal(hasPaidWebhookState({ state: "paid" }), true);
  assert.equal(hasPaidWebhookState({ state: "active", payment_intent: { status: "succeeded" } }), true);
  assert.equal(hasPaidWebhookState({ state: "active", payment_intent: { status: "awaiting_payment_method" } }), false);
  assert.equal(hasPaidWebhookState({ state: "failed" }), false);
});
