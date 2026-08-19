export interface StatusConfig {
  label: string;
  color: "default" | "secondary" | "destructive" | "outline"
    | "success" | "warning" | "info";
  bgClass: string;
  textClass: string;
  dotClass: string;
  step: number;
}

const STATUS_CONFIG: Record<string, StatusConfig> = {
  PENDING: {
    label: "Pending",
    color: "warning",
    bgClass: "bg-yellow-100 dark:bg-yellow-900/30",
    textClass: "text-yellow-800 dark:text-yellow-300",
    dotClass: "bg-yellow-500",
    step: 1,
  },
  CONFIRMED: {
    label: "Confirmed",
    color: "info",
    bgClass: "bg-blue-100 dark:bg-blue-900/30",
    textClass: "text-blue-800 dark:text-blue-300",
    dotClass: "bg-blue-500",
    step: 2,
  },
  RECEIVED: {
    label: "Received",
    color: "info",
    bgClass: "bg-indigo-100 dark:bg-indigo-900/30",
    textClass: "text-indigo-800 dark:text-indigo-300",
    dotClass: "bg-indigo-500",
    step: 3,
  },
  IN_STORAGE: {
    label: "In Storage",
    color: "secondary",
    bgClass: "bg-purple-100 dark:bg-purple-900/30",
    textClass: "text-purple-800 dark:text-purple-300",
    dotClass: "bg-purple-500",
    step: 3,
  },
  OUT_FOR_DELIVERY: {
    label: "Out for Delivery",
    color: "info",
    bgClass: "bg-cyan-100 dark:bg-cyan-900/30",
    textClass: "text-cyan-800 dark:text-cyan-300",
    dotClass: "bg-cyan-500",
    step: 4,
  },
  DELIVERED: {
    label: "Delivered",
    color: "success",
    bgClass: "bg-green-100 dark:bg-green-900/30",
    textClass: "text-green-800 dark:text-green-300",
    dotClass: "bg-green-500",
    step: 5,
  },
  CANCELLED: {
    label: "Cancelled",
    color: "destructive",
    bgClass: "bg-red-100 dark:bg-red-900/30",
    textClass: "text-red-800 dark:text-red-300",
    dotClass: "bg-red-500",
    step: 0,
  },
  NO_SHOW: {
    label: "No Show",
    color: "destructive",
    bgClass: "bg-red-100 dark:bg-red-900/30",
    textClass: "text-red-800 dark:text-red-300",
    dotClass: "bg-red-500",
    step: 0,
  },
};

export function getStatusConfig(status: string): StatusConfig {
  return STATUS_CONFIG[status] || STATUS_CONFIG.PENDING;
}

export function getStatusBadgeClasses(status: string): string {
  const config = getStatusConfig(status);
  return `${config.bgClass} ${config.textClass}`;
}

export const BOOKING_STATUS_LIST = [
  "PENDING", "CONFIRMED", "RECEIVED", "IN_STORAGE",
  "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED", "NO_SHOW",
] as const;
