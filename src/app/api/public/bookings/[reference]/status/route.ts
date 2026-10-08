import { NextResponse } from "next/server";
import { photoVersions, riderPhotoUrl } from "@/lib/rider-photo";
import { getFleetVehicleColor } from "@/lib/fleet-vehicle";
import { prisma } from "@/lib/prisma";
import { normalizeReference } from "@/lib/utils";
import { canAccessBooking } from "@/lib/booking-access";
import { decimalsToNumbers } from "@/lib/serialize";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ reference: string }> }
) {
  const { reference } = await params;

  const booking = await prisma.booking.findUnique({
    where: { referenceNumber: normalizeReference(reference) },
    // The tracker polls this every few seconds and never reads these large base64 fields.
    omit: { qrCode: true, luggagePhotos: true },
    include: {
      customer: { select: { name: true, email: true } },
      // The customer's own feedback, shown on their tracking page.
      review: { select: { rating: true, comment: true, createdAt: true } },
    },
  });

  if (!booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  if (!(await canAccessBooking(booking))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [assignment, scans] = await Promise.all([
    prisma.bookingAssignment.findFirst({
      where: {
        bookingId: booking.id,
        phase:
          booking.status === "OUT_FOR_DELIVERY" || booking.status === "DELIVERED"
            ? "DROPOFF"
            : "PICKUP",
      },
      orderBy: { createdAt: "desc" },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            vehicleType: true,
            plateNumber: true,
            currentLat: true,
            currentLng: true,
            lastLocationUpdate: true,
          },
        },
      },
    }),
    prisma.scanEvent.findMany({
      where: { bookingId: booking.id },
      orderBy: { scannedAt: "asc" },
      include: { user: { select: { name: true } } },
    }),
  ]);

  // Security: do not expose the rider's live coordinates before the employee
  // has started the task. Tracking only becomes visible once pickupStartedAt is set.
  const trackable = Boolean(booking.pickupStartedAt);
  // Do not serialize the employee at all before Start Pickup/Delivery. Hiding
  // the card in React is not a security boundary; the API response must also
  // withhold identity, vehicle and location fields.
  // Show the vehicle assigned for this booking (type, plate, color from the registered fleet), not the
  // legacy vehicle fields on the employee profile.
  const vehicleColor = trackable ? await getFleetVehicleColor(assignment?.vehicleId) : null;
  const rider = trackable && assignment?.user
    ? {
        ...assignment.user,
        profilePic: riderPhotoUrl(assignment.user.id, (await photoVersions([assignment.user.id])).get(assignment.user.id)),
        vehicleType: assignment.vehicleType || null,
        plateNumber: assignment.vehiclePlate || null,
        vehicleColor,
        phase: assignment.phase,
      }
    : null;

  return NextResponse.json({
    booking: decimalsToNumbers({
      ...booking,
      customer: {
        ...booking.customer,
        name: booking.customerNameSnapshot || booking.customer.name,
        email: booking.customerEmailSnapshot || booking.customer.email,
      },
    }),
    rider,
    scans,
  });
}
