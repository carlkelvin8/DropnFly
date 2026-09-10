import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { availableLogisticsActions, logisticsTaskType } from "@/lib/logistics-workflow";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const isAdmin = session.user.role === "ADMIN";
  const isStaff = session.user.role === "STAFF";

  const where: Record<string, unknown> = {
    status: { in: ["CONFIRMED", "RECEIVED", "IN_STORAGE", "OUT_FOR_DELIVERY"] },
    assignments: { some: {} },
  };

  if (!isAdmin && !isStaff) {
    where.assignments = {
      some: { userId: session.user.id },
    };
  }

  const bookings = await prisma.booking.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      customer: { select: { name: true, email: true, phone: true } },
      assignments: {
        include: { user: { select: { id: true, name: true, profilePic: true, vehicleType: true, plateNumber: true } } },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  const mapped = bookings.map((b) => {
    const taskType = logisticsTaskType(b.status);
    const activePhase = taskType === "delivery" ? "DROPOFF" : "PICKUP";
    const rider = b.assignments.find((assignment) => assignment.phase === activePhase)?.user || null;

    return {
      id: b.id,
      referenceNumber: b.referenceNumber,
      customer: {
        ...b.customer,
        name: b.customerNameSnapshot || b.customer.name,
        email: b.customerEmailSnapshot || b.customer.email,
        phone: b.customerPhoneSnapshot || b.customer.phone,
      },
      pickupLocation: b.pickupLocation,
      dropOffLocation: b.dropOffLocation,
      status: b.status,
      taskType,
      rider,
      isAssignedToMe: rider?.id === session.user.id,
      createdAt: b.createdAt,
      checkIn: b.checkIn,
      checkOut: b.checkOut,
      pickupStartedAt: b.pickupStartedAt,
      availableActions: availableLogisticsActions(b.status, Boolean(b.pickupStartedAt)),
    };
  });

  return NextResponse.json(mapped);
}
