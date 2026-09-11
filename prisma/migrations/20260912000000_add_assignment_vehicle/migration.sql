ALTER TABLE "BookingAssignment" ADD COLUMN IF NOT EXISTS "vehicleId" TEXT;
ALTER TABLE "BookingAssignment" ADD COLUMN IF NOT EXISTS "vehicleType" TEXT;
ALTER TABLE "BookingAssignment" ADD COLUMN IF NOT EXISTS "vehiclePlate" TEXT;
CREATE INDEX IF NOT EXISTS "BookingAssignment_vehicleId_idx" ON "BookingAssignment"("vehicleId");
