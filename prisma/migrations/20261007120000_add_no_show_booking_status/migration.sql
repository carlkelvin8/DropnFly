-- NO_SHOW is present in the Prisma schema and application workflows, but the
-- original BookingStatus migration only created statuses through CANCELLED.
ALTER TYPE "BookingStatus" ADD VALUE IF NOT EXISTS 'NO_SHOW';
