import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canAccessBooking } from "@/lib/booking-access";

export async function GET(_req: Request, { params }: { params: Promise<{ trackingNumber: string }> }) {
  const { trackingNumber } = await params;
  const normalized = decodeURIComponent(trackingNumber).trim().toUpperCase();
  const idPrefix = normalized.startsWith("INC-") ? normalized.slice(4).toLowerCase() : "";
  if (!/^[a-z0-9]{8}$/.test(idPrefix)) return NextResponse.json({ error: "Incident not found" }, { status: 404 });

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
  if (!(await canAccessBooking(incident.booking))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
