import assert from "node:assert/strict";
import test from "node:test";
import { coordinatesForLocation, validCoordinates } from "./booking-location";

test("booking locations resolve terminal meeting pins and preserve exact coordinates", () => {
  assert.deepEqual(coordinatesForLocation("NAIA Terminal 3 - Cebu Pacific"), { lat: 14.51923, lng: 121.01344 });
  assert.equal(coordinatesForLocation("Unknown location"), null);
  assert.deepEqual(validCoordinates(14.501, 121.009), { lat: 14.501, lng: 121.009 });
  assert.equal(validCoordinates(100, 121), null);
  assert.equal(validCoordinates("14.5", 121), null);
});
