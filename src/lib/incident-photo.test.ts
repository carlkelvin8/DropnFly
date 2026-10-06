import assert from "node:assert/strict";
import test from "node:test";
import { incidentPhotoError, MAX_INCIDENT_PHOTO_LENGTH } from "./incident-photo";

test("incident photos accept bounded image data URLs and reject malformed input", () => {
  assert.equal(incidentPhotoError(undefined), null);
  assert.equal(incidentPhotoError("data:image/jpeg;base64,YWJjZA=="), null);
  assert.match(incidentPhotoError("data:image/heic;base64,YWJjZA==") || "", /Unsupported/);
  assert.match(incidentPhotoError(`data:image/jpeg;base64,${"a".repeat(MAX_INCIDENT_PHOTO_LENGTH)}`) || "", /too large/);
});
