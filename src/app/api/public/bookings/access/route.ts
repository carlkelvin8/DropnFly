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

  // Incident tracking numbers are INC-XXXXXXXX (8 hex). Be lenient with dash/underscore/case/spaces.
  const incidentMatch = reference.match(/^INC[-_]?([A-Z0-9]{8})$/);
  if (incidentMatch || reference.startsWith("INC-") || reference.startsWith("INC_")) {
    const rawPrefix = incidentMatch ? incidentMatch[1] : reference.replace(/^INC[-_]?/i, "").slice(0, 8);
    const idPrefix = rawPrefix.toLowerCase();
    if (!/^[a-z0-9]{8}$/.test(idPrefix)) {
      return NextResponse.json({ error: "Incident details do not match — check INC- number and email" }, { status: 404 });
    }
    const incidents = await prisma.incidentReport.findMany({
      where: {
        id: { startsWith: idPrefix },
        OR: [
          { customer: { email: { equals: email, mode: "insensitive" } } },
          { booking: { customer: { email: { equals: email, mode: "insensitive" } } } },
        ],
      },
      select: { id: true, booking: { select: { id: true, customerId: true } } },
      take: 2,
    });
    if (incidents.length !== 1) return NextResponse.json({ error: "Incident details do not match — no report found for that number + email" }, { status: 404 });
    await grantBookingAccess(incidents[0].booking.id, incidents[0].booking.customerId);
    return NextResponse.json({ success: true, kind: "incident", trackingNumber: `INC-${idPrefix.toUpperCase()}` });
  }

  const booking = await prisma.booking.findFirst({
    where: { referenceNumber: reference, customer: { email: { equals: email, mode: "insensitive" } } },
    select: { id: true, customerId: true },
  });
  // Do not reveal whether the reference or email was the mismatched field.
  if (!booking) return NextResponse.json({ error: "Booking details do not match" }, { status: 404 });
  await grantBookingAccess(booking.id, booking.customerId);
  return NextResponse.json({ success: true, kind: "booking", reference });
}
