import { prisma } from "./prisma";

let cache: { map: Record<string, string>; at: number } | null = null;
const TTL_MS = 10000;

export async function getSystemSettings(force = false): Promise<Record<string, string>> {
  if (!force && cache && Date.now() - cache.at < TTL_MS) {
    return cache.map;
  }
  const settings = await prisma.systemSetting.findMany();
  const map = Object.fromEntries(settings.map((s) => [s.key, s.value]));
  cache = { map, at: Date.now() };
  return map;
}

export function invalidateSettingsCache() {
  cache = null;
}

export function setting(map: Record<string, string>, key: string, fallback: string): string {
  const value = map[key];
  return value === undefined || value === "" ? fallback : value;
}
