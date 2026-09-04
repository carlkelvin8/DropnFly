import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeReference } from "@/lib/utils";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const rawRef = searchParams.get("ref") || searchParams.get("reference");
  if (!rawRef) {
    return NextResponse.json({ error: "Reference is required" }, { status: 400 });
  }
  const ref = normalizeReference(rawRef);
  if (!ref) {
    return NextResponse.json({ valid: false, error: "Invalid reference format" }, { status: 200 });
  }
  const booking = await prisma.booking.findUnique({
    where: { referenceNumber: ref },
    select: { id: true, referenceNumber: true, status: true },
  });
  if (!booking) {
    return NextResponse.json({ valid: false, error: "Booking not found. Please check your reference." }, { status: 200 });
  }
  if (["CANCELLED", "NO_SHOW", "DELIVERED"].includes(booking.status)) {
    return NextResponse.json({ valid: false, error: `Booking ${ref} is ${booking.status.replace(/_/g, " ").toLowerCase()} and is no longer active for live chat.` }, { status: 200 });
  }
  return NextResponse.json({ valid: true, referenceNumber: booking.referenceNumber, status: booking.status });
}
