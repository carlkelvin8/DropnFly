ALTER TABLE "User" ADD COLUMN "authVersion" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Customer" ADD COLUMN "emailVerifiedAt" TIMESTAMP(3), ADD COLUMN "authVersion" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Booking" ADD COLUMN "checkoutLockedUntil" TIMESTAMP(3);

-- Existing password-bearing customers already proved control under the legacy flow.
UPDATE "Customer" SET "emailVerifiedAt" = NOW() WHERE "password" IS NOT NULL;

CREATE TABLE "CustomerActivationToken" (
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
CREATE UNIQUE INDEX "CustomerActivationToken_tokenHash_key" ON "CustomerActivationToken"("tokenHash");
CREATE INDEX "CustomerActivationToken_customerId_idx" ON "CustomerActivationToken"("customerId");
CREATE INDEX "CustomerActivationToken_expiresAt_idx" ON "CustomerActivationToken"("expiresAt");
ALTER TABLE "CustomerActivationToken" ADD CONSTRAINT "CustomerActivationToken_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ApiRateLimit" (
  "key" TEXT NOT NULL,
  "count" INTEGER NOT NULL DEFAULT 1,
  "windowStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ApiRateLimit_pkey" PRIMARY KEY ("key")
);
CREATE INDEX "ApiRateLimit_expiresAt_idx" ON "ApiRateLimit"("expiresAt");
