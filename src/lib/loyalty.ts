import "server-only";
import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";

export async function awardDeliveryPoints(booking: { id: string; customerId: string; referenceNumber: string; totalPrice: number }) {
  const points = Math.floor(booking.totalPrice / 10);
  if (points <= 0) return false;
  const transactionId = crypto.randomUUID();
  const description = `Earned from booking ${booking.referenceNumber}`;
  const changed = await prisma.$executeRaw`
    WITH inserted AS (
      INSERT INTO "PointsTransaction" ("id", "customerId", "points", "type", "reference", "description", "createdAt")
      VALUES (${transactionId}, ${booking.customerId}, ${points}, 'EARNED', ${booking.id}, ${description}, NOW())
      ON CONFLICT ("reference", "type") DO NOTHING
      RETURNING "points"
    )
    UPDATE "Customer"
    SET "points" = "Customer"."points" + inserted."points", "updatedAt" = NOW()
    FROM inserted
    WHERE "Customer"."id" = ${booking.customerId}
  `;
  return changed > 0;
}
