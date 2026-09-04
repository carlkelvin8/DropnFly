import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";
import { notifyTaskAssigned } from "@/lib/notifications";
import { sendRiderAssignedEmail } from "@/lib/email";
import { isBookingLocked } from "@/lib/booking-access";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!["ADMIN", "STAFF"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { id } = await params;
    const body = await req.json();

    const booking = await prisma.booking.findUnique({
      where: { id },
      select: {
        referenceNumber: true,
        status: true,
        customer: { select: { name: true, email: true } },
      },
    });

    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    if (isBookingLocked(booking.status)) {
      return NextResponse.json({ error: "This booking is locked and cannot be reassigned" }, { status: 409 });
    }

    const phase = body.phase === "DROPOFF" ? "DROPOFF" : "PICKUP";
    const rider = await prisma.user.findFirst({
      where: { id: body.userId, role: "EMPLOYEE", isActive: true, isApproved: true },
      select: { id: true },
    });
    if (!rider) return NextResponse.json({ error: "Select an active employee account" }, { status: 400 });

    const assignment = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`assignment:${id}:${phase}`}))`;
      await tx.bookingAssignment.deleteMany({ where: { bookingId: id, phase } });
      return tx.bookingAssignment.create({
        data: { bookingId: id, userId: body.userId, phase },
        include: {
          user: {
            select: {
              name: true,
              profilePic: true,
              vehicleType: true,
              plateNumber: true,
            },
          },
        },
      });
    });

    await logActivity({
      userId: session.user.id,
      action: "ASSIGN",
      entity: "Booking",
      entityId: id,
      details: `Assigned ${phase.toLowerCase()} to employee ${assignment.user.name}`,
    });

    await notifyTaskAssigned(body.userId, booking.referenceNumber);

    // Send email to customer with rider details
    try {
      await sendRiderAssignedEmail({
        to: booking.customer.email,
        customerName: booking.customer.name,
        referenceNumber: booking.referenceNumber,
        riderName: assignment.user.name,
        riderProfilePic: assignment.user.profilePic,
        vehicleType: assignment.user.vehicleType,
        plateNumber: assignment.user.plateNumber,
      });
    } catch {
      if (process.env.NODE_ENV === "development") {
        console.warn("Failed to send rider assigned email");
      }
    }

    return NextResponse.json(assignment, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Failed to assign employee" },
      { status: 500 }
    );
  }
}
