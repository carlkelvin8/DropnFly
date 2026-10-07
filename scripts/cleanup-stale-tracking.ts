/**
 * Clears stale live-tracking state left behind by older versions, where the scanner or a
 * manual status change moved a booking to a new phase without resetting `pickupStartedAt` /
 * `deliveryArrivedAt` (which made tasks look "started" before the employee tapped Start).
 *
 * Dry run by default:   npx tsx scripts/cleanup-stale-tracking.ts
 * Apply the changes:    npx tsx scripts/cleanup-stale-tracking.ts --apply
 *
 * Only unambiguous cases are changed: bookings that are IN_STORAGE, DELIVERED, CANCELLED or
 * NO_SHOW cannot have a legitimately running leg. OUT_FOR_DELIVERY bookings are only listed,
 * because a started delivery there may be real.
 */
import { prisma } from "../src/lib/prisma";

async function main() {
  const apply = process.argv.includes("--apply");

  const stale = await prisma.booking.findMany({
    where: {
      status: { in: ["IN_STORAGE", "DELIVERED", "CANCELLED", "NO_SHOW"] },
      OR: [{ pickupStartedAt: { not: null } }, { deliveryArrivedAt: { not: null } }],
    },
    select: { id: true, referenceNumber: true, status: true, pickupStartedAt: true, deliveryArrivedAt: true },
  });

  const review = await prisma.booking.findMany({
    where: { status: "OUT_FOR_DELIVERY", pickupStartedAt: { not: null } },
    select: { referenceNumber: true, pickupStartedAt: true, assignments: { select: { phase: true, user: { select: { name: true } } } } },
  });

  console.log(`${apply ? "APPLY" : "DRY RUN"}: ${stale.length} booking(s) with stale tracking state`);
  for (const b of stale) console.log(`  ${b.referenceNumber}  ${b.status}  started=${b.pickupStartedAt?.toISOString() ?? "-"}`);

  console.log(`\nNeeds manual review (not changed): ${review.length} OUT_FOR_DELIVERY booking(s) marked started`);
  for (const b of review) {
    const rider = b.assignments.find((a) => a.phase === "DROPOFF")?.user.name ?? "no drop-off employee";
    console.log(`  ${b.referenceNumber}  started=${b.pickupStartedAt?.toISOString()}  ${rider}`);
  }

  if (apply && stale.length) {
    const result = await prisma.booking.updateMany({
      where: { id: { in: stale.map((b) => b.id) } },
      data: { pickupStartedAt: null, deliveryArrivedAt: null },
    });
    console.log(`\nCleared ${result.count} booking(s).`);
  } else if (!apply) {
    console.log("\nNothing changed. Re-run with --apply to clear the list above.");
  }
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
