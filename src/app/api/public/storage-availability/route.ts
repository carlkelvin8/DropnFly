import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSystemSettings, setting } from "@/lib/settings";
import { capacityOverlapWhere, peakBagsUsed } from "@/lib/storage-capacity";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const checkIn = new Date(url.searchParams.get("checkIn") || "");
  const checkOut = new Date(url.searchParams.get("checkOut") || "");
  if (!Number.isFinite(checkIn.getTime()) || !Number.isFinite(checkOut.getTime()) || checkOut <= checkIn) {
    return NextResponse.json({ error: "A valid storage period is required" }, { status: 400 });
  }
  try {
    const settings = await getSystemSettings();
    const capacity = Math.max(0, Number.parseInt(setting(settings, "max_simultaneous_bags", "50")) || 0);
    if (!capacity) return NextResponse.json({ capacity: 0, used: 0, availableBags: null });
    const now = new Date();
    const bookings = await prisma.booking.findMany({
      where: capacityOverlapWhere({ checkIn, checkOut }, now),
      select: { checkIn: true, checkOut: true, numberOfBags: true, status: true },
    });
    const used = peakBagsUsed(bookings, { checkIn, checkOut }, now);
    return NextResponse.json({ capacity, used, availableBags: Math.max(0, capacity - used) }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Could not check storage availability" }, { status: 500 });
  }
}
