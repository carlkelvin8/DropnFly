import type { Prisma } from "@/generated/prisma/client";

/**
 * Runs when a booking reaches DELIVERED, inside the same transaction as the status change.
 * - Every luggage item is marked DELIVERED (not left as IN_STORAGE).
 * - Every baggage tag used by the booking goes back to AVAILABLE so the physical tag can be
 *   reused. The luggage item keeps its tagNumber, so the history of which tag it carried stays.
 */
export async function finalizeDeliveredBaggage(tx: Prisma.TransactionClient, bookingId: string) {
  await tx.luggageItem.updateMany({
    where: { bookingId, status: { notIn: ["CANCELLED", "DELIVERED"] } },
    data: { status: "DELIVERED", checkOutAt: new Date() },
  });
  await tx.baggageTag.updateMany({
    where: { bookingId, status: "ASSIGNED" },
    data: { status: "AVAILABLE", bookingId: null, luggageItemId: null, assignedAt: null },
  });
}
