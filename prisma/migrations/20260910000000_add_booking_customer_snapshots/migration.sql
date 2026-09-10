-- Preserve the contact details entered for each booking. A Customer is keyed by
-- email and may be reused, so its profile is not a reliable historical record
-- of the passenger details submitted for an individual transaction.
ALTER TABLE "Booking"
  ADD COLUMN IF NOT EXISTS "customerNameSnapshot" TEXT,
  ADD COLUMN IF NOT EXISTS "customerEmailSnapshot" TEXT,
  ADD COLUMN IF NOT EXISTS "customerPhoneSnapshot" TEXT;

-- Existing bookings have no per-transaction copy available. Seed their
-- snapshots from the current customer profile so all reads use one model.
UPDATE "Booking" AS b
SET
  "customerNameSnapshot" = COALESCE(b."customerNameSnapshot", c."name"),
  "customerEmailSnapshot" = COALESCE(b."customerEmailSnapshot", c."email"),
  "customerPhoneSnapshot" = COALESCE(b."customerPhoneSnapshot", c."phone")
FROM "Customer" AS c
WHERE b."customerId" = c."id"
  AND (
    b."customerNameSnapshot" IS NULL
    OR b."customerEmailSnapshot" IS NULL
    OR b."customerPhoneSnapshot" IS NULL
  );
