import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canReadBooking } from "@/lib/staff-access";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (!(await canReadBooking(session.user, id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const booking = await prisma.booking.findUnique({
    where: { id },
    select: { referenceNumber: true, customerId: true },
  });

  if (!booking) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const paymentIds = await prisma.payment.findMany({ where: { bookingId: id }, select: { id: true } });
  const logs = await prisma.activityLog.findMany({
    where: {
      OR: [
        { entity: "Booking", entityId: id },
        { entity: "Payment", entityId: { in: paymentIds.map((payment) => payment.id) } },
        { entity: "Customer", entityId: booking.customerId },
      ],
    },
    include: { user: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json(logs);
}
