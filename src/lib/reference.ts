import crypto from "crypto";

export function generateReferenceNumber(): string {
  const prefix = "DROPFLY";
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `${prefix}-${timestamp}${random}`;
}
