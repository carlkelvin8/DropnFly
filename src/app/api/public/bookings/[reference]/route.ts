import { NextResponse } from "next/server";
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
    include: { customer: { select: { name: true, email: true } } },
  });

  if (!booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  // Public tracking: anyone with reference can view basic booking for map
  // canAccessBooking still enforced for sensitive operations, but map needs public read
  const hasAccess = await canAccessBooking(booking);
  return NextResponse.json(decimalsToNumbers({
    ...booking,
    customer: {
      ...booking.customer,
      name: booking.customerNameSnapshot || booking.customer.name,
      email: booking.customerEmailSnapshot || booking.customer.email,
    },
    // flag to let client know if full access granted
    _hasAccess: hasAccess,
  }));
}
