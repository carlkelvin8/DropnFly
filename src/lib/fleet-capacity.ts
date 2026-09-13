export const FLEET_SLOT_MINUTES = 60;

export function nearestAvailableSlots<T extends { start: string; available: boolean }>(slots: T[], requested: string, limit = 2): T[] {
  const minutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
  return slots.filter((slot) => slot.available)
    .sort((a, b) => Math.abs(minutes(a.start) - minutes(requested)) - Math.abs(minutes(b.start) - minutes(requested)) || minutes(a.start) - minutes(b.start))
    .slice(0, limit);
}

export function fleetCapacity(settings: Record<string, string>): number {
  const rawFleet = settings.fleet_data;
  if (rawFleet !== undefined && rawFleet !== "") {
    try {
      const vehicles = JSON.parse(rawFleet) as { count?: unknown }[];
      if (Array.isArray(vehicles)) {
        return vehicles.reduce((sum, vehicle) => {
          const count = Number(vehicle?.count);
          return sum + (Number.isInteger(count) && count > 0 ? count : 0);
        }, 0);
      }
    } catch {
      return 0;
    }
  }

  // No registered fleet must not manufacture bookable capacity.
  return 0;
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
