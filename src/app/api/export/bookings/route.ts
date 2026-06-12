import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const bookings = await prisma.booking.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      customer: { select: { name: true, email: true } },
    },
  });

  const escapeCsv = (val: string) => {
    if (/^[=+\-@\t]/.test(val)) return `"${val}"`;
    return `"${val}"`;
  };

  const header = "Reference,Customer,Email,Pickup,Drop-off,Bags,Total,Status,Created\n";
  const rows = bookings
    .map(
      (b) =>
        `${b.referenceNumber},${escapeCsv(b.customer.name)},${b.customer.email},${escapeCsv(b.pickupLocation)},${escapeCsv(b.dropOffLocation)},${b.numberOfBags},${b.totalPrice},${b.status},${b.createdAt.toISOString()}`
    )
    .join("\n");

  return new NextResponse(header + rows, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": 'attachment; filename="bookings.csv"',
    },
  });
}
