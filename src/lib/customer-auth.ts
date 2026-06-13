import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { cookies } from "next/headers";

const secret = new TextEncoder().encode(
  process.env.CUSTOMER_JWT_SECRET || process.env.AUTH_SECRET || "customer-jwt-secret-dropnfly"
);

const COOKIE_NAME = "customer_token";

export interface CustomerJWT extends JWTPayload {
  id: string;
  email: string;
  name: string;
}

export async function signCustomerToken(payload: CustomerJWT) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("30d")
    .sign(secret);
}

export async function verifyCustomerToken(token: string): Promise<CustomerJWT | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload as unknown as CustomerJWT;
  } catch {
    return null;
  }
}

export async function getCustomerSession(): Promise<CustomerJWT | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyCustomerToken(token);
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
