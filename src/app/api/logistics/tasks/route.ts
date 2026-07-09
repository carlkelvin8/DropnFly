import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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
        take: 1,
      },
    },
  });

  const mapped = bookings.map((b) => {
    const rider = b.assignments[0]?.user || null;
    const taskType = b.status === "OUT_FOR_DELIVERY" ? "delivery"
      : b.status === "CONFIRMED" ? "pickup"
      : "processing";

    return {
      id: b.id,
      referenceNumber: b.referenceNumber,
      customer: b.customer,
      pickupLocation: b.pickupLocation,
      dropOffLocation: b.dropOffLocation,
      status: b.status,
      taskType,
      rider,
      isAssignedToMe: rider?.id === session.user.id,
      createdAt: b.createdAt,
    };
  });

  return NextResponse.json(mapped);
}
