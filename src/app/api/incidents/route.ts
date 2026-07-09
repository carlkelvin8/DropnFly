import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const priority = searchParams.get("priority");
  const type = searchParams.get("type");
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");

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
    const { bookingId, customerId, type, description, priority } = body;

    if (!bookingId || !customerId || !type || !description) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const incident = await prisma.incidentReport.create({
      data: {
        bookingId,
        customerId,
        type,
        description,
        priority: priority || "MEDIUM",
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

    await logActivity({
      userId: session.user.id,
      action: "CREATE",
      entity: "IncidentReport",
      entityId: incident.id,
      details: `Created incident report #${incident.id.slice(0, 8)} for booking ${incident.booking.referenceNumber}`,
    });

    return NextResponse.json(incident, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to create incident report" }, { status: 500 });
  }
}
