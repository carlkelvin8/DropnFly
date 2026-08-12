import crypto from "crypto";

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function generateSecret(bytes = 20): string {
  const buf = crypto.randomBytes(bytes);
  let bits = "";
  for (const byte of buf) bits += byte.toString(2).padStart(8, "0");
  let secret = "";
  for (let i = 0; i + 5 <= bits.length; i += 5) {
    secret += BASE32_ALPHABET[parseInt(bits.slice(i, i + 5), 2)];
  }
  return secret.padEnd(32, "=");
}

function base32Decode(input: string): Buffer {
  const clean = input.replace(/=+$/g, "").toUpperCase().replace(/\s+/g, "");
  let bits = "";
  for (const char of clean) {
    const idx = BASE32_ALPHABET.indexOf(char);
    if (idx === -1) continue;
    bits += idx.toString(2).padStart(5, "0");
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}

function hotp(secret: Buffer, counter: number): string {
  const counterBuf = Buffer.alloc(8);
  counterBuf.writeBigUInt64BE(BigInt(counter));
  const hmac = crypto.createHmac("sha1", secret);
  hmac.update(counterBuf);
  const digest = hmac.digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);
  return String(binary % 1_000_000).padStart(6, "0");
}

function currentTimeStep(): number {
  return Math.floor(Date.now() / 1000 / 30);
}

export function verifyTotp(secret: string, code: string, window = 1): boolean {
  if (!secret || !code) return false;
  const cleanCode = String(code).replace(/\s+/g, "").trim();
  if (!/^\d{6}$/.test(cleanCode)) return false;
  const decoded = base32Decode(secret);
  const step = currentTimeStep();
  for (let i = -window; i <= window; i++) {
    if (hotp(decoded, step + i) === cleanCode) return true;
  }
  return false;
}

export function otpauthURL(secret: string, account: string, issuer = "Dropnfly"): string {
  const enc = (v: string) => encodeURIComponent(v);
  return `otpauth://totp/${enc(issuer)}:${enc(account)}?secret=${enc(secret)}&issuer=${enc(issuer)}&algorithm=SHA1&digits=6&period=30`;
}
