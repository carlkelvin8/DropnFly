ALTER TABLE "Booking"
  ADD COLUMN IF NOT EXISTS "deliveryArrivedAt" TIMESTAMP(3);

ALTER TABLE "LocationUpdate"
  ADD COLUMN IF NOT EXISTS "bookingId" TEXT;

CREATE INDEX IF NOT EXISTS "LocationUpdate_bookingId_createdAt_idx"
  ON "LocationUpdate"("bookingId", "createdAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'LocationUpdate_bookingId_fkey'
  ) THEN
    ALTER TABLE "LocationUpdate"
      ADD CONSTRAINT "LocationUpdate_bookingId_fkey"
      FOREIGN KEY ("bookingId") REFERENCES "Booking"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
