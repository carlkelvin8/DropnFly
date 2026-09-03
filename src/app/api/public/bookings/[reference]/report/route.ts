import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeReference } from "@/lib/utils";
import { canAccessBooking } from "@/lib/booking-access";
import { sendIncidentEmail } from "@/lib/email";

export async function GET(_req: Request, { params }: { params: Promise<{ reference: string }> }) {
  const { reference } = await params;

  const booking = await prisma.booking.findUnique({
    where: { referenceNumber: normalizeReference(reference) },
    select: { id: true, referenceNumber: true, customerId: true, pickupLocation: true, dropOffLocation: true, status: true },
  });

  if (!booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }
  if (!(await canAccessBooking(booking))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  return NextResponse.json({ booking });
}

export async function POST(req: Request, { params }: { params: Promise<{ reference: string }> }) {
  const { reference } = await params;

  try {
    const booking = await prisma.booking.findUnique({
      where: { referenceNumber: normalizeReference(reference) },
    });

    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }
    if (!(await canAccessBooking(booking))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { type, description } = body;

    if (!type || typeof description !== "string" || !description.trim() || description.length > 4000) {
      return NextResponse.json({ error: "Type and description are required" }, { status: 400 });
    }

    const validTypes = ["lost_baggage", "damaged_baggage", "service_complaint", "other"];
    if (!validTypes.includes(type)) {
      return NextResponse.json({ error: "Invalid report type" }, { status: 400 });
    }

    const incident = await prisma.incidentReport.create({
      data: {
        bookingId: booking.id,
        customerId: booking.customerId,
        type,
        description: description.trim(),
        priority: "MEDIUM",
        timeline: {
          create: {
            action: "created",
            description: `Customer report submitted: ${type.replace(/_/g, " ")}`,
          },
        },
      },
      include: {
        customer: { select: { name: true, email: true } },
      },
    });

    // Send the Incident Report Tracking email from the trusted backend after the incident is
    // committed. Incident creation and email delivery are independent: a failure to send the
    // email must never delete or duplicate the already-created incident report. We retry in the
    // background (best-effort) and always log the failure so it can be investigated.
    if (incident.customer?.email) {
      const emailPayload = {
        to: incident.customer.email,
        customerName: incident.customer.name,
        referenceNumber: booking.referenceNumber,
        incidentType: type,
        status: "PENDING",
        incidentId: incident.id,
        submittedAt: incident.submittedAt,
        description: description.trim(),
      } as const;
      sendIncidentEmail(emailPayload)
        .then(() => {
          console.log(`[EMAIL] Incident tracking email sent for ${incident.id}`);
        })
        .catch((firstError) => {
          console.error("[EMAIL] Incident tracking email first attempt failed:", firstError);
          void (async () => {
            for (let attempt = 1; attempt < 3; attempt += 1) {
              try {
                await sendIncidentEmail(emailPayload);
                console.log(`[EMAIL] Incident tracking email delivered on retry ${attempt + 1} for ${incident.id}`);
                return;
              } catch (retryError) {
                console.error(`[EMAIL] Incident tracking email retry ${attempt + 1} failed for ${incident.id}:`, retryError);
              }
            }
          })();
        });
    } else {
      console.error(`[EMAIL] Incident tracking email skipped for ${incident.id}: customer has no email address.`);
    }

    return NextResponse.json({ success: true, incidentId: incident.id, trackingNumber: `INC-${incident.id.slice(0, 8).toUpperCase()}` }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to submit report" }, { status: 500 });
  }
}
