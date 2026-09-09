export function fleetCapacity(settings: Record<string, string>): number {
  const rawFleet = settings.fleet_data;
  if (rawFleet !== undefined && rawFleet !== "") {
    try {
      const vehicles = JSON.parse(rawFleet) as { count?: unknown }[];
      if (Array.isArray(vehicles)) {
        // Empty fleet means "not configured" — fall through to legacy concurrency
        // so stale defaults "[]" don't block all bookings with 0 capacity.
        if (vehicles.length === 0) {
          // intentional fall-through
        } else {
          const total = vehicles.reduce((sum, vehicle) => {
            const count = Number(vehicle?.count);
            return sum + (Number.isFinite(count) && count > 0 ? Math.floor(count) : 0);
          }, 0);
          // If every entry has 0/invalid count, treat as not configured to avoid
          // silently blocking every slot with capacity 0.
          if (total > 0) return total;
        }
      }
    } catch {
      // Fall through to legacy concurrency settings for malformed old data.
    }
  }

  const pickups = Math.max(1, parseInt(settings.max_concurrent_pickups || "1") || 1);
  const deliveries = Math.max(1, parseInt(settings.max_concurrent_deliveries || "1") || 1);
  return Math.min(pickups, deliveries);
}

export function movementsOverlappingSlot(
  slotStartMinutes: number,
  slotDurationMinutes: number,
  movements: { startMinutes: number; durationMinutes: number }[]
): number {
  const slotEnd = slotStartMinutes + slotDurationMinutes;
  return movements.filter((movement) =>
    movement.startMinutes < slotEnd &&
    movement.startMinutes + movement.durationMinutes > slotStartMinutes
  ).length;
}
