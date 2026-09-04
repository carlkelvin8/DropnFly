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
