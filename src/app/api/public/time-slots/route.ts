import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const DEFAULTS = {
  max_concurrent_pickups: "1",
  max_concurrent_deliveries: "1",
  pickup_slot_duration: "60",
  delivery_slot_duration: "60",
  operating_start: "08:00",
  operating_end: "17:00",
};

function generateSlots(start: string, end: string, durationMin: number) {
  const slots: { start: string; end: string }[] = [];
  const [startH, startM] = start.split(":").map(Number);
  const [endH, endM] = end.split(":").map(Number);
  let h = startH, m = startM;
  while (h * 60 + m + durationMin <= endH * 60 + endM) {
    const slotStart = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    m += durationMin;
    h += Math.floor(m / 60);
    m = m % 60;
    const slotEnd = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    slots.push({ start: slotStart, end: slotEnd });
  }
  return slots;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const dateStr = searchParams.get("date");
  const type = searchParams.get("type") || "pickup";

  if (!dateStr) {
    return NextResponse.json({ error: "Date is required" }, { status: 400 });
  }

  const settingsList = await prisma.systemSetting.findMany({
    where: { key: { in: Object.keys(DEFAULTS) } },
  });
  const settings: Record<string, string> = { ...DEFAULTS };
  for (const s of settingsList) {
    settings[s.key] = s.value;
  }

  const isPickup = type === "pickup";
  const maxConcurrent = parseInt(isPickup ? settings.max_concurrent_pickups : settings.max_concurrent_deliveries);
  const slotDuration = parseInt(isPickup ? settings.pickup_slot_duration : settings.delivery_slot_duration);
  const operatingStart = settings.operating_start;
  const operatingEnd = settings.operating_end;

  const slots = generateSlots(operatingStart, operatingEnd, slotDuration);

  const selectedDate = new Date(dateStr + "T00:00:00.000Z");
  const nextDate = new Date(selectedDate);
  nextDate.setDate(nextDate.getDate() + 1);

  const existingBookings = await prisma.booking.findMany({
    where: {
      status: { notIn: ["CANCELLED", "DELIVERED"] },
      ...(isPickup
        ? { checkIn: { gte: selectedDate, lt: nextDate } }
        : { checkOut: { gte: selectedDate, lt: nextDate } }
      ),
    },
    select: isPickup ? { checkIn: true } : { checkOut: true },
  });

  const slotCounts: Record<string, number> = {};
  for (const slot of slots) {
    slotCounts[slot.start] = 0;
  }

  for (const b of existingBookings) {
    const dt = isPickup ? b.checkIn : b.checkOut;
    if (!dt) continue;
    const hours = dt.getUTCHours().toString().padStart(2, "0");
    const minutes = dt.getUTCMinutes().toString().padStart(2, "0");
    const timeStr = `${hours}:${minutes}`;

    for (const slot of slots) {
      if (timeStr >= slot.start && timeStr < slot.end) {
        slotCounts[slot.start] = (slotCounts[slot.start] || 0) + 1;
        break;
      }
    }
  }

  const result = slots.map((slot) => ({
    start: slot.start,
    end: slot.end,
    booked: slotCounts[slot.start] || 0,
    available: (slotCounts[slot.start] || 0) < maxConcurrent,
  }));

  return NextResponse.json({
    date: dateStr,
    type,
    maxConcurrent,
    slotDuration,
    operatingStart,
    operatingEnd,
    slots: result,
  });
}
