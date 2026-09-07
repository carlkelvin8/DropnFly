-- Track successful feedback invitations so a delivered booking is emailed once.
ALTER TABLE "Booking"
ADD COLUMN IF NOT EXISTS "feedbackInviteSentAt" TIMESTAMP(3);
