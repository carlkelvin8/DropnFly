import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_req: Request, { params }: { params: Promise<{ trackingNumber: string }> }) {
  const { trackingNumber } = await params;
  const normalized = decodeURIComponent(trackingNumber).trim().toUpperCase().replace(/_/g, "-");
  const match = normalized.match(/^INC-([A-Z0-9]{8})$/);
  const idPrefix = match ? match[1].toLowerCase() : normalized.startsWith("INC-") ? normalized.slice(4).toLowerCase() : "";
  if (!/^[a-z0-9]{8}$/.test(idPrefix)) return NextResponse.json({ error: "Incident not found — use INC-XXXXXXXX" }, { status: 404 });

  const matches = await prisma.incidentReport.findMany({
    where: { id: { startsWith: idPrefix } },
    take: 2,
    include: {
      booking: { select: { id: true, customerId: true, referenceNumber: true } },
      timeline: {
        where: { action: { in: ["created", "status_change", "resolved"] } },
        orderBy: { createdAt: "desc" },
        select: { id: true, action: true, description: true, createdAt: true },
      },
    },
  });
  if (matches.length !== 1) return NextResponse.json({ error: "Incident not found" }, { status: 404 });
  const incident = matches[0];
  // Public tracking: tracking number is secret (8 hex). Allow direct fetch after
  // POST /api/public/bookings/access granted the booking_access cookie, but also
  // allow direct GET by tracking number alone for email link usability. No
  // additional booking_access check — the INC- number itself is the token.

  return NextResponse.json({
    trackingNumber: normalized,
    type: incident.type,
    description: incident.description,
    priority: incident.priority,
    status: incident.status,
    resolution: incident.resolution,
    submittedAt: incident.submittedAt,
    resolvedAt: incident.resolvedAt,
    bookingReference: incident.booking.referenceNumber,
    timeline: incident.timeline,
  });
}
