import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSystemSettings, setting } from "@/lib/settings";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const checkIn = new Date(url.searchParams.get("checkIn") || "");
  const checkOut = new Date(url.searchParams.get("checkOut") || "");
  if (!Number.isFinite(checkIn.getTime()) || !Number.isFinite(checkOut.getTime()) || checkOut <= checkIn) {
    return NextResponse.json({ error: "A valid storage period is required" }, { status: 400 });
  }
  try {
    const settings = await getSystemSettings();
    const capacity = Math.max(0, Number.parseInt(setting(settings, "max_simultaneous_bags", "0")) || 0);
    if (!capacity) return NextResponse.json({ capacity: 0, used: 0, availableBags: null });
    const bookings = await prisma.booking.findMany({
      where: { status: { notIn: ["CANCELLED", "NO_SHOW", "DELIVERED"] }, checkIn: { lt: checkOut }, OR: [{ checkOut: null }, { checkOut: { gt: checkIn } }] },
      select: { checkIn: true, checkOut: true, numberOfBags: true },
    });
    const points = [checkIn.getTime(), ...bookings.map((b) => Math.max(checkIn.getTime(), b.checkIn.getTime())).filter((t) => t < checkOut.getTime())];
    const used = Math.max(0, ...points.map((at) => bookings.reduce((sum, b) => sum + (b.checkIn.getTime() <= at && (!b.checkOut || b.checkOut.getTime() > at) ? b.numberOfBags : 0), 0)));
    return NextResponse.json({ capacity, used, availableBags: Math.max(0, capacity - used) }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Could not check storage availability" }, { status: 500 });
  }
}
