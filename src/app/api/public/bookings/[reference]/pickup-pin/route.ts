import { NextResponse } from "next/server";
import { canCustomerAccessBooking, isBookingLocked } from "@/lib/booking-access";
import { prisma } from "@/lib/prisma";
import { rateLimit, requestKey } from "@/lib/rate-limit";
import { normalizeReference } from "@/lib/utils";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ reference: string }> }
) {
  const limited = await rateLimit(`customer-pickup-pin:${requestKey(request)}`, 10, 60 * 1000);
  if (!limited.allowed) {
    return NextResponse.json(
      { error: "Too many location attempts. Please wait and try again." },
      { status: 429, headers: { "Retry-After": String(limited.retryAfter) } }
    );
  }

  const { reference } = await params;
  const booking = await prisma.booking.findUnique({
    where: { referenceNumber: normalizeReference(reference) },
    select: { id: true, customerId: true, status: true },
  });
  if (!booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  if (!(await canCustomerAccessBooking(booking))) {
    return NextResponse.json({ error: "Only the verified customer can update this pickup pin" }, { status: 403 });
  }
  if (isBookingLocked(booking.status) || ["IN_STORAGE", "OUT_FOR_DELIVERY", "DELIVERED"].includes(booking.status)) {
    return NextResponse.json({ error: "The pickup pin can no longer be changed at this booking stage" }, { status: 409 });
  }

  const body = await request.json().catch(() => null);
  const latitude = body?.latitude;
  const longitude = body?.longitude;
  const accuracy = body?.accuracy;
  if (
    typeof latitude !== "number" || !Number.isFinite(latitude) || latitude < -90 || latitude > 90 ||
    typeof longitude !== "number" || !Number.isFinite(longitude) || longitude < -180 || longitude > 180
  ) {
    return NextResponse.json({ error: "Invalid pickup coordinates" }, { status: 400 });
  }
  if (typeof accuracy !== "number" || !Number.isFinite(accuracy) || accuracy < 0 || accuracy > 100) {
    return NextResponse.json({ error: "GPS accuracy must be within 100 meters. Move near an open area and try again." }, { status: 422 });
  }

  const updated = await prisma.booking.update({
    where: { id: booking.id },
    data: { pickupLat: latitude, pickupLng: longitude },
    select: { pickupLat: true, pickupLng: true },
  });
  return NextResponse.json(updated);
}
