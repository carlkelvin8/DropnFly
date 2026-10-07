import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";
import { sendIncidentEmail } from "@/lib/email";
import { notifyNoShowDecision, sendCustomerNotification } from "@/lib/notifications";

const REPORT_TYPES = ["no_show", "cancellation"];
const INCIDENT_STATUSES = ["PENDING", "INVESTIGATING", "RESOLVED", "CLOSED"];
const INCIDENT_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
const ESCALATION_LEVELS = ["manager", "director", "executive"];

function mergeInternalNote(current: string | null, note: string) {
  try {
    const parsed = current ? JSON.parse(current) : null;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return JSON.stringify({ ...parsed, note });
    }
  } catch {
    // Older incidents stored a plain-text note. Replace that note while newer
    // report metadata (including photo proof) remains intact when present.
  }
  return note;
}

async function getReporterUserId(incidentId: string) {
  const entry = await prisma.incidentTimeline.findFirst({
    where: { incidentId, action: "created" },
    orderBy: { createdAt: "asc" },
    select: { userId: true },
  });
  return entry?.userId || null;
}

class AlreadyDecidedError extends Error {}

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

  try {
  if (action === "accept") {
    await prisma.$transaction(async (tx) => {
      // Claim the report atomically so two admins cannot both decide it.
      const claimed = await tx.incidentReport.updateMany({
        where: { id, status: { in: ["PENDING", "INVESTIGATING"] } },
        data: {
          status: "RESOLVED",
          resolvedAt: new Date(),
          resolution:
            incident.type === "no_show"
              ? "No-show report accepted by admin. Booking marked as No Show."
              : "Cancellation report accepted by admin. Booking cancelled.",
        },
      });
      if (claimed.count === 0) throw new AlreadyDecidedError();
      await tx.booking.update({
        where: { id: incident.booking.id },
        data: {
          status: targetStatus,
          pickupStartedAt: null,
          deliveryArrivedAt: null,
          checkoutLockedUntil: null,
        },
      });
      await tx.incidentTimeline.create({
        data: {
          incidentId: id,
          action: "status_change",
          description: `Report accepted by admin. Booking marked as ${targetStatus.replace(/_/g, " ")}.`,
          userId: session.user.id,
        },
      });
      await tx.scanEvent.create({
        data: {
          bookingId: incident.booking.id,
          userId: session.user.id,
          status: targetStatus,
          note: `Logistics task ended after admin accepted the ${incident.type.replace(/_/g, " ")} report`,
        },
      });
    });

    try {
      await sendCustomerNotification({
        customerId: incident.booking.customerId,
        type: "booking_cancelled",
        title: incident.type === "no_show" ? "Booking Marked No Show" : "Booking Cancelled",
        message: `Your booking ${incident.booking.referenceNumber} was ${incident.type === "no_show" ? "marked as no-show" : "cancelled"} after a staff report. Contact support if you have questions.`,
      });
    } catch (notificationError) {
      console.warn(`[INCIDENT] Customer notification failed for ${id}:`, notificationError);
    }
  } else {
    await prisma.$transaction(async (tx) => {
      const claimed = await tx.incidentReport.updateMany({
        where: { id, status: { in: ["PENDING", "INVESTIGATING"] } },
        data: {
          status: "CLOSED",
          resolvedAt: new Date(),
          resolution: "No-show report dismissed by admin. Booking status unchanged.",
        },
      });
      if (claimed.count === 0) throw new AlreadyDecidedError();
      await tx.incidentTimeline.create({
        data: {
          incidentId: id,
          action: "status_change",
          description: "Report dismissed by admin. Booking status unchanged.",
          userId: session.user.id,
        },
      });
    });
  }
  } catch (error) {
    if (error instanceof AlreadyDecidedError) {
      return NextResponse.json({ error: "This report has already been decided" }, { status: 400 });
    }
    throw error;
  }

  try {
    const reporterUserId = await getReporterUserId(id);
    if (reporterUserId && reporterUserId !== session.user.id) {
      await notifyNoShowDecision(reporterUserId, incident.booking.referenceNumber, action);
    }
  } catch (notificationError) {
    console.warn(`[INCIDENT] Reporter notification failed for ${id}:`, notificationError);
  }

  try {
    await logActivity({
      userId: session.user.id,
      action: action === "accept" ? "ACCEPT" : "DISMISS",
      entity: "IncidentReport",
      entityId: id,
      details: `Admin ${action === "accept" ? "accepted" : "dismissed"} no-show report for booking ${incident.booking.referenceNumber}`,
    });
  } catch (activityError) {
    console.warn(`[INCIDENT] Decision activity log failed for ${id}:`, activityError);
  }

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

    // Senior: strictly isolate actions — each save button touches exactly one
    // concern so Internal Notes, Resolution, and Status never clobber each other.
    const updateData: Record<string, unknown> = {};
    if (action === "save_note") {
      const note = String(internalNotes || "").trim();
      if (!note) return NextResponse.json({ error: "Internal note is required" }, { status: 400 });
      if (note.length > 4000) return NextResponse.json({ error: "Internal note is too long" }, { status: 400 });
      updateData.internalNotes = mergeInternalNote(existing.internalNotes, note);
    } else if (action === "save_resolution") {
      const message = String(resolution || "").trim();
      if (!message) return NextResponse.json({ error: "Resolution message is required" }, { status: 400 });
      if (message.length > 4000) return NextResponse.json({ error: "Resolution message is too long" }, { status: 400 });
      updateData.resolution = message;
    } else if (action === "save_status") {
      if (!status && !priority && escalatedTo === undefined) return NextResponse.json({ error: "No status fields to update" }, { status: 400 });
      if (status && !INCIDENT_STATUSES.includes(status)) return NextResponse.json({ error: "Invalid incident status" }, { status: 400 });
      if (priority && !INCIDENT_PRIORITIES.includes(priority)) return NextResponse.json({ error: "Invalid incident priority" }, { status: 400 });
      if (escalatedTo !== undefined && escalatedTo !== null && !ESCALATION_LEVELS.includes(escalatedTo)) {
        return NextResponse.json({ error: "Invalid escalation level" }, { status: 400 });
      }
      if (status) updateData.status = status;
      if (priority) updateData.priority = priority;
      if (escalatedTo !== undefined) updateData.escalatedTo = escalatedTo;
      if (status === "RESOLVED" || status === "CLOSED") updateData.resolvedAt = new Date();
      else if (status) updateData.resolvedAt = null;
    } else {
      return NextResponse.json({ error: "Invalid action — use save_note, save_resolution, or save_status" }, { status: 400 });
    }

    // Senior: dedicated history — create separate timeline entries so admin can back-track
    const timelineCreates: { action: string; description: string }[] = [];
    if (status && status !== existing.status) {
      timelineCreates.push({ action: "status_change", description: `Status changed: ${existing.status} → ${status}` });
    }
    if (priority) {
      timelineCreates.push({ action: "status_change", description: `Priority set to ${priority}` });
    }
    if ("internalNotes" in updateData && updateData.internalNotes !== existing.internalNotes) {
      const trimmed = String(internalNotes).trim();
      if (trimmed) {
        timelineCreates.push({ action: "internal_note", description: `Internal note (admin only): ${trimmed.slice(0, 800)}` });
      } else if (existing.internalNotes) {
        timelineCreates.push({ action: "internal_note", description: "Internal note cleared" });
      }
    }
    if ("resolution" in updateData && updateData.resolution !== existing.resolution) {
      const trimmed = String(resolution).trim();
      if (trimmed) {
        timelineCreates.push({ action: "resolved", description: `Resolution submitted (visible to customer): ${trimmed.slice(0, 800)}` });
      } else {
        timelineCreates.push({ action: "resolved", description: "Resolution cleared" });
      }
    }
    if ("escalatedTo" in updateData && escalatedTo) {
      timelineCreates.push({ action: "note_added", description: `Escalated to ${escalatedTo}` });
    }
    if (timelineCreates.length === 0) {
      timelineCreates.push({ action: "note_added", description: "Incident updated" });
    }
    const changes = timelineCreates.map((e) => e.description);
    const updated = await prisma.$transaction(async (tx) => {
      await tx.incidentReport.update({ where: { id }, data: updateData });
      await tx.incidentTimeline.createMany({
        data: timelineCreates.map((entry) => ({
          incidentId: id,
          action: entry.action,
          description: entry.description,
          userId: session.user.id,
        })),
      });
      return tx.incidentReport.findUnique({
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
    });

    try {
      await logActivity({
        userId: session.user.id,
        action: "UPDATE",
        entity: "IncidentReport",
        entityId: id,
        details: `Updated incident #${id.slice(0, 8)}: ${changes.join(", ")}`,
      });
    } catch (activityError) {
      console.warn(`[INCIDENT] Activity log failed for ${id}:`, activityError);
    }

    // Only email the customer when customer-visible fields actually changed
    const customerVisibleChange =
      ("status" in updateData && status && status !== existing.status) ||
      ("resolution" in updateData && updateData.resolution !== existing.resolution);
    let emailSent: boolean | null = null;
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
      try {
        emailSent = await sendIncidentEmail(emailPayload);
      } catch (emailError) {
        emailSent = false;
        console.error(`[EMAIL] Incident update email failed for ${id}:`, emailError);
      }
    }

    return NextResponse.json({ ...updated, emailSent });
  } catch (error) {
    console.error(`[INCIDENT] Failed to update ${id}:`, error);
    return NextResponse.json({ error: "Failed to update incident" }, { status: 500 });
  }
}
