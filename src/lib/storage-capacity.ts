import type { Prisma } from "@/generated/prisma/client";

export class StorageCapacityError extends Error {}

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
  const events = [{ time: input.checkIn.getTime(), delta: input.bags }];
  if (input.checkOut) events.push({ time: input.checkOut.getTime(), delta: -input.bags });
  for (const booking of active) {
    const start = Math.max(input.checkIn.getTime(), booking.checkIn.getTime());
    const end = Math.min(input.checkOut?.getTime() ?? Infinity, booking.status === "IN_STORAGE" ? Infinity : booking.checkOut?.getTime() ?? Infinity);
    if (end <= start) continue;
    events.push({ time: start, delta: booking.numberOfBags });
    if (Number.isFinite(end)) events.push({ time: end, delta: -booking.numberOfBags });
  }
  // At the same instant, process checkout before check-in so touching intervals do not overlap.
  events.sort((a, b) => a.time - b.time || a.delta - b.delta);
  let used = 0;
  for (const event of events) {
    used += event.delta;
    if (used > input.capacity) {
      throw new StorageCapacityError(`Sorry, we are currently unable to accept your booking for the selected date and time because our storage facility has reached its capacity. Please select another available schedule.`);
    }
  }
}
