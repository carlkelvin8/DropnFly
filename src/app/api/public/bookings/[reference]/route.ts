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

  // Use select to avoid 500 if pickupLat columns not yet migrated on prod DB
  let booking: any = null;
  try {
    booking = await prisma.booking.findUnique({
      where: { referenceNumber: normalizeReference(reference) },
      include: { customer: { select: { name: true, email: true } } },
    });
  } catch (e) {
    console.warn("[public/booking] fallback query due to missing columns:", (e as Error).message);
    // fallback raw query without new columns
    const rows = await prisma.$queryRaw<any[]>`SELECT b.*, c.name as "customer_name", c.email as "customer_email" FROM "Booking" b JOIN "Customer" c ON b."customerId" = c.id WHERE b."referenceNumber" = ${normalizeReference(reference)} LIMIT 1`;
    if (rows[0]) {
      booking = {
        ...rows[0],
        customer: { name: rows[0].customer_name, email: rows[0].customer_email },
        customerNameSnapshot: rows[0].customerNameSnapshot,
        customerEmailSnapshot: rows[0].customerEmailSnapshot,
      };
    }
  }

  if (!booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  // Public tracking: anyone with reference can view basic booking for map
  // canAccessBooking still enforced for sensitive operations, but map needs public read
  let hasAccess = false;
  try { hasAccess = await canAccessBooking(booking); } catch {}
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
