import { prisma } from "./prisma";

export async function logActivity({
  userId,
  action,
  entity,
  entityId,
  details,
}: {
  userId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  details?: string | null;
}) {
  try {
    await prisma.activityLog.create({
      data: {
        userId: userId || null,
        action,
        entity,
        entityId: entityId || null,
        details: details || null,
      },
    });
  } catch {
    console.warn("Failed to log activity");
  }
}
