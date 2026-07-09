import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";
import { notifyTaskAssigned } from "@/lib/notifications";
import { sendRiderAssignedEmail } from "@/lib/email";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await req.json();

    const booking = await prisma.booking.findUnique({
      where: { id },
      select: {
        referenceNumber: true,
        customer: { select: { name: true, email: true } },
      },
    });

    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    const assignment = await prisma.bookingAssignment.create({
      data: {
        bookingId: id,
        userId: body.userId,
      },
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

    await logActivity({
      userId: session.user.id,
      action: "ASSIGN",
      entity: "Booking",
      entityId: id,
      details: `Assigned booking to employee ${assignment.user.name}`,
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
      console.warn("Failed to send rider assigned email");
    }

    return NextResponse.json(assignment, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Failed to assign employee" },
      { status: 500 }
    );
  }
}
