import { NextResponse } from "next/server";
import { getCustomerSession } from "@/lib/customer-auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getCustomerSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const bookings = await prisma.booking.findMany({
    where: { customerId: session.id },
    orderBy: { createdAt: "desc" },
    include: {
      location: { select: { name: true, city: true } },
      payments: { select: { amount: true, status: true, method: true, paidAt: true } },
    },
  });

  return NextResponse.json(bookings);
}
