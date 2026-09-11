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
      select: { id: true, vehicleType: true, plateNumber: true },
    });
    if (!rider) return NextResponse.json({ error: "Select an active employee account" }, { status: 400 });

    // Vehicle is separate from employee — use fleet selection if provided, else fallback to employee's vehicle
    let vehicleId: string | null = typeof body.vehicleId === "string" && body.vehicleId ? body.vehicleId : null;
    let vehicleType: string | null = typeof body.vehicleType === "string" && body.vehicleType ? body.vehicleType : null;
    let vehiclePlate: string | null = typeof body.vehiclePlate === "string" && body.vehiclePlate ? body.vehiclePlate : null;

    // If fleet vehicle selected, validate against fleet_data and expand vehicle details
    if (vehicleId) {
      try {
        const settings = await prisma.systemSetting.findUnique({ where: { key: "fleet_data" } });
        const fleet = settings?.value ? JSON.parse(settings.value) as Array<{ id: string; type: string; plateNumber: string; color?: string; count: number }> : [];
        const found = fleet.find((v) => v.id === vehicleId);
        if (found) {
          vehicleType = found.type;
          vehiclePlate = found.plateNumber || vehiclePlate;
        }
      } catch {}
    }
    // Fallback to employee's registered vehicle if no fleet vehicle chosen
    if (!vehicleType) vehicleType = rider.vehicleType || null;
    if (!vehiclePlate) vehiclePlate = rider.plateNumber || null;

    // Check vehicle availability — prevent double-booking same plate on overlapping dates
    if (vehiclePlate) {
      const bookingForVehicleCheck = await prisma.booking.findUnique({ where: { id }, select: { checkIn: true, checkOut: true } });
      if (bookingForVehicleCheck) {
        const overlapping = await prisma.bookingAssignment.findFirst({
          where: {
            vehiclePlate,
            bookingId: { not: id },
            booking: {
              status: { in: ["CONFIRMED", "RECEIVED", "IN_STORAGE", "OUT_FOR_DELIVERY"] },
              OR: [
                { checkIn: { gte: bookingForVehicleCheck.checkIn, lt: bookingForVehicleCheck.checkOut || undefined } },
                { checkOut: { gte: bookingForVehicleCheck.checkIn, lt: bookingForVehicleCheck.checkOut || undefined } },
              ],
            },
          },
          select: { bookingId: true },
        });
        if (overlapping) {
          return NextResponse.json({ error: `Vehicle ${vehiclePlate} is already assigned to another active booking in this period` }, { status: 409 });
        }
      }
    }

    const assignment = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`assignment:${id}:${phase}`}))`;
      if (vehiclePlate) {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`vehicle:${vehiclePlate}`}))`;
      }
      await tx.bookingAssignment.deleteMany({ where: { bookingId: id, phase } });
      return tx.bookingAssignment.create({
        data: { bookingId: id, userId: body.userId, phase, vehicleId, vehicleType, vehiclePlate },
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
      details: `Assigned ${phase.toLowerCase()} to employee ${assignment.user.name}${assignment.vehiclePlate ? ` + vehicle ${assignment.vehiclePlate} (${assignment.vehicleType || "vehicle"})` : ""}`,
    });

    await notifyTaskAssigned(body.userId, booking.referenceNumber);

    // Send email to customer with rider + separate vehicle details
    try {
      await sendRiderAssignedEmail({
        to: booking.customer.email,
        customerName: booking.customer.name,
        referenceNumber: booking.referenceNumber,
        riderName: assignment.user.name,
        riderProfilePic: assignment.user.profilePic,
        vehicleType: assignment.vehicleType || assignment.user.vehicleType,
        plateNumber: assignment.vehiclePlate || assignment.user.plateNumber,
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
