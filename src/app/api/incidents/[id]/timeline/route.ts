import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendIncidentEmail } from "@/lib/email";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!["ADMIN", "STAFF"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: incidentId } = await params;

  try {
    const body = await req.json();
    const { action, description } = body;

    if (!action || !description) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const timeline = await prisma.incidentTimeline.create({
      data: {
        incidentId,
        action,
        description,
        userId: session.user.id,
      },
      include: { user: { select: { name: true } } },
    });

    // Send investigation update email to customer (async, respects SMTP settings) — only for staff/admin notes
    void (async () => {
      try {
        const incident = await prisma.incidentReport.findUnique({
          where: { id: incidentId },
          select: {
            type: true,
            status: true,
            resolution: true,
            description: true,
            customer: { select: { name: true, email: true } },
            booking: { select: { referenceNumber: true } },
          },
        });
        if (incident?.customer?.email) {
          await sendIncidentEmail({
            to: incident.customer.email,
            customerName: incident.customer.name,
            referenceNumber: incident.booking.referenceNumber,
            incidentType: incident.type,
            status: incident.status,
            resolution: incident.resolution,
            incidentId,
            description: `Investigation update: ${description}`,
          });
        }
      } catch (e) {
        if (process.env.NODE_ENV === "development") console.warn("[EMAIL] incident timeline email failed:", e);
      }
    })();

    return NextResponse.json(timeline, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to add timeline entry" }, { status: 500 });
  }
}
