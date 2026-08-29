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

    // Send confirmation email with Report Details and Tracking Number (async, don't block response on SMTP failure)
    if (incident.customer?.email) {
      void sendIncidentEmail({
        to: incident.customer.email,
        customerName: incident.customer.name,
        referenceNumber: booking.referenceNumber,
        incidentType: type,
        status: "PENDING",
        incidentId: incident.id,
        description: description.trim(),
      }).catch((e) => {
        if (process.env.NODE_ENV === "development") console.warn("[EMAIL] incident submission email failed:", e);
      });
    }

    return NextResponse.json({ success: true, incidentId: incident.id, trackingNumber: `INC-${incident.id.slice(0, 8).toUpperCase()}` }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to submit report" }, { status: 500 });
  }
}
