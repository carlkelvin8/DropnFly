/**
 * Clears transaction data and keeps accounts and configuration.
 *
 * Deleted:  bookings and everything hanging off them (payments, scans, assignments, luggage items,
 *           chats, reviews, extensions, incidents), location history, notifications, support chats,
 *           activity logs, loyalty points, rate-limit counters.
 * Reset:    baggage tags -> AVAILABLE, customer points -> 0, promo code usage -> 0.
 * Kept:     users, customers, system settings (incl. fleet data), baggage tag inventory,
 *           storage locations, promo codes, push subscriptions, auth tokens.
 *
 * Dry run by default:   npx tsx scripts/clear-transaction-data.ts
 * Delete for real:      npx tsx scripts/clear-transaction-data.ts --apply
 */
import { prisma } from "../src/lib/prisma";

async function counts() {
  const entries = await Promise.all([
    ["Booking", prisma.booking.count()],
    ["Payment", prisma.payment.count()],
    ["ScanEvent", prisma.scanEvent.count()],
    ["BookingAssignment", prisma.bookingAssignment.count()],
    ["LuggageItem", prisma.luggageItem.count()],
    ["BookingExtension", prisma.bookingExtension.count()],
    ["BookingReview", prisma.bookingReview.count()],
    ["ChatMessage", prisma.chatMessage.count()],
    ["IncidentReport", prisma.incidentReport.count()],
    ["IncidentTimeline", prisma.incidentTimeline.count()],
    ["LocationUpdate", prisma.locationUpdate.count()],
    ["Notification", prisma.notification.count()],
    ["CustomerNotification", prisma.customerNotification.count()],
    ["SupportChat", prisma.supportChat.count()],
    ["SupportChatMessage", prisma.supportChatMessage.count()],
    ["ActivityLog", prisma.activityLog.count()],
    ["PointsTransaction", prisma.pointsTransaction.count()],
    ["ApiRateLimit", prisma.apiRateLimit.count()],
    ["BaggageTag (not AVAILABLE)", prisma.baggageTag.count({ where: { status: { not: "AVAILABLE" } } })],
  ].map(async ([name, count]) => [name, await (count as Promise<number>)] as const));
  return entries;
}

async function main() {
  const apply = process.argv.includes("--apply");
  console.log(`${apply ? "APPLY" : "DRY RUN"} — rows that will be removed/reset:`);
  for (const [name, n] of await counts()) console.log(`  ${String(n).padStart(6)}  ${name}`);
  console.log(`  kept: ${await prisma.user.count()} user(s), ${await prisma.customer.count()} customer(s)`);

  if (!apply) return console.log("\nNothing changed. Re-run with --apply to delete.");

  await prisma.$transaction(async (tx) => {
    await tx.incidentTimeline.deleteMany();
    await tx.incidentReport.deleteMany();
    await tx.chatMessage.deleteMany();
    await tx.bookingReview.deleteMany();
    await tx.bookingExtension.deleteMany();
    await tx.payment.deleteMany();
    await tx.scanEvent.deleteMany();
    await tx.locationUpdate.deleteMany();
    await tx.bookingAssignment.deleteMany();
    // Free tags before their luggage items / bookings disappear.
    await tx.baggageTag.updateMany({ data: { status: "AVAILABLE", bookingId: null, luggageItemId: null, assignedAt: null }, where: { status: { not: "RETIRED" } } });
    await tx.baggageTag.updateMany({ data: { bookingId: null, luggageItemId: null, assignedAt: null } });
    await tx.luggageItem.deleteMany();
    await tx.pointsTransaction.deleteMany();
    await tx.customer.updateMany({ data: { points: 0 } });
    await tx.booking.deleteMany();
    await tx.promoCode.updateMany({ data: { usedCount: 0 } });
    await tx.customerNotification.deleteMany();
    await tx.notification.deleteMany();
    await tx.supportChatMessage.deleteMany();
    await tx.supportChat.deleteMany();
    await tx.activityLog.deleteMany();
    await tx.apiRateLimit.deleteMany();
  }, { maxWait: 30000, timeout: 120000 });

  console.log("\nDone. Remaining:");
  for (const [name, n] of await counts()) console.log(`  ${String(n).padStart(6)}  ${name}`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
