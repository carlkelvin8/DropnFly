import { prisma } from "@/lib/prisma";

export function requestKey(req: Request) {
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || req.headers.get("x-real-ip") || "unknown";
}

export async function rateLimit(key: string, limit: number, windowMs: number) {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + windowMs);
  const rows = await prisma.$queryRaw<Array<{ count: number; expiresAt: Date }>>`
    INSERT INTO "ApiRateLimit" ("key", "count", "windowStart", "expiresAt")
    VALUES (${key}, 1, ${now}, ${expiresAt})
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "ApiRateLimit"."expiresAt" <= ${now} THEN 1 ELSE "ApiRateLimit"."count" + 1 END,
      "windowStart" = CASE WHEN "ApiRateLimit"."expiresAt" <= ${now} THEN ${now} ELSE "ApiRateLimit"."windowStart" END,
      "expiresAt" = CASE WHEN "ApiRateLimit"."expiresAt" <= ${now} THEN ${expiresAt} ELSE "ApiRateLimit"."expiresAt" END
    RETURNING "count", "expiresAt"
  `;
  const bucket = rows[0];
  // Opportunistic bounded cleanup avoids requiring a dedicated cron job while
  // keeping expired, one-off client keys from growing forever.
  if (Math.random() < 0.01) {
    void prisma.apiRateLimit.deleteMany({ where: { expiresAt: { lt: now } } }).catch(() => undefined);
  }
  return {
    allowed: bucket.count <= limit,
    retryAfter: bucket.count <= limit ? 0 : Math.max(1, Math.ceil((new Date(bucket.expiresAt).getTime() - now.getTime()) / 1000)),
  };
}
