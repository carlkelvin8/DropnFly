import { prisma } from "./prisma";

/** Color of a registered fleet vehicle (stored in the `fleet_data` setting), or null when unknown. */
export async function getFleetVehicleColor(vehicleId: string | null | undefined): Promise<string | null> {
  if (!vehicleId) return null;
  try {
    const setting = await prisma.systemSetting.findUnique({ where: { key: "fleet_data" } });
    const fleet = setting?.value ? (JSON.parse(setting.value) as Array<{ id: string; color?: string }>) : [];
    return fleet.find((vehicle) => vehicle.id === vehicleId)?.color || null;
  } catch {
    return null;
  }
}
