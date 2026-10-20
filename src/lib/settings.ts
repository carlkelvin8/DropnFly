import { prisma } from "./prisma";
import { revalidateTag, unstable_cache } from "next/cache";

const SETTINGS_CACHE_TAG = "system-settings";

async function readSystemSettings(): Promise<Record<string, string>> {
  const settings = await prisma.systemSetting.findMany();
  return Object.fromEntries(settings.map((item) => [item.key, item.value]));
}

// Settings are read from the root layout and several API routes. Persisting
// this small map prevents every page transition from making a blocking
// cross-region database round trip. Admin saves invalidate the tag below.
const readCachedSystemSettings = unstable_cache(
  readSystemSettings,
  [SETTINGS_CACHE_TAG],
  { tags: [SETTINGS_CACHE_TAG], revalidate: 300 }
);

export async function getSystemSettings(force = false): Promise<Record<string, string>> {
  return force ? readSystemSettings() : readCachedSystemSettings();
}

export function invalidateSettingsCache() {
  // Route Handlers cannot use updateTag; an immediate expiry preserves
  // read-your-own-writes after an administrator saves settings.
  revalidateTag(SETTINGS_CACHE_TAG, { expire: 0 });
}

export function setting(map: Record<string, string>, key: string, fallback: string): string {
  const value = map[key];
  return value === undefined || value === "" ? fallback : value;
}

/** Default matches the value the admin settings page displays when unset. */
export const DEFAULT_MAX_SIMULTANEOUS_BAGS = 50;

/** Capacity for enforcement. Always reads fresh (never the 5-minute cache) so a
 * booking is never accepted against a stale limit; 0 or less disables the check. */
export async function getStorageCapacityLimit(): Promise<number> {
  const settings = await getSystemSettings(true);
  const raw = Number.parseInt(setting(settings, "max_simultaneous_bags", String(DEFAULT_MAX_SIMULTANEOUS_BAGS)), 10);
  return Number.isFinite(raw) ? Math.max(0, raw) : DEFAULT_MAX_SIMULTANEOUS_BAGS;
}
