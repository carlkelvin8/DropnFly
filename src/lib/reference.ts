import crypto from "crypto";
import { manilaDateStr } from "./manila-time";

export function generateReferenceNumber(prefix = "DROPFLY"): string {
  const dateStr = manilaDateStr(new Date());
  const date = `${dateStr.slice(2, 4)}${dateStr.slice(5, 7)}${dateStr.slice(8, 10)}`;
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const rand = Array.from(crypto.randomBytes(6))
    .map((b) => alphabet[b % alphabet.length])
    .join("");
  return `${prefix}-${date}-${rand}`;
}
