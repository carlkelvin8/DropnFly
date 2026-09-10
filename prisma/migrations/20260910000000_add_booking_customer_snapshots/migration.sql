-- Preserve the contact details entered for each booking. A Customer is keyed by
-- email and may be reused, so its profile is not a reliable historical record
-- of the passenger details submitted for an individual transaction.
ALTER TABLE "Booking"
  ADD COLUMN "customerNameSnapshot" TEXT,
  ADD COLUMN "customerEmailSnapshot" TEXT,
  ADD COLUMN "customerPhoneSnapshot" TEXT;

-- Existing bookings have no per-transaction copy available. Seed their
-- snapshots from the current customer profile so all reads use one model.
UPDATE "Booking" AS b
SET
  "customerNameSnapshot" = c."name",
  "customerEmailSnapshot" = c."email",
  "customerPhoneSnapshot" = c."phone"
FROM "Customer" AS c
WHERE b."customerId" = c."id";
