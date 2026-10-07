import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { availableLogisticsActions, resolveTaskAssignment } from "@/lib/logistics-workflow";
import { parseLuggageDetails } from "@/lib/pricing";

interface RiderUser { id: string; name: string; isActive?: boolean; profilePic: string | null; vehicleType: string | null; plateNumber: string | null }
interface AssignmentRow { userId: string; phase: string; vehicleType?: string | null; vehiclePlate?: string | null; user: RiderUser }
interface BookingRow {
  id: string;
  referenceNumber: string;
  customerId: string;
  customer: { name: string; email: string; phone: string };
  customerNameSnapshot?: string | null;
  customerEmailSnapshot?: string | null;
  customerPhoneSnapshot?: string | null;
  luggageDetails?: string | null;
  pickupLocation: string;
  dropOffLocation: string;
  pickupLat?: number | null;
  pickupLng?: number | null;
  dropOffLat?: number | null;
  dropOffLng?: number | null;
  status: string;
  createdAt: Date;
  checkIn: Date;
  checkOut: Date | null;
  pickupStartedAt: Date | null;
  deliveryArrivedAt: Date | null;
  assignments: AssignmentRow[];
  scanEvents?: Array<{ status: string }>;
}

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const isAdmin = session.user.role === "ADMIN";
  const isStaff = session.user.role === "STAFF";

  const where: Record<string, unknown> = {
    status: { in: ["CONFIRMED", "RECEIVED", "IN_STORAGE", "OUT_FOR_DELIVERY"] },
    // A no-show/cancellation report pauses the operational task immediately.
    // If an admin dismisses it, the incident becomes CLOSED and the task
    // automatically returns on the next poll. Accepted reports remain hidden
    // because the booking itself becomes terminal.
    incidentReports: {
      none: {
        type: { in: ["no_show", "cancellation"] },
        status: { in: ["PENDING", "INVESTIGATING"] },
      },
    },
  };

  if (!isAdmin && !isStaff) {
    where.assignments = {
      some: { userId: session.user.id },
    };
  }

  let bookings: BookingRow[] = [];
  try {
    bookings = (await prisma.booking.findMany({
      where,
      orderBy: { createdAt: "desc" },
      // Large base64 fields that this endpoint never returns.
      omit: { qrCode: true, luggagePhotos: true },
      include: {
        customer: { select: { name: true, email: true, phone: true } },
        assignments: {
          include: { user: { select: { id: true, name: true, profilePic: true, vehicleType: true, plateNumber: true, isActive: true } } },
          orderBy: { createdAt: "desc" },
        },
        scanEvents: {
          where: { status: { in: ["ARRIVED_PICKUP", "PICKUP_COMPLETED"] } },
          select: { id: true, status: true },
        },
      },
    })) as unknown as BookingRow[];
  } catch (e) {
    console.warn("[logistics/tasks] fallback due to missing columns:", (e as Error).message);
    bookings = await prisma.$queryRaw<BookingRow[]>`
      SELECT b.*
      FROM "Booking" b
      WHERE b.status IN ('CONFIRMED','RECEIVED','IN_STORAGE','OUT_FOR_DELIVERY')
        AND NOT EXISTS (
          SELECT 1
          FROM "IncidentReport" i
          WHERE i."bookingId" = b.id
            AND i.type IN ('no_show', 'cancellation')
            AND i.status IN ('PENDING', 'INVESTIGATING')
        )
      ORDER BY b."createdAt" DESC
    `;
    // hydrate customer/assignments manually minimal for fallback (avoid extra query complexity, return basic)
    // fallback simple: fetch customers/assignments separately if needed but return minimal mapped
    if (bookings.length) {
      const ids = bookings.map((b) => b.id);
      const customers = await prisma.customer.findMany({ where: { id: { in: bookings.map((b) => b.customerId) } }, select: { id: true, name: true, email: true, phone: true } });
      const cmap = new Map(customers.map((c) => [c.id, c]));
      const assigns = await prisma.bookingAssignment.findMany({ where: { bookingId: { in: ids } }, include: { user: { select: { id: true, name: true, profilePic: true, vehicleType: true, plateNumber: true, isActive: true } } } });
      const scanEvents = await prisma.scanEvent.findMany({
        where: { bookingId: { in: ids }, status: { in: ["ARRIVED_PICKUP", "PICKUP_COMPLETED"] } },
        select: { id: true, bookingId: true, status: true },
      });
      const amap = new Map<string, typeof assigns>();
      for (const a of assigns) { const arr = amap.get(a.bookingId) || []; arr.push(a); amap.set(a.bookingId, arr); }
      const emap = new Map<string, typeof scanEvents>();
      for (const event of scanEvents) { const arr = emap.get(event.bookingId) || []; arr.push(event); emap.set(event.bookingId, arr); }
      bookings = bookings.map((b) => ({
        ...b,
        customer: cmap.get(b.customerId) || { name: "", email: "", phone: "" },
        assignments: amap.get(b.id) || [],
        scanEvents: emap.get(b.id) || [],
      }));
      // filter employee manually if needed
      if (!isAdmin && !isStaff) {
        bookings = bookings.filter((b) => b.assignments.some((a) => a.userId === session.user.id));
      }
    }
  }

  // A completed pickup remains RECEIVED until warehouse intake. It is no
  // longer an active transport task during that waiting period.
  bookings = bookings.filter((b) => !(
    b.status === "RECEIVED" &&
    (b.scanEvents as Array<{ status: string }> | undefined)?.some((event) => event.status === "PICKUP_COMPLETED")
  ));

  const mapped = bookings.map((b) => {
    const services = parseLuggageDetails(b.luggageDetails || "").services;
    // A deactivated employee can no longer work the task, so treat it as unassigned
    // (admin sees "need a rider" and can reassign).
    const validAssignments = b.assignments.filter((assignment) =>
      assignment.user.isActive !== false && (
        (assignment.phase === "PICKUP" && services.includes("Pick-up from Customer")) ||
        (assignment.phase === "DROPOFF" && services.includes("Deliver to Customer"))
      )
    );
    const { assignment: shownAssignment, taskType: shownTaskType, isUpcoming } = resolveTaskAssignment(
      validAssignments, b.status, session.user.id, isAdmin || isStaff
    );
    // Reflect only a registered fleet vehicle. Legacy employee profile vehicle
    // fields are intentionally ignored for assignment and logistics display.
    const rider = shownAssignment
      ? {
          ...shownAssignment.user,
          id: shownAssignment.userId,
          vehicleType: shownAssignment.vehicleType || null,
          plateNumber: shownAssignment.vehiclePlate || null,
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
      taskType: shownTaskType,
      rider,
      isAssignedToMe: rider?.id === session.user.id,
      isUpcoming,
      createdAt: b.createdAt,
      checkIn: b.checkIn,
      checkOut: b.checkOut,
      // Upcoming (not yet active) tasks must not look started or trigger GPS publishing.
      pickupStartedAt: isUpcoming || b.status === "IN_STORAGE" ? null : b.pickupStartedAt,
      deliveryArrivedAt: isUpcoming ? null : b.deliveryArrivedAt,
      availableActions: isUpcoming ? [] : availableLogisticsActions(
        b.status,
        Boolean(b.pickupStartedAt),
        Boolean(b.deliveryArrivedAt),
        (b.scanEvents as Array<{ status: string }> | undefined)?.some((event) => event.status === "ARRIVED_PICKUP") ?? false,
        (b.scanEvents as Array<{ status: string }> | undefined)?.some((event) => event.status === "PICKUP_COMPLETED") ?? false,
      ),
    };
  });

  // Employees only receive their own (active or upcoming) tasks. Bookings where they handled an
  // earlier phase are not theirs to act on and would expose another employee's customer details.
  return NextResponse.json(isAdmin || isStaff ? mapped : mapped.filter((task) => task.isAssignedToMe));
}
