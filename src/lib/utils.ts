import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date | string): string {
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return "Invalid date";
    return new Intl.DateTimeFormat("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(d);
  } catch {
    return "Invalid date";
  }
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "PHP",
  }).format(amount);
}

export function calculateTotalPrice(
  pricePerDay: number,
  checkIn: Date,
  checkOut: Date
): number {
  const diffMs = checkOut.getTime() - checkIn.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  return Math.max(1, diffDays) * pricePerDay;
}
