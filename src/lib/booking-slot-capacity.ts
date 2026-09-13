import type { Prisma } from "@/generated/prisma/client";
import { fleetCapacity, FLEET_SLOT_MINUTES } from "./fleet-capacity";
import { manilaDateStr, manilaMinutesOfDay, manilaWeekday } from "./manila-time";

export class BookingSlotError extends Error {}

/** Schedule edits share creation's day locks; exclude the booking being moved. */
export async function assertScheduleCapacity(tx: Prisma.TransactionClient, dates: Date[], bookingId: string) {
  for (const key of [...new Set(dates.map((date) => `fleet-slot:${manilaDateStr(date)}`))].sort()) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`;
  }
  const rows = await tx.systemSetting.findMany();
  const settings = Object.fromEntries(rows.map((row) => [row.key, row.value]));
  const capacity = fleetCapacity(settings);
  const minutes = (value: string) => { const [hour, minute] = value.split(":").map(Number); return hour * 60 + minute; };
  const start = minutes(settings.operating_start || "00:00");
  const rawEnd = minutes(settings.operating_end || "23:59");
  const end = rawEnd === 1439 || rawEnd === 0 ? 1440 : rawEnd;
  for (const date of dates) {
    const time = manilaMinutesOfDay(date);
    if (date <= new Date() || date.getUTCSeconds() !== 0 || date.getUTCMilliseconds() !== 0 || time < start || time + FLEET_SLOT_MINUTES > end || (time - start) % FLEET_SLOT_MINUTES !== 0) {
      throw new BookingSlotError("Choose a future hourly time slot within operating hours.");
    }
    if (!(settings.store_operating_days || "0,1,2,3,4,5,6").split(",").map((day) => day.trim()).includes(String(manilaWeekday(date)))) {
      throw new BookingSlotError("Store is closed on the selected date.");
    }
    const from = new Date(date.getTime() - FLEET_SLOT_MINUTES * 60000);
    const until = new Date(date.getTime() + FLEET_SLOT_MINUTES * 60000);
    const bookings = await tx.booking.findMany({
      where: { id: { not: bookingId }, status: { notIn: ["CANCELLED", "NO_SHOW", "DELIVERED"] }, OR: [{ checkIn: { gt: from, lt: until } }, { checkOut: { gt: from, lt: until } }] },
      select: { checkIn: true, checkOut: true },
    });
    const used = bookings.flatMap((booking) => [booking.checkIn, booking.checkOut]).filter((movement) => movement && movement > from && movement < until).length;
    if (used >= capacity) throw new BookingSlotError("TIME SLOT FULL. Please choose another hourly slot.");
  }
}
