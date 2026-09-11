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
  };

  if (!isAdmin && !isStaff) {
    where.assignments = {
      some: { userId: session.user.id },
    };
  }

  let bookings: any[] = [];
  try {
    bookings = await prisma.booking.findMany({
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
  } catch (e) {
    console.warn("[logistics/tasks] fallback due to missing columns:", (e as Error).message);
    bookings = await prisma.$queryRaw<any[]>`SELECT b.* FROM "Booking" b WHERE b.status IN ('CONFIRMED','RECEIVED','IN_STORAGE','OUT_FOR_DELIVERY') ORDER BY b."createdAt" DESC`;
    // hydrate customer/assignments manually minimal for fallback (avoid extra query complexity, return basic)
    // fallback simple: fetch customers/assignments separately if needed but return minimal mapped
    if (bookings.length) {
      const ids = bookings.map((b: any) => b.id);
      const customers = await prisma.customer.findMany({ where: { id: { in: bookings.map((b: any) => b.customerId) } }, select: { id: true, name: true, email: true, phone: true } });
      const cmap = new Map(customers.map((c) => [c.id, c]));
      const assigns = await prisma.bookingAssignment.findMany({ where: { bookingId: { in: ids } }, include: { user: { select: { id: true, name: true, profilePic: true, vehicleType: true, plateNumber: true } } } });
      const amap = new Map<string, typeof assigns>();
      for (const a of assigns) { const arr = amap.get(a.bookingId) || []; arr.push(a); amap.set(a.bookingId, arr); }
      bookings = bookings.map((b: any) => ({ ...b, customer: cmap.get(b.customerId) || { name: "", email: "", phone: "" }, assignments: amap.get(b.id) || [] }));
      // filter employee manually if needed
      if (!isAdmin && !isStaff) {
        bookings = bookings.filter((b: any) => (b.assignments as any[]).some((a) => a.userId === session.user.id));
      }
    }
  }

  const mapped = bookings.map((b: any) => {
    const taskType = logisticsTaskType(b.status);
    const activePhase = taskType === "delivery" ? "DROPOFF" : "PICKUP";
    const activeAssignment = (b.assignments as any[]).find((assignment: any) => assignment.phase === activePhase) || null;
    // Reflect the ASSIGNED vehicle (e.g. fleet unit) when present, else the rider's personal vehicle —
    // drives the map marker "logo" and the rider/vehicle display.
    const rider = activeAssignment
      ? {
          ...activeAssignment.user,
          vehicleType: activeAssignment.vehicleType || activeAssignment.user?.vehicleType || null,
          plateNumber: activeAssignment.vehiclePlate || activeAssignment.user?.plateNumber || null,
        }
      : null;

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
      pickupLat: (b as unknown as { pickupLat?: number | null }).pickupLat ?? null,
      pickupLng: (b as unknown as { pickupLng?: number | null }).pickupLng ?? null,
      dropOffLocation: b.dropOffLocation,
      dropOffLat: (b as unknown as { dropOffLat?: number | null }).dropOffLat ?? null,
      dropOffLng: (b as unknown as { dropOffLng?: number | null }).dropOffLng ?? null,
      status: b.status,
      taskType,
      rider,
      isAssignedToMe: rider?.id === session.user.id,
      createdAt: b.createdAt,
      checkIn: b.checkIn,
      checkOut: b.checkOut,
      pickupStartedAt: b.pickupStartedAt,
      deliveryArrivedAt: b.deliveryArrivedAt,
      availableActions: availableLogisticsActions(b.status, Boolean(b.pickupStartedAt), Boolean(b.deliveryArrivedAt)),
    };
  });

  return NextResponse.json(mapped);
}
