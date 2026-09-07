import "server-only";
import { prisma } from "@/lib/prisma";
import { sendFeedbackInvitationEmail } from "@/lib/email";
import { getSystemSettings, setting } from "@/lib/settings";

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

  const settings = await getSystemSettings();
  if (setting(settings, "customer_reviews_enabled", "true") === "false") return false;

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
      review: { select: { id: true } },
      scanEvents: {
        where: { status: "DELIVERED" },
        orderBy: { scannedAt: "desc" },
        take: 1,
        select: { scannedAt: true },
      },
      customer: { select: { name: true, email: true } },
    },
  });
  if (!fresh) return false;
  if (fresh.status !== "DELIVERED") return false;
  if (fresh.feedbackInviteSentAt) return false;
  if (fresh.review) return false;

  const completionDate =
    fresh.scanEvents[0]?.scannedAt || fresh.updatedAt || fresh.checkOut || new Date();
  const formattedDate = completionDate.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  // Atomic claim: only one caller can set feedbackInviteSentAt from null to now
  const claimedAt = new Date();
  try {
    const updated = await prisma.booking.updateMany({
      where: { id: fresh.id, feedbackInviteSentAt: null },
      data: { feedbackInviteSentAt: claimedAt },
    });
    if (updated.count === 0) return false;
  } catch {
    return false;
  }

  try {
    let sent = false;
    let lastError: unknown;
    for (let attempt = 0; attempt < 3 && !sent; attempt += 1) {
      try {
        sent = await sendFeedbackInvitationEmail({
          to: fresh.customer.email,
          customerName: fresh.customer.name,
          referenceNumber: fresh.referenceNumber,
          completionDate: formattedDate,
          bookingId: fresh.id,
        });
      } catch (error) {
        lastError = error;
      }
    }
    if (!sent) throw lastError || new Error("Feedback email is disabled or unavailable");
  } catch (e) {
    console.warn("[FEEDBACK] Failed to send feedback email for", fresh.referenceNumber, e);
    // Release the claim so a later completion retry can attempt delivery again.
    await prisma.booking.updateMany({
      where: { id: fresh.id, feedbackInviteSentAt: claimedAt },
      data: { feedbackInviteSentAt: null },
    }).catch(() => {});
    return false;
  }

  try {
    const link = `/my-account/feedback/${fresh.id}`;
    const existingInvite = await prisma.customerNotification.findFirst({
      where: { customerId: fresh.customerId, type: "feedback_invite", link },
      select: { id: true },
    });
    if (!existingInvite) {
      await prisma.customerNotification.create({
        data: {
          customerId: fresh.customerId,
          type: "feedback_invite",
          title: "Share your feedback",
          message: `How was your experience with booking ${fresh.referenceNumber}? Tap to leave a review.`,
          link,
        },
      });
    }
  } catch {}

  return true;
}
