-- Country/city of origin belong to each booking. They used to be read from the shared Customer
-- row, which keeps only the first value, so analytics showed one country for every booking made
-- with the same email. Additive and idempotent: safe to re-run.
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "countryOfOriginSnapshot" TEXT;
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "cityOfOriginSnapshot" TEXT;

UPDATE "Booking" b
SET "countryOfOriginSnapshot" = c."countryOfOrigin",
    "cityOfOriginSnapshot" = c."cityOfOrigin"
FROM "Customer" c
WHERE c.id = b."customerId"
  AND b."countryOfOriginSnapshot" IS NULL
  AND b."cityOfOriginSnapshot" IS NULL;
