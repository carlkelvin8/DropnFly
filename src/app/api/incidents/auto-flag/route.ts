import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST() {
  const session = await auth();
  if (!session?.user || !["ADMIN", "STAFF"].includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const settings = await prisma.systemSetting.findMany();
  const get = (key: string, fallback: string) => settings.find((s) => s.key === key)?.value || fallback;

  const noScanHours = parseInt(get("auto_flag_hours_no_scan", "48"));
  const inactivityDays = parseInt(get("auto_flag_days_in_storage", "14"));
  const overdueHours = parseInt(get("auto_flag_hours_overdue_return", "24"));

  const now = new Date();
  const flags: { bookingRef: string; reason: string }[] = [];

  // 1. No scan after pickup — bookings in CONFIRMED/RECEIVED longer than threshold
  const noScanBookings = await prisma.booking.findMany({
    where: {
      status: { in: ["CONFIRMED", "RECEIVED"] },
      checkIn: { lte: new Date(now.getTime() - noScanHours * 3600000) },
      luggageItems: { none: { flag: "LOST" } },
    },
    select: { id: true, referenceNumber: true, customerId: true },
  });

  // 2. In storage without activity
  const inactiveBookings = await prisma.booking.findMany({
    where: {
      status: "IN_STORAGE",
      checkIn: { lte: new Date(now.getTime() - inactivityDays * 86400000) },
    },
    select: { id: true, referenceNumber: true, customerId: true, checkIn: true },
  });

  // 3. Overdue return — past checkOut time
  const overdueBookings = await prisma.booking.findMany({
    where: {
      status: { notIn: ["DELIVERED", "CANCELLED"] },
      checkOut: { lte: new Date(now.getTime() - overdueHours * 3600000) },
    },
    select: { id: true, referenceNumber: true, customerId: true, checkOut: true },
  });

  // Batch-fetch the latest scan for all candidate bookings in a single query
  const candidateIds = Array.from(
    new Set([...noScanBookings, ...inactiveBookings, ...overdueBookings].map((b) => b.id))
  );
  const latestScans = candidateIds.length > 0
    ? await prisma.scanEvent.findMany({
        where: { bookingId: { in: candidateIds } },
        orderBy: { scannedAt: "desc" },
      })
    : [];
  const latestScanByBooking = new Map<string, Date | null>();
  for (const scan of latestScans) {
    const existing = latestScanByBooking.get(scan.bookingId);
    if (!existing || scan.scannedAt > existing) latestScanByBooking.set(scan.bookingId, scan.scannedAt);
  }

  for (const b of noScanBookings) {
    if (!latestScanByBooking.has(b.id)) {
      flags.push({ bookingRef: b.referenceNumber, reason: `No QR scan ${noScanHours}h after pickup` });
    }
  }

  for (const b of inactiveBookings) {
    const lastScan = latestScanByBooking.get(b.id);
    if (!lastScan || (now.getTime() - lastScan.getTime()) > inactivityDays * 86400000) {
      flags.push({ bookingRef: b.referenceNumber, reason: `No activity for ${inactivityDays}d while in storage` });
    }
  }

  for (const b of overdueBookings) {
    flags.push({ bookingRef: b.referenceNumber, reason: `Overdue return — past expected check-out by ${overdueHours}h` });
  }

  // Deduplicate flags by booking reference
  const uniqueFlags = Array.from(
    new Map(flags.map((f) => [f.bookingRef, f])).values()
  );

  // Batch-fetch all flagged candidate bookings in one query
  const flagReferences = uniqueFlags.map((f) => f.bookingRef);
  const flagBookings = flagReferences.length > 0
    ? await prisma.booking.findMany({
        where: { referenceNumber: { in: flagReferences } },
        select: { id: true, referenceNumber: true, customerId: true },
      })
    : [];

  // Find which of those bookings already have an open lost_baggage flag
  const openFlaggedBookingIds = new Set<string>();
  if (flagBookings.length > 0) {
    const existingFlags = await prisma.incidentReport.findMany({
      where: {
        bookingId: { in: flagBookings.map((b) => b.id) },
        type: "lost_baggage",
        status: { in: ["PENDING", "INVESTIGATING"] },
      },
      select: { bookingId: true },
    });
    for (const e of existingFlags) openFlaggedBookingIds.add(e.bookingId);
  }

  // Create incident reports for flagged items
  let created = 0;
  for (const flag of uniqueFlags) {
    const booking = flagBookings.find((b) => b.referenceNumber === flag.bookingRef);
    if (!booking) continue;
    if (openFlaggedBookingIds.has(booking.id)) continue;

    await prisma.incidentReport.create({
      data: {
        bookingId: booking.id,
        customerId: booking.customerId,
        type: "lost_baggage",
        description: `[Auto-Flag] ${flag.reason}`,
        priority: "HIGH",
        timeline: {
          create: {
            action: "created",
            description: `Auto-flagged: ${flag.reason}`,
            userId: session.user.id,
          },
        },
      },
    });
    created++;
  }

  return NextResponse.json({
    flagged: uniqueFlags.length,
    created,
    flags: uniqueFlags.map((f) => f.reason),
  });
}
