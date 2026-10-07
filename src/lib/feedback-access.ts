import "server-only";
import { SignJWT, jwtVerify } from "jose";

export interface FeedbackAccess {
  bookingId: string;
  customerId: string;
}

function secret() {
  const configured = process.env.CUSTOMER_JWT_SECRET;
  if (!configured && process.env.NODE_ENV === "production") {
    throw new Error("CUSTOMER_JWT_SECRET must be set in production");
  }
  return new TextEncoder().encode(
    configured || process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "dropnfly-local-feedback-secret",
  );
}

export async function signFeedbackAccess(access: FeedbackAccess): Promise<string> {
  return new SignJWT({ ...access, purpose: "feedback-access" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30m")
    .sign(secret());
}

export async function verifyFeedbackAccess(request: Request): Promise<FeedbackAccess | null> {
  const authorization = request.headers.get("authorization") || "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;

  try {
    const { payload } = await jwtVerify(match[1], secret());
    if (
      payload.purpose !== "feedback-access"
      || typeof payload.bookingId !== "string"
      || typeof payload.customerId !== "string"
    ) return null;
    return { bookingId: payload.bookingId, customerId: payload.customerId };
  } catch {
    return null;
  }
}
