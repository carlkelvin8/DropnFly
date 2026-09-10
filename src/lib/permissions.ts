// Central role matrix — single source of truth for page + API guards.
// Keep in sync with Sidebar.tsx ADMIN_ONLY_ITEMS / STAFF_AND_ABOVE_ITEMS and API route checks.

export type Role = "ADMIN" | "STAFF" | "EMPLOYEE";

export const ROLE_ROUTES: Record<string, readonly Role[]> = {
  "/dashboard/analytics": ["ADMIN"],
  "/dashboard/employees": ["ADMIN"],
  "/dashboard/settings": ["ADMIN"],
  "/dashboard/activity-logs": ["ADMIN"],
  "/dashboard/promo-codes": ["ADMIN"],
  "/dashboard/customers": ["ADMIN", "STAFF"],
  "/dashboard/incidents": ["ADMIN", "STAFF"],
  "/dashboard/payments": ["ADMIN", "STAFF"],
  // logistics is intentionally open to all for geolocation study
  // bookings, scanner, chat, support, logistics, notifications — open to all authenticated
};

/** Returns true if role is allowed to view the given dashboard path. */
export function canViewRoute(path: string, role?: string | null): boolean {
  // find most specific matching prefix
  const entry = Object.entries(ROLE_ROUTES).find(([route]) => path === route || path.startsWith(route + "/"));
  if (!entry) return true;
  if (!role) return false;
  return (entry[1] as readonly string[]).includes(role);
}

export function hasStaffRole(role: string, allowed: readonly Role[]) {
  return (allowed as readonly string[]).includes(role);
}
