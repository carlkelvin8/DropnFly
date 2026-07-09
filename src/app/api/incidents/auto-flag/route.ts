import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
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

  for (const b of noScanBookings) {
    const lastScan = await prisma.scanEvent.findFirst({
      where: { bookingId: b.id },
      orderBy: { scannedAt: "desc" },
    });
    if (!lastScan) {
      flags.push({ bookingRef: b.referenceNumber, reason: `No QR scan ${noScanHours}h after pickup` });
    }
  }

  // 2. In storage without activity
  const inactiveBookings = await prisma.booking.findMany({
    where: {
      status: "IN_STORAGE",
      checkIn: { lte: new Date(now.getTime() - inactivityDays * 86400000) },
    },
    select: { id: true, referenceNumber: true, customerId: true, checkIn: true },
  });

  for (const b of inactiveBookings) {
    const lastScan = await prisma.scanEvent.findFirst({
      where: { bookingId: b.id },
      orderBy: { scannedAt: "desc" },
    });
    if (!lastScan || (lastScan.scannedAt && (now.getTime() - lastScan.scannedAt.getTime()) > inactivityDays * 86400000)) {
      flags.push({ bookingRef: b.referenceNumber, reason: `No activity for ${inactivityDays}d while in storage` });
    }
  }

  // 3. Overdue return — past checkOut time
  const overdueBookings = await prisma.booking.findMany({
    where: {
      status: { notIn: ["DELIVERED", "CANCELLED"] },
      checkOut: { lte: new Date(now.getTime() - overdueHours * 3600000) },
    },
    select: { id: true, referenceNumber: true, customerId: true, checkOut: true },
  });

  for (const b of overdueBookings) {
    flags.push({ bookingRef: b.referenceNumber, reason: `Overdue return — past expected check-out by ${overdueHours}h` });
  }

  // Create incident reports for flagged items
  let created = 0;
  for (const flag of flags) {
    const booking = await prisma.booking.findUnique({
      where: { referenceNumber: flag.bookingRef },
      select: { id: true, customerId: true },
    });
    if (!booking) continue;

    const existingFlag = await prisma.incidentReport.findFirst({
      where: { bookingId: booking.id, type: "lost_baggage", status: { in: ["PENDING", "INVESTIGATING"] } },
    });
    if (existingFlag) continue; // already flagged

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
    flagged: flags.length,
    created,
    flags: flags.map((f) => f.reason),
  });
}
