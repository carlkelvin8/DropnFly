import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeReference } from "@/lib/utils";
import { grantBookingAccess } from "@/lib/booking-access";
import { rateLimit, requestKey } from "@/lib/rate-limit";

export async function POST(req: Request) {
  const limited = await rateLimit(`booking-access:${requestKey(req)}`, 10, 15 * 60 * 1000);
  if (!limited.allowed) return NextResponse.json({ error: "Too many attempts" }, { status: 429, headers: { "Retry-After": String(limited.retryAfter) } });

  const body = await req.json().catch(() => null);
  const reference = typeof body?.reference === "string" ? normalizeReference(body.reference) : "";
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!reference || !email) return NextResponse.json({ error: "Reference and email are required" }, { status: 400 });

  const booking = await prisma.booking.findFirst({
    where: { referenceNumber: reference, customer: { email: { equals: email, mode: "insensitive" } } },
    select: { id: true, customerId: true },
  });
  // Do not reveal whether the reference or email was the mismatched field.
  if (!booking) return NextResponse.json({ error: "Booking details do not match" }, { status: 404 });
  await grantBookingAccess(booking.id, booking.customerId);
  return NextResponse.json({ success: true });
}
