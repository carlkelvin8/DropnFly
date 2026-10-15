import type { BookingStatus, Prisma } from "@/generated/prisma/client";

export class StorageCapacityError extends Error {}

/** Statuses that no longer hold bags in the facility. */
export const CAPACITY_RELEASED_STATUSES: BookingStatus[] = ["CANCELLED", "NO_SHOW", "DELIVERED"];
/** Bags physically on the premises (or on the way out) until they are delivered. */
const HELD_STATUS_LIST: BookingStatus[] = ["RECEIVED", "IN_STORAGE", "OUT_FOR_DELIVERY"];
const HELD_STATUSES = new Set<string>(HELD_STATUS_LIST);

export type CapacityBooking = { checkIn: Date; checkOut: Date | null; numberOfBags: number; status?: string };

/** A held bag whose scheduled checkout has passed is still in storage, so it keeps
 * occupying space until the booking is delivered. */
function effectiveCheckOut(booking: CapacityBooking, now: Date): Date | null {
  if (booking.checkOut && booking.status && HELD_STATUSES.has(booking.status) && booking.checkOut <= now) return null;
  return booking.checkOut;
}

/** Highest number of bags simultaneously stored in [checkIn, checkOut) by the given bookings. */
export function peakBagsUsed(bookings: CapacityBooking[], window: { checkIn: Date; checkOut: Date | null }, now = new Date()): number {
  const from = window.checkIn.getTime();
  const to = window.checkOut?.getTime() ?? Infinity;
  const events: { time: number; delta: number }[] = [];
  for (const booking of bookings) {
    const end = effectiveCheckOut(booking, now)?.getTime() ?? Infinity;
    const start = Math.max(from, booking.checkIn.getTime());
    const stop = Math.min(to, end);
    if (stop <= start) continue;
    events.push({ time: start, delta: booking.numberOfBags });
    if (Number.isFinite(stop)) events.push({ time: stop, delta: -booking.numberOfBags });
  }
  // At the same instant, process checkout before check-in so touching intervals do not overlap.
  events.sort((a, b) => a.time - b.time || a.delta - b.delta);
  let used = 0;
  let peak = 0;
  for (const event of events) {
    used += event.delta;
    if (used > peak) peak = used;
  }
  return peak;
}

/** Bookings that could overlap the window, including held bags past their checkout. */
export function capacityOverlapWhere(window: { checkIn: Date; checkOut: Date | null }, now = new Date()): Prisma.BookingWhereInput {
  return {
    status: { notIn: CAPACITY_RELEASED_STATUSES },
    checkIn: { lt: window.checkOut ?? new Date("9999-12-31T00:00:00.000Z") },
    OR: [
      { checkOut: null },
      { checkOut: { gt: window.checkIn } },
      { status: { in: HELD_STATUS_LIST }, checkOut: { lte: now } },
    ],
  };
}

/** Reserve bag capacity for the whole requested storage interval. The caller must
 * hold the shared advisory lock so simultaneous final-slot bookings serialize. */
export async function assertStorageCapacity(
  tx: Prisma.TransactionClient,
  input: { checkIn: Date; checkOut: Date | null; bags: number; capacity: number; excludeBookingId?: string },
) {
  if (input.capacity <= 0) return;
  const now = new Date();
  const active = await tx.booking.findMany({
    where: {
      ...capacityOverlapWhere(input, now),
      ...(input.excludeBookingId ? { id: { not: input.excludeBookingId } } : {}),
    },
    select: { checkIn: true, checkOut: true, numberOfBags: true, status: true },
  });
  const alreadyReserved = peakBagsUsed(active, input, now);
  if (alreadyReserved + input.bags > input.capacity) {
    const left = Math.max(0, input.capacity - alreadyReserved);
    throw new StorageCapacityError(`Sorry, we are currently unable to accept your booking for the selected date and time because our storage facility has reached its capacity (${left} of ${input.capacity} bag slots left, ${input.bags} requested). Please select another available schedule.`);
  }
}
