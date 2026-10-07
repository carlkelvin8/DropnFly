const TZ = "Asia/Manila";

function parts(date: Date | string | number) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(date));
}

function get(partList: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): number {
  return Number(partList.find((p) => p.type === type)?.value || "0");
}

export function manilaDateStr(date: Date | string | number): string {
  const p = parts(date);
  return `${get(p, "year")}-${String(get(p, "month")).padStart(2, "0")}-${String(get(p, "day")).padStart(2, "0")}`;
}

export function manilaMinutesOfDay(date: Date | string | number): number {
  const p = parts(date);
  return get(p, "hour") * 60 + get(p, "minute");
}

export function manilaWeekday(date: Date | string | number): number {
  return new Date(manilaDateStr(date) + "T00:00:00+08:00").getUTCDay();
}

export function manilaDayRange(date: Date | string | number): { start: Date; end: Date } {
  const start = new Date(manilaDateStr(date) + "T00:00:00+08:00");
  return { start, end: new Date(start.getTime() + 24 * 60 * 60 * 1000) };
}

export function manilaDayStart(dateStr: string): Date {
  return new Date(dateStr + "T00:00:00+08:00");
}

export function manilaMonthRange(year: number, month: number): { start: Date; end: Date } {
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    throw new RangeError("Invalid Manila calendar month");
  }

  const start = new Date(`${year}-${String(month).padStart(2, "0")}-01T00:00:00+08:00`);
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const end = new Date(`${nextYear}-${String(nextMonth).padStart(2, "0")}-01T00:00:00+08:00`);
  return { start, end };
}

/**
 * Turns optional YYYY-MM-DD `from`/`to` query values into a [gte, lt) range covering whole Manila
 * calendar days (both ends inclusive). Returns `null` when a value is present but not a real date,
 * so callers can answer 400 instead of crashing on an Invalid Date.
 */
export function manilaDateRange(from?: string | null, to?: string | null): { gte?: Date; lt?: Date } | null {
  const parse = (value: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const date = new Date(`${value}T00:00:00+08:00`);
    return Number.isNaN(date.getTime()) ? null : date;
  };
  const range: { gte?: Date; lt?: Date } = {};
  if (from) {
    const start = parse(from);
    if (!start) return null;
    range.gte = start;
  }
  if (to) {
    const end = parse(to);
    if (!end) return null;
    range.lt = new Date(end.getTime() + 24 * 60 * 60 * 1000);
  }
  return range;
}
