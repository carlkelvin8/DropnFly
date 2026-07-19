import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ ref: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
