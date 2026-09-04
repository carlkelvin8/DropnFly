import crypto from "crypto";

const PAYMONGO_API = "https://api.paymongo.com/v1";

export interface CheckoutSessionResult {
  id: string;
  checkoutUrl: string;
}

export function isPaymongoConfigured(): boolean {
  return Boolean(process.env.PAYMONGO_SECRET_KEY);
}

function authHeaders(): HeadersInit {
  const secretKey = process.env.PAYMONGO_SECRET_KEY || "";
  const encoded = Buffer.from(`${secretKey}:`).toString("base64");
  return {
    Authorization: `Basic ${encoded}`,
    "Content-Type": "application/json",
  };
}

function cents(amount: number): number {
  return Math.round(amount * 100);
}

export async function createCheckoutSession(params: {
  amount: number;
  description: string;
  name: string;
  email: string;
  successUrl: string;
  cancelUrl: string;
  paymentMethodTypes?: string[];
  metadata?: Record<string, string>;
}): Promise<CheckoutSessionResult> {
  const {
    amount,
    description,
    name,
    email,
    successUrl,
    cancelUrl,
    paymentMethodTypes = ["gcash", "maya", "card"],
    metadata = {},
  } = params;

  const res = await fetch(`${PAYMONGO_API}/checkout_sessions`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      data: {
        attributes: {
          billing: { name, email },
          send_email_receipt: true,
          line_items: [
            {
              currency: "PHP",
              amount: cents(amount),
              description,
              name: description,
              quantity: 1,
            },
          ],
          payment_method_types: paymentMethodTypes,
          success_url: successUrl,
          cancel_url: cancelUrl,
          metadata,
        },
      },
    }),
  });

  const json = await res.json().catch(() => null);

  if (!res.ok) {
    const message =
      (json as { errors?: { detail?: string }[] })?.errors?.[0]?.detail ||
      `PayMongo request failed with status ${res.status}`;
    throw new Error(message);
  }

  const data = json?.data;
  if (!data?.id) {
    throw new Error("PayMongo returned an invalid checkout session");
  }

  return {
    id: data.id as string,
    checkoutUrl: (data.attributes?.checkout_url as string) || `https://checkout.paymongo.com/${data.id}`,
  };
}

export interface PayMongoWebhookPayload {
  data: {
    id: string;
    attributes?: {
      state?: string;
      payment_intent?: { id?: string; status?: string };
      metadata?: Record<string, string>;
    };
  };
  type?: string;
}

export function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | null
): boolean {
  const secret = process.env.PAYMONGO_WEBHOOK_SECRET;
  // Never accept unsigned payment state changes. A missing secret is a
  // configuration error, not a reason to bypass verification.
  if (!secret) return false;

  if (!signatureHeader) return false;

  const parts: Record<string, string> = {};
  for (const chunk of signatureHeader.split(",")) {
    const part = chunk.trim();
    const separator = part.indexOf("=");
    if (separator > 0) parts[part.slice(0, separator)] = part.slice(separator + 1);
  }

  const timestamp = parts["t"];
  const expected = parts["v1"];
  if (!timestamp || !expected) return false;

  const signedPayload = `${timestamp}.${rawBody}`;
  // PayMongo sends v1 as hex (docs: HMAC-SHA256 hex). Compute hex and compare
  // in constant time. Also accept base64 for forward-compat if gateway changes.
  const computedHex = crypto.createHmac("sha256", secret).update(signedPayload).digest("hex");
  const computedB64 = crypto.createHmac("sha256", secret).update(signedPayload).digest("base64");
  const expectedLower = expected.toLowerCase();

  try {
    // Compare as hex first (primary), then base64 fallback
    const tryCompare = (computed: string, exp: string) => {
      const a = Buffer.from(computed, "utf8");
      const b = Buffer.from(exp, "utf8");
      if (a.length !== b.length) return false;
      return crypto.timingSafeEqual(a, b);
    };
    if (tryCompare(computedHex, expectedLower)) return true;
    if (tryCompare(computedHex.toUpperCase(), expected)) return true;
    if (tryCompare(computedB64, expected)) return true;
    return false;
  } catch {
    return false;
  }
}
