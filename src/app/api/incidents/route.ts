import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";
import { notifyNoShowReported } from "@/lib/notifications";
import { incidentPhotoError } from "@/lib/incident-photo";
import { hasStaffRole } from "@/lib/staff-access";

const REPORT_TYPES = ["no_show", "cancellation"];

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!["ADMIN", "STAFF"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const priority = searchParams.get("priority");
  const type = searchParams.get("type");
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const limit = Math.max(1, Math.min(100, parseInt(searchParams.get("limit") || "20")));

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (priority) where.priority = priority;
  if (type) where.type = type;

  const skip = (page - 1) * limit;

  const [incidents, total] = await Promise.all([
    prisma.incidentReport.findMany({
      where,
      orderBy: { submittedAt: "desc" },
      skip,
      take: Math.min(limit, 100),
      include: {
        customer: { select: { name: true, email: true, phone: true } },
        booking: { select: { referenceNumber: true } },
        timeline: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    }),
    prisma.incidentReport.count({ where }),
  ]);

  return NextResponse.json({ incidents, total, page, limit, totalPages: Math.ceil(total / limit) });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { bookingId, customerId, type, description, priority, photo, note } = body;

    if (!bookingId || !customerId || !type || typeof description !== "string" || !description.trim()) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    if (!REPORT_TYPES.includes(type)) {
      return NextResponse.json({ error: "Invalid report type" }, { status: 400 });
    }
    if (description.length > 4000 || (note !== undefined && (typeof note !== "string" || note.length > 1000))) {
      return NextResponse.json({ error: "Report description or note is too long" }, { status: 400 });
    }
    const photoError = incidentPhotoError(photo);
    if (photoError) return NextResponse.json({ error: photoError }, { status: 413 });
    const bookingCheck = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: {
        id: true,
        customerId: true,
        status: true,
        assignments: { select: { userId: true, phase: true } },
      },
    });
    if (!bookingCheck) return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    if (bookingCheck.customerId !== customerId) return NextResponse.json({ error: "Booking and customer mismatch" }, { status: 400 });
    if (!hasStaffRole(session.user, ["ADMIN", "STAFF"]) && session.user.role !== "EMPLOYEE") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (session.user.role === "EMPLOYEE") {
      const activePhase = bookingCheck.status === "OUT_FOR_DELIVERY" ? "DROPOFF" : "PICKUP";
      const assignedToActivePhase = bookingCheck.assignments.some((assignment) =>
        assignment.userId === session.user.id && assignment.phase === activePhase
      );
      if (!assignedToActivePhase) {
        return NextResponse.json({ error: "Only the assigned employee can report this task" }, { status: 403 });
      }
    }
    const customerExists = await prisma.customer.findUnique({ where: { id: customerId }, select: { id: true } });
    if (!customerExists) return NextResponse.json({ error: "Customer not found" }, { status: 404 });

    const internalNotes = JSON.stringify({ report: type, photo: photo || null, note: note || null, reportedBy: session.user.id });

    const incident = await prisma.$transaction(async (tx) => {
      const created = await tx.incidentReport.create({
        data: {
          bookingId,
          customerId,
          type,
          description,
          priority: priority || "MEDIUM",
          internalNotes,
          timeline: {
            create: {
              action: "created",
              description: `Incident reported: ${type.replace(/_/g, " ")} - ${description.slice(0, 100)}`,
              userId: session.user.id,
            },
          },
        },
        include: {
          customer: { select: { name: true, email: true } },
          booking: { select: { referenceNumber: true } },
          timeline: true,
        },
      });

      // The decision stays pending admin review; pause tracking immediately so
      // the employee is not kept in an active trip while the admin reviews it.
      await tx.booking.update({
        where: { id: bookingId },
        data: { pickupStartedAt: null, deliveryArrivedAt: null },
      });
      return created;
    });

    try {
      await logActivity({
        userId: session.user.id,
        action: "CREATE",
        entity: "IncidentReport",
        entityId: incident.id,
        details: `Created incident report #${incident.id.slice(0, 8)} for booking ${incident.booking.referenceNumber}`,
      });
    } catch (activityError) {
      console.warn(`[INCIDENT] Creation activity log failed for ${incident.id}:`, activityError);
    }

    try {
      const admins = await prisma.user.findMany({
        where: { role: "ADMIN", isActive: true },
        select: { id: true },
      });
      await notifyNoShowReported(
        admins.map((a) => a.id),
        incident.booking.referenceNumber,
        session.user.name || "Staff member"
      );
    } catch (notificationError) {
      console.warn(`[INCIDENT] Admin notification failed for ${incident.id}:`, notificationError);
    }

    return NextResponse.json({ ...incident, trackingStopped: true }, { status: 201 });
  } catch (e) {
    console.error("Failed to create incident report:", e);
    return NextResponse.json({ error: "Failed to create incident report" }, { status: 500 });
  }
}
