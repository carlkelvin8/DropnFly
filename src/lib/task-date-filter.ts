import { manilaDateStr } from "./manila-time";

export type TaskDateFilter = "today" | "week" | "month" | "all";

export const TASK_DATE_FILTERS: { value: TaskDateFilter; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "week", label: "This Week" },
  { value: "month", label: "This Month" },
  { value: "all", label: "View All" },
];

interface DatedTask {
  taskType: string;
  checkIn?: string | Date | null;
  checkOut?: string | Date | null;
  createdAt: string | Date;
}

/** The Manila calendar day the employee has to do this task: pick-up on check-in, delivery on check-out. */
export function taskDay(task: DatedTask): string {
  const date = task.taskType === "delivery" ? task.checkOut || task.checkIn : task.checkIn;
  return manilaDateStr(date || task.createdAt);
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** `day` and `today` are Manila YYYY-MM-DD strings. Weeks run Monday to Sunday. */
export function matchesTaskDateFilter(day: string, filter: TaskDateFilter, today: string): boolean {
  if (filter === "all") return true;
  if (filter === "today") return day === today;
  if (filter === "month") return day.slice(0, 7) === today.slice(0, 7);
  const weekday = new Date(`${today}T00:00:00Z`).getUTCDay();
  const monday = addDays(today, -((weekday + 6) % 7));
  return day >= monday && day <= addDays(monday, 6);
}
