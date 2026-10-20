import type { Prisma } from "@/generated/prisma/client";

export class StorageCapacityError extends Error {}

type OccupyingBooking = { checkIn: Date; checkOut: Date | null; numberOfBags: number; status: string };

/** Highest number of bags already occupying storage at any moment of [checkIn, checkOut).
 * A stored bag frees its slot at its own planned checkout; only once that time has passed
 * without delivery does it keep the slot until staff deliver it. */
export function peakStorageUsage(bookings: OccupyingBooking[], checkIn: Date, checkOut: Date | null, now = new Date()) {
  const windowEnd = checkOut?.getTime() ?? Infinity;
  const events: { time: number; delta: number }[] = [];
  for (const booking of bookings) {
    const planned = booking.checkOut?.getTime() ?? Infinity;
    const holdsUntil = booking.status === "IN_STORAGE" && planned <= now.getTime() ? Infinity : planned;
    const start = Math.max(checkIn.getTime(), booking.checkIn.getTime());
    const end = Math.min(windowEnd, holdsUntil);
    if (end <= start) continue;
    events.push({ time: start, delta: booking.numberOfBags });
    if (Number.isFinite(end)) events.push({ time: end, delta: -booking.numberOfBags });
  }
  // At the same instant, process checkout before check-in so touching intervals do not overlap.
  events.sort((x, y) => x.time - y.time || x.delta - y.delta);
  let used = 0;
  let peak = 0;
  for (const event of events) {
    used += event.delta;
    peak = Math.max(peak, used);
  }
  return peak;
}

/** Reserve bag capacity for the whole requested storage interval. The caller must
 * hold the shared advisory lock so simultaneous final-slot bookings serialize. */
export async function assertStorageCapacity(
  tx: Prisma.TransactionClient,
  input: { checkIn: Date; checkOut: Date | null; bags: number; capacity: number; excludeBookingId?: string },
) {
  if (input.capacity <= 0) return;
  const active = await tx.booking.findMany({
    where: {
      status: { notIn: ["CANCELLED", "NO_SHOW", "DELIVERED"] },
      ...(input.excludeBookingId ? { id: { not: input.excludeBookingId } } : {}),
      OR: [
        // A bag physically in storage continues using a slot until staff deliver it,
        // even if its planned checkout time has passed.
        { status: "IN_STORAGE", checkIn: { lt: input.checkOut ?? new Date("9999-12-31T00:00:00.000Z") } },
        {
          status: { not: "IN_STORAGE" },
          checkIn: { lt: input.checkOut ?? new Date("9999-12-31T00:00:00.000Z") },
          OR: [{ checkOut: null }, { checkOut: { gt: input.checkIn } }],
        },
      ],
    },
    select: { checkIn: true, checkOut: true, numberOfBags: true, status: true },
  });
  const used = peakStorageUsage(active, input.checkIn, input.checkOut) + input.bags;
  if (used > input.capacity) {
    throw new StorageCapacityError(`Sorry, we are currently unable to accept your booking for the selected date and time because our storage facility has reached its capacity. Please select another available schedule.`);
  }
}
