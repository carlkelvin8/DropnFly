import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";
import { sendIncidentEmail } from "@/lib/email";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const incident = await prisma.incidentReport.findUnique({
    where: { id },
    include: {
      customer: { select: { name: true, email: true, phone: true } },
      booking: {
        select: {
          referenceNumber: true,
          pickupLocation: true,
          dropOffLocation: true,
          status: true,
          checkIn: true,
          checkOut: true,
          totalPrice: true,
          luggageDetails: true,
        },
      },
      timeline: {
        orderBy: { createdAt: "desc" },
        include: { user: { select: { name: true } } },
      },
    },
  });

  if (!incident) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(incident);
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const body = await req.json();
    const { status, priority, internalNotes, resolution, escalatedTo } = body;

    const updateData: Record<string, unknown> = {};
    if (status) updateData.status = status;
    if (priority) updateData.priority = priority;
    if (internalNotes !== undefined) updateData.internalNotes = internalNotes;
    if (resolution !== undefined) updateData.resolution = resolution;
    if (escalatedTo !== undefined) updateData.escalatedTo = escalatedTo;
    if (status === "RESOLVED" || status === "CLOSED") updateData.resolvedAt = new Date();

    const incident = await prisma.incidentReport.update({
      where: { id },
      data: updateData,
      include: {
        customer: { select: { name: true, email: true } },
        booking: { select: { referenceNumber: true } },
      },
    });

    const changes: string[] = [];
    if (status) changes.push(`status → ${status}`);
    if (priority) changes.push(`priority → ${priority}`);
    if (internalNotes !== undefined) changes.push("internal notes updated");
    if (resolution !== undefined) changes.push("resolution updated");
    if (escalatedTo) changes.push(`escalated to ${escalatedTo}`);

    await prisma.incidentTimeline.create({
      data: {
        incidentId: id,
        action: status ? "status_change" : "note_added",
        description: changes.length > 0 ? `Admin action: ${changes.join(", ")}` : "Incident updated",
        userId: session.user.id,
      },
    });

    await logActivity({
      userId: session.user.id,
      action: "UPDATE",
      entity: "IncidentReport",
      entityId: id,
      details: `Updated incident #${id.slice(0, 8)}: ${changes.join(", ")}`,
    });

    // Email customer about the update
    try {
      await sendIncidentEmail({
        to: incident.customer.email,
        customerName: incident.customer.name,
        referenceNumber: incident.booking.referenceNumber,
        incidentType: incident.type,
        status: status || incident.status,
        resolution: resolution || incident.resolution,
        incidentId: id,
      });
    } catch (emailErr) {
      console.warn("[EMAIL] Failed to send incident email:", emailErr);
    }

    return NextResponse.json(incident);
  } catch {
    return NextResponse.json({ error: "Failed to update incident" }, { status: 500 });
  }
}
