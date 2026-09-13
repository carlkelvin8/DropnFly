import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { manilaDayStart } from "@/lib/manila-time";
import { fleetCapacity, movementsOverlappingSlot, FLEET_SLOT_MINUTES, nearestAvailableSlots } from "@/lib/fleet-capacity";

const DEFAULTS = {
  max_concurrent_pickups: "1",
  max_concurrent_deliveries: "1",
  pickup_slot_duration: "60",
  delivery_slot_duration: "60",
  operating_start: "00:00",
  operating_end: "23:59",
  store_operating_days: "0,1,2,3,4,5,6",
  fleet_data: "",
};

function parseMinutes(value: string): number {
  const [h, m] = value.split(":").map(Number);
  return h * 60 + m;
}

function minutesToHHMM(minutes: number): string {
  const m = ((minutes % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

function generateSlots(start: string, end: string, durationMin: number) {
  const startMinutes = parseMinutes(start);
  // Normalize a 24-hour operation ("23:59" or "24:00") to the start of the next day so a
  // slot ending exactly at midnight is included.
  let endMinutes = parseMinutes(end);
  if (endMinutes === 1439) endMinutes = 1440;
  if (endMinutes === 0 && (end === "24:00" || end === "00:00")) endMinutes = 1440;

  const slots: { start: string; end: string }[] = [];
  let cursor = startMinutes;
  while (cursor + durationMin <= endMinutes) {
    slots.push({ start: minutesToHHMM(cursor), end: minutesToHHMM(cursor + durationMin) });
    cursor += durationMin;
  }
  return slots;
}

function manilaNowParts() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value || "00";
  return { date: `${value("year")}-${value("month")}-${value("day")}`, minutes: Number(value("hour")) * 60 + Number(value("minute")) };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const dateStr = searchParams.get("date");
  const type = searchParams.get("type") || "pickup";

  const parsedDate = dateStr ? new Date(`${dateStr}T00:00:00Z`) : null;
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr) || !["pickup", "delivery"].includes(type) || !parsedDate || !Number.isFinite(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== dateStr) {
    return NextResponse.json({ error: "Date is required" }, { status: 400 });
  }

  const settingsList = await prisma.systemSetting.findMany({
    where: { key: { in: Object.keys(DEFAULTS) } },
  });
  const settings: Record<string, string> = { ...DEFAULTS };
  for (const s of settingsList) {
    settings[s.key] = s.value;
  }

  const maxConcurrent = fleetCapacity(settings);
  const slotDuration = FLEET_SLOT_MINUTES;
  // Senior: respect admin operating hours but default to 24h (00:00-23:59) for flight-flexible service
  const operatingStart = settings.operating_start || "00:00";
  const operatingEnd = settings.operating_end || "23:59";

  const slots = generateSlots(operatingStart, operatingEnd, slotDuration);

  // Respect store_operating_days — if admin closed that weekday, return empty (with hint)
  const { manilaWeekday } = await import("@/lib/manila-time");
  const manilaDay = String(manilaWeekday(manilaDayStart(dateStr)));
  const operatingDays = (settings.store_operating_days || "0,1,2,3,4,5,6").split(",").map((s) => s.trim());
  if (!operatingDays.includes(manilaDay)) {
    return NextResponse.json({
      date: dateStr,
      type,
      maxConcurrent,
      slotDuration,
      operatingStart,
      operatingEnd,
      storeOperatingDays: settings.store_operating_days,
      slots: [],
      closedReason: "Store is closed on this weekday per admin settings",
    }, { headers: { "Cache-Control": "no-store, must-revalidate" } });
  }

  const selectedDate = manilaDayStart(dateStr);
  const nextDate = new Date(selectedDate);
  nextDate.setDate(nextDate.getDate() + 1);
  const windowStart = new Date(selectedDate.getTime() - FLEET_SLOT_MINUTES * 60000);

  const existingBookings = await prisma.booking.findMany({
    where: {
      status: { notIn: ["CANCELLED", "DELIVERED", "NO_SHOW"] },
      OR: [
        { checkIn: { gte: windowStart, lt: nextDate } },
        { checkOut: { gte: windowStart, lt: nextDate } },
      ],
    },
    select: { checkIn: true, checkOut: true },
  });

  const toMinutes = (date: Date) => (date.getTime() - selectedDate.getTime()) / 60000;
  const pickupDuration = FLEET_SLOT_MINUTES;
  const deliveryDuration = FLEET_SLOT_MINUTES;
  const movements = existingBookings.flatMap((booking) => [
    ...(booking.checkIn >= windowStart && booking.checkIn < nextDate
      ? [{ startMinutes: toMinutes(booking.checkIn), durationMinutes: pickupDuration }]
      : []),
    ...(booking.checkOut && booking.checkOut >= windowStart && booking.checkOut < nextDate
      ? [{ startMinutes: toMinutes(booking.checkOut), durationMinutes: deliveryDuration }]
      : []),
  ]);

  const manilaNow = manilaNowParts();
  const result = slots.map((slot) => {
    const slotMinutes = Number(slot.start.slice(0, 2)) * 60 + Number(slot.start.slice(3, 5));
    const booked = movementsOverlappingSlot(slotMinutes, slotDuration, movements);
    const isPast = dateStr < manilaNow.date || (dateStr === manilaNow.date && slotMinutes <= manilaNow.minutes);
    const isFull = booked >= maxConcurrent;

    return {
      start: slot.start,
      end: slot.end,
      booked,
      available: !isPast && !isFull,
      unavailableReason: isPast ? "past" : isFull ? "full" : null,
    };
  });

  return NextResponse.json(
    {
      date: dateStr,
      type,
      maxConcurrent,
      slotDuration,
      operatingStart,
      operatingEnd,
      slots: result,
      alternatives: searchParams.get("time") ? nearestAvailableSlots(result, searchParams.get("time")!) : [],
    },
    { headers: { "Cache-Control": "no-store, must-revalidate", Pragma: "no-cache" } }
  );
}
