/** Query-string helpers: malformed values fall back to defaults instead of crashing the route. */

/** A YYYY-MM-DD string that is a real calendar date, otherwise null. */
export function isoDayOrNull(value: string | null | undefined): string | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  return Number.isNaN(new Date(`${value}T00:00:00+08:00`).getTime()) ? null : value;
}

/** An integer within [min, max], or `fallback` when missing/invalid. */
export function intParam(value: string | null | undefined, fallback: number, min: number, max: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}
