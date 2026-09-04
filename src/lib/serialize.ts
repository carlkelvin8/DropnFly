import { Prisma } from "@/generated/prisma/client";

export function decimalsToNumbers<T>(value: T): T {
  if (value instanceof Prisma.Decimal) {
    return Number(value) as unknown as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => decimalsToNumbers(item)) as unknown as T;
  }
  if (value instanceof Date) {
    return value;
  }
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      out[key] = decimalsToNumbers(val);
    }
    return out as T;
  }
  return value;
}
