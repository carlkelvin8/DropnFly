import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_req: Request, { params }: { params: Promise<{ reference: string }> }) {
  const { reference } = await params;

  const booking = await prisma.booking.findUnique({
    where: { referenceNumber: reference },
    select: { id: true, referenceNumber: true, customerId: true, pickupLocation: true, dropOffLocation: true, status: true },
  });

  if (!booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  return NextResponse.json({ booking });
}

export async function POST(req: Request, { params }: { params: Promise<{ reference: string }> }) {
  const { reference } = await params;

  try {
    const booking = await prisma.booking.findUnique({
      where: { referenceNumber: reference },
    });

    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    const body = await req.json();
    const { type, description } = body;

    if (!type || !description) {
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
        description,
        priority: "MEDIUM",
        timeline: {
          create: {
            action: "created",
            description: `Customer report submitted: ${type.replace(/_/g, " ")}`,
          },
        },
      },
    });

    return NextResponse.json({ success: true, incidentId: incident.id }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to submit report" }, { status: 500 });
  }
}
