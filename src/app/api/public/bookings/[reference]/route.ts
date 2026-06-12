import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ reference: string }> }
) {
  const { reference } = await params;

  const booking = await prisma.booking.findUnique({
    where: { referenceNumber: reference },
    include: {
      customer: { select: { name: true, email: true } },
    },
  });

  if (!booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  return NextResponse.json(booking);
}
