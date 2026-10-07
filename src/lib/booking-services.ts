// Client-safe: deliberately does not import ./pricing (which pulls in server-only settings).
function servicesOf(luggageDetails: string | null | undefined): string[] {
  try {
    const parsed = JSON.parse(luggageDetails || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((entry) => (entry && Array.isArray(entry.services) ? entry.services.map((s: unknown) => String(s).trim()) : []));
  } catch {
    return [];
  }
}

export const PICKUP_SERVICE = "Pick-up from Customer";
export const DELIVERY_SERVICE = "Deliver to Customer";

/** True when the customer did not avail delivery and will claim the luggage at the storage facility. */
export function isSelfPickup(luggageDetails: string | null | undefined): boolean {
  return !servicesOf(luggageDetails).includes(DELIVERY_SERVICE);
}

/** True when the customer did not avail pick-up and brings the luggage to the storage facility. */
export function isSelfDropoff(luggageDetails: string | null | undefined): boolean {
  return !servicesOf(luggageDetails).includes(PICKUP_SERVICE);
}

/** The final status reads "Claimed by Customer" when the customer picked the luggage up at storage. */
export function bookingStatusLabel(status: string, selfPickup = false): string {
  if (status === "DELIVERED" && selfPickup) return "Claimed by Customer";
  return status.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}
