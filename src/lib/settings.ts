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
