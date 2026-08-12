import crypto from "crypto";

export function generateReferenceNumber(prefix = "DROPFLY"): string {
  const now = new Date();
  const date = `${String(now.getFullYear()).slice(2)}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const rand = Array.from(crypto.randomBytes(6))
    .map((b) => alphabet[b % alphabet.length])
    .join("");
  return `${prefix}-${date}-${rand}`;
}
