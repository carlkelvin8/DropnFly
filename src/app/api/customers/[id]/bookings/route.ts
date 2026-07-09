import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const bookings = await prisma.booking.findMany({
    where: { customerId: id },
    orderBy: { createdAt: "desc" },
    include: {
      assignments: {
        include: { user: { select: { name: true } } },
        take: 1,
      },
      payments: { select: { amount: true, status: true } },
    },
  });

  const mapped = bookings.map((b) => {
    const totalPaid = b.payments
      .filter((p) => p.status === "PAID")
      .reduce((sum, p) => sum + p.amount, 0);

    return {
      id: b.id,
      referenceNumber: b.referenceNumber,
      pickupLocation: b.pickupLocation,
      dropOffLocation: b.dropOffLocation,
      numberOfBags: b.numberOfBags,
      totalPrice: b.totalPrice,
      status: b.status,
      totalPaid,
      balance: b.totalPrice - totalPaid,
      rider: b.assignments[0]?.user?.name || null,
      createdAt: b.createdAt,
    };
  });

  return NextResponse.json(mapped);
}
