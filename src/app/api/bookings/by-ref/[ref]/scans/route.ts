import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ ref: string }> }
) {
  const { ref } = await params;

  const booking = await prisma.booking.findUnique({
    where: { referenceNumber: ref },
    select: { id: true },
  });

  if (!booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  const scans = await prisma.scanEvent.findMany({
    where: { bookingId: booking.id },
    orderBy: { scannedAt: "asc" },
    include: {
      user: { select: { name: true } },
    },
  });

  return NextResponse.json(scans);
}
