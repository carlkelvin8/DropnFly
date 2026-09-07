import "server-only";
import { prisma } from "@/lib/prisma";
import { sendFeedbackInvitationEmail } from "@/lib/email";

/**
 * Attempt to send feedback invitation email for a booking that just became DELIVERED.
 * Guarantees idempotency:
 *  - Only for DELIVERED status
 *  - Only once per booking (feedbackInviteSentAt guard + CustomerNotification dedup)
 *  - Atomic update prevents duplicate sends from concurrent updates
 */
export async function trySendFeedbackInvitation(booking: {
  id: string;
  referenceNumber: string;
  customerId: string;
  status: string;
  updatedAt: Date;
  feedbackInviteSentAt?: Date | null;
  completionDate?: Date | null;
}): Promise<boolean> {
  if (booking.status !== "DELIVERED") return false;

  // Idempotency guard 1: booking column
  if (booking.feedbackInviteSentAt) return false;

  // Fetch fresh booking to check atomic guard and get customer email
  const fresh = await prisma.booking.findUnique({
    where: { id: booking.id },
    select: {
      id: true,
      referenceNumber: true,
      customerId: true,
      status: true,
      feedbackInviteSentAt: true,
      checkOut: true,
      updatedAt: true,
      customer: { select: { name: true, email: true } },
    },
  });
  if (!fresh) return false;
  if (fresh.status !== "DELIVERED") return false;
  if (fresh.feedbackInviteSentAt) return false;

  // Idempotency guard 2: existing CustomerNotification of type feedback_invite
  const existingInvite = await prisma.customerNotification.findFirst({
    where: {
      customerId: fresh.customerId,
      type: "feedback_invite",
      link: { contains: fresh.id },
    },
    select: { id: true },
  });
  if (existingInvite) {
    // Mark booking so future checks short-circuit without notification lookup
    try {
      await prisma.booking.update({
        where: { id: fresh.id },
        data: { feedbackInviteSentAt: new Date() },
      });
    } catch {}
    return false;
  }

  const completionDate =
    fresh.checkOut || fresh.updatedAt || new Date();
  const formattedDate = completionDate.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  // Atomic claim: only one caller can set feedbackInviteSentAt from null to now
  let claimed = false;
  try {
    const updated = await prisma.booking.updateMany({
      where: { id: fresh.id, feedbackInviteSentAt: null },
      data: { feedbackInviteSentAt: new Date() },
    });
    if (updated.count === 0) return false;
    claimed = true;
  } catch {
    return false;
  }

  if (!claimed) return false;

  try {
    await sendFeedbackInvitationEmail({
      to: fresh.customer.email,
      customerName: fresh.customer.name,
      referenceNumber: fresh.referenceNumber,
      completionDate: formattedDate,
      bookingId: fresh.id,
    });
  } catch (e) {
    // Log but don't revert invite flag; email failures should be retried via admin? keep flag to avoid spam.
    console.warn("[FEEDBACK] Failed to send feedback email for", fresh.referenceNumber, e);
    // Still create notification even if email failed, so customer sees invite in-app
  }

  try {
    await prisma.customerNotification.create({
      data: {
        customerId: fresh.customerId,
        type: "feedback_invite",
        title: "Share your feedback",
        message: `How was your experience with booking ${fresh.referenceNumber}? Tap to leave a review.`,
        link: `/my-account/feedback/${fresh.id}`,
      },
    });
  } catch {}

  return true;
}
