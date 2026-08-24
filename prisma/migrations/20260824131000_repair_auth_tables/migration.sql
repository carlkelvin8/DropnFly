-- These tables were originally added by an already-applied migration that was
-- later amended. Databases that applied the earlier version therefore have a
-- migration record but not the authentication tables. Repair them in a new,
-- forward-only migration.

CREATE TABLE IF NOT EXISTS "CustomerActivationToken" (
  "id" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "pendingName" TEXT NOT NULL,
  "pendingPhone" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CustomerActivationToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CustomerActivationToken_tokenHash_key"
  ON "CustomerActivationToken"("tokenHash");
CREATE INDEX IF NOT EXISTS "CustomerActivationToken_customerId_idx"
  ON "CustomerActivationToken"("customerId");
CREATE INDEX IF NOT EXISTS "CustomerActivationToken_expiresAt_idx"
  ON "CustomerActivationToken"("expiresAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'CustomerActivationToken_customerId_fkey'
  ) THEN
    ALTER TABLE "CustomerActivationToken"
      ADD CONSTRAINT "CustomerActivationToken_customerId_fkey"
      FOREIGN KEY ("customerId") REFERENCES "Customer"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "ApiRateLimit" (
  "key" TEXT NOT NULL,
  "count" INTEGER NOT NULL DEFAULT 1,
  "windowStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ApiRateLimit_pkey" PRIMARY KEY ("key")
);

CREATE INDEX IF NOT EXISTS "ApiRateLimit_expiresAt_idx"
  ON "ApiRateLimit"("expiresAt");
