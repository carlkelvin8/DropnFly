import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { auth } from "@/lib/auth";
import { getCustomerSession } from "@/lib/customer-auth";
import { canReadBooking, hasStaffRole } from "@/lib/staff-access";

const COOKIE_NAME = "booking_access";

export const LOCKED_BOOKING_STATUSES = ["CANCELLED", "NO_SHOW"] as const;

export function isBookingLocked(status: string): boolean {
  return (LOCKED_BOOKING_STATUSES as readonly string[]).includes(status);
}

function getSecret(): string {
  const secret = process.env.CUSTOMER_JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("CUSTOMER_JWT_SECRET must be set in production");
    }
    return process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "dropnfly-local-development-only-secret";
  }
  return secret;
}

function secret() {
  return new TextEncoder().encode(getSecret());
}

export async function grantBookingAccess(bookingId: string, customerId: string) {
  const cookieStore = await cookies();
  let grants: Array<{ bookingId: string; customerId: string }> = [];
  const existing = cookieStore.get(COOKIE_NAME)?.value;
  if (existing) {
    try {
      const { payload } = await jwtVerify(existing, secret());
      if (payload.purpose === "booking-access" && Array.isArray(payload.grants)) {
        grants = payload.grants.filter((grant): grant is { bookingId: string; customerId: string } =>
          Boolean(grant && typeof grant === "object" && typeof (grant as { bookingId?: unknown }).bookingId === "string" && typeof (grant as { customerId?: unknown }).customerId === "string")
        );
      }
    } catch { /* replace malformed or expired grants */ }
  }
  grants = [{ bookingId, customerId }, ...grants.filter((grant) => grant.bookingId !== bookingId)].slice(0, 20);
  const token = await new SignJWT({ grants, purpose: "booking-access" })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("7d")
    .sign(secret());
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60,
    path: "/",
  });
}

export async function canAccessBooking(booking: { id: string; customerId: string }) {
  const [staff, customer] = await Promise.all([auth(), getCustomerSession()]);
  if (staff?.user && (hasStaffRole(staff.user, ["ADMIN", "STAFF"]) || await canReadBooking(staff.user, booking.id))) return true;
  if (customer?.id === booking.customerId) return true;

  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, secret());
    if (payload.purpose !== "booking-access" || !Array.isArray(payload.grants)) return false;
    return payload.grants.some((grant) => grant && typeof grant === "object" && (grant as { bookingId?: unknown }).bookingId === booking.id && (grant as { customerId?: unknown }).customerId === booking.customerId);
  } catch {
    return false;
  }
}
