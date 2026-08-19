import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { cookies } from "next/headers";

function getSecret() {
  const configured = process.env.CUSTOMER_JWT_SECRET || process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!configured) {
    throw new Error(
      "CUSTOMER_JWT_SECRET, AUTH_SECRET, or NEXTAUTH_SECRET environment variable is required. " +
      "Generate one with: openssl rand -base64 32"
    );
  }
  return new TextEncoder().encode(configured);
}

const COOKIE_NAME = "customer_token";

export interface CustomerJWT extends JWTPayload {
  id: string;
  email: string;
  name: string;
  authVersion: number;
}

export async function signCustomerToken(payload: CustomerJWT) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("30d")
    .sign(getSecret());
}

export async function verifyCustomerToken(token: string): Promise<CustomerJWT | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return payload as unknown as CustomerJWT;
  } catch {
    return null;
  }
}

export async function getCustomerSession(): Promise<CustomerJWT | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const payload = await verifyCustomerToken(token);
  if (!payload?.id) return null;

  // JWTs are not sufficient authorization by themselves: account deactivation
  // and deletion must take effect immediately, not after the 30-day expiry.
  const { prisma } = await import("@/lib/prisma");
  const customer = await prisma.customer.findUnique({
    where: { id: payload.id },
    select: { id: true, email: true, name: true, isActive: true, emailVerifiedAt: true, authVersion: true },
  });
  if (!customer?.isActive || !customer.emailVerifiedAt || customer.email !== payload.email || customer.authVersion !== payload.authVersion) return null;
  return { ...payload, id: customer.id, email: customer.email, name: customer.name, authVersion: customer.authVersion };
}

export async function setCustomerCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 30 * 24 * 60 * 60,
    path: "/",
  });
}

export async function clearCustomerCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}
