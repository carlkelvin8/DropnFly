import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";
import { sendIncidentEmail } from "@/lib/email";
import { notifyNoShowDecision, sendCustomerNotification } from "@/lib/notifications";

const REPORT_TYPES = ["no_show", "cancellation"];

async function getReporterUserId(incidentId: string) {
  const entry = await prisma.incidentTimeline.findFirst({
    where: { incidentId, action: "created" },
    orderBy: { createdAt: "asc" },
    select: { userId: true },
  });
  return entry?.userId || null;
}

async function handleNoShowDecision({
  id,
  session,
  action,
}: {
  id: string;
  session: { user: { id: string; name: string } };
  action: "accept" | "dismiss";
}) {
  const incident = await prisma.incidentReport.findUnique({
    where: { id },
    include: {
      booking: { select: { id: true, referenceNumber: true, customerId: true } },
      customer: { select: { name: true, email: true } },
    },
  });

  if (!incident) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!REPORT_TYPES.includes(incident.type)) {
    return NextResponse.json({ error: "This incident is not a no-show/cancellation report" }, { status: 400 });
  }

  if (!["PENDING", "INVESTIGATING"].includes(incident.status)) {
    return NextResponse.json({ error: "This report has already been decided" }, { status: 400 });
  }

  const targetStatus = incident.type === "no_show" ? "NO_SHOW" : "CANCELLED";

  if (action === "accept") {
    await prisma.$transaction([
      prisma.booking.update({
        where: { id: incident.booking.id },
        data: { status: targetStatus },
      }),
      prisma.incidentReport.update({
        where: { id },
        data: {
          status: "RESOLVED",
          resolvedAt: new Date(),
          resolution:
            incident.type === "no_show"
              ? "No-show report accepted by admin. Booking marked as No Show."
              : "Cancellation report accepted by admin. Booking cancelled.",
        },
      }),
      prisma.incidentTimeline.create({
        data: {
          incidentId: id,
          action: "status_change",
          description: `Report accepted by admin. Booking marked as ${targetStatus.replace(/_/g, " ")}.`,
          userId: session.user.id,
        },
      }),
    ]);

    await sendCustomerNotification({
      customerId: incident.booking.customerId,
      type: "booking_cancelled",
      title: incident.type === "no_show" ? "Booking Marked No Show" : "Booking Cancelled",
      message: `Your booking ${incident.booking.referenceNumber} was ${incident.type === "no_show" ? "marked as no-show" : "cancelled"} after a staff report. Contact support if you have questions.`,
    });
  } else {
    await prisma.$transaction([
      prisma.incidentReport.update({
        where: { id },
        data: {
          status: "CLOSED",
          resolvedAt: new Date(),
          resolution: "No-show report dismissed by admin. Booking status unchanged.",
        },
      }),
      prisma.incidentTimeline.create({
        data: {
          incidentId: id,
          action: "status_change",
          description: "Report dismissed by admin. Booking status unchanged.",
          userId: session.user.id,
        },
      }),
    ]);
  }

  const reporterUserId = await getReporterUserId(id);
  if (reporterUserId && reporterUserId !== session.user.id) {
    await notifyNoShowDecision(reporterUserId, incident.booking.referenceNumber, action);
  }

  await logActivity({
    userId: session.user.id,
    action: action === "accept" ? "ACCEPT" : "DISMISS",
    entity: "IncidentReport",
    entityId: id,
    details: `Admin ${action === "accept" ? "accepted" : "dismissed"} no-show report for booking ${incident.booking.referenceNumber}`,
  });

  const updated = await prisma.incidentReport.findUnique({
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

  return NextResponse.json(updated);
}

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
    const { status, priority, internalNotes, resolution, escalatedTo, action } = body;

    if (action === "accept" || action === "dismiss") {
      return handleNoShowDecision({
        id,
        session: { user: { id: session.user.id, name: session.user.name || "" } },
        action,
      });
    }

    const existing = await prisma.incidentReport.findUnique({
      where: { id },
      select: { status: true, resolution: true, internalNotes: true, type: true, customerId: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};
    if (status) updateData.status = status;
    if (priority) updateData.priority = priority;
    if (internalNotes !== undefined) updateData.internalNotes = internalNotes;
    if (resolution !== undefined) updateData.resolution = resolution;
    if (escalatedTo !== undefined) updateData.escalatedTo = escalatedTo;
    if (status === "RESOLVED" || status === "CLOSED") updateData.resolvedAt = new Date();

    await prisma.incidentReport.update({
      where: { id },
      data: updateData,
    });

    // Senior: dedicated history — create separate timeline entries so admin can back-track
    const timelineCreates: { action: string; description: string }[] = [];
    if (status && status !== existing.status) {
      timelineCreates.push({ action: "status_change", description: `Status changed: ${existing.status} → ${status}` });
    }
    if (priority) {
      timelineCreates.push({ action: "status_change", description: `Priority set to ${priority}` });
    }
    if (internalNotes !== undefined && internalNotes !== existing.internalNotes) {
      const trimmed = String(internalNotes).trim();
      if (trimmed) {
        timelineCreates.push({ action: "internal_note", description: `Internal note (admin only): ${trimmed.slice(0, 800)}` });
      } else if (existing.internalNotes) {
        timelineCreates.push({ action: "internal_note", description: "Internal note cleared" });
      }
    }
    if (resolution !== undefined && resolution !== existing.resolution) {
      const trimmed = String(resolution).trim();
      if (trimmed) {
        timelineCreates.push({ action: "resolved", description: `Resolution submitted (visible to customer): ${trimmed.slice(0, 800)}` });
      } else {
        timelineCreates.push({ action: "resolved", description: "Resolution cleared" });
      }
    }
    if (escalatedTo !== undefined && escalatedTo) {
      timelineCreates.push({ action: "note_added", description: `Escalated to ${escalatedTo}` });
    }
    if (timelineCreates.length === 0) {
      timelineCreates.push({ action: "note_added", description: "Incident updated" });
    }
    for (const entry of timelineCreates) {
      await prisma.incidentTimeline.create({
        data: {
          incidentId: id,
          action: entry.action,
          description: entry.description,
          userId: session.user.id,
        },
      });
    }
    const changes = timelineCreates.map((e) => e.description);

    await logActivity({
      userId: session.user.id,
      action: "UPDATE",
      entity: "IncidentReport",
      entityId: id,
      details: `Updated incident #${id.slice(0, 8)}: ${changes.join(", ")}`,
    });

    const updated = await prisma.incidentReport.findUnique({
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

    // Only email the customer when customer-visible fields actually changed
    const customerVisibleChange =
      (status && status !== existing.status) ||
      (resolution !== undefined && resolution !== existing.resolution);
    if (customerVisibleChange && updated) {
      const emailPayload = {
        to: updated.customer.email,
        customerName: updated.customer.name,
        referenceNumber: updated.booking.referenceNumber,
        incidentType: updated.type,
        status: status || updated.status,
        resolution: (resolution !== undefined ? resolution : updated.resolution) || updated.resolution,
        incidentId: id,
        description: updated.description,
        submittedAt: updated.submittedAt,
      } as const;
      // Senior: ensure resolution email is delivered (Brevo) with retry and proper logging — not dev-only
      sendIncidentEmail(emailPayload)
        .then(() => console.log(`[EMAIL] Incident resolution email sent for ${id}`))
        .catch((firstErr) => {
          console.error("[EMAIL] Incident resolution email first attempt failed:", firstErr);
          void (async () => {
            for (let attempt = 1; attempt < 3; attempt += 1) {
              try {
                await sendIncidentEmail(emailPayload);
                console.log(`[EMAIL] Incident resolution email retry ${attempt + 1} succeeded for ${id}`);
                return;
              } catch (retryErr) {
                console.error(`[EMAIL] Incident resolution retry ${attempt + 1} failed for ${id}:`, retryErr);
              }
            }
          })();
        });
    }

    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "Failed to update incident" }, { status: 500 });
  }
}
