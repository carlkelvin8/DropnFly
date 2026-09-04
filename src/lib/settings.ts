import { prisma } from "./prisma";

let cache: { map: Record<string, string>; at: number } | null = null;
const TTL_MS = 0;

export async function getSystemSettings(force = false): Promise<Record<string, string>> {
  // Senior-level: immediate reflection for admin → customer/employee.
  // Disable stale cache — always fetch fresh unless explicitly allowed.
  // Keep tiny in-memory cache only to coalesce concurrent requests within same tick.
  if (!force && TTL_MS > 0 && cache && Date.now() - cache.at < TTL_MS) {
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
