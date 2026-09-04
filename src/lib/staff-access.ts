import "server-only";
import { prisma } from "@/lib/prisma";

export type StaffIdentity = { id: string; role: string };

export function hasStaffRole(user: StaffIdentity, roles: readonly string[]) {
  return roles.includes(user.role);
}

export async function canReadBooking(user: StaffIdentity, bookingId: string) {
  if (hasStaffRole(user, ["ADMIN", "STAFF"])) return true;
  if (user.role !== "EMPLOYEE") return false;
  return Boolean(await prisma.bookingAssignment.findFirst({
    where: { bookingId, userId: user.id },
    select: { id: true },
  }));
}

export async function canReadRiderLocation(user: StaffIdentity, targetUserId: string) {
  return hasStaffRole(user, ["ADMIN", "STAFF"]) || user.id === targetUserId;
}
