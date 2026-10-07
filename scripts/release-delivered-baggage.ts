/**
 * One-off fix for bookings that were delivered before baggage was released automatically:
 * their luggage items still show IN_STORAGE and their physical tags stay ASSIGNED.
 *
 * Dry run by default:   npx tsx scripts/release-delivered-baggage.ts
 * Apply the changes:    npx tsx scripts/release-delivered-baggage.ts --apply
 */
import { prisma } from "../src/lib/prisma";

async function main() {
  const apply = process.argv.includes("--apply");

  const items = await prisma.luggageItem.findMany({
    where: { booking: { status: "DELIVERED" }, status: { notIn: ["CANCELLED", "DELIVERED"] } },
    select: { id: true, tagNumber: true, status: true, booking: { select: { referenceNumber: true } } },
  });
  const tags = await prisma.baggageTag.findMany({
    where: { booking: { status: "DELIVERED" }, status: "ASSIGNED" },
    select: { id: true, tagNumber: true, booking: { select: { referenceNumber: true } } },
  });

  console.log(`${apply ? "APPLY" : "DRY RUN"}: ${items.length} luggage item(s) not marked DELIVERED, ${tags.length} tag(s) still ASSIGNED`);
  for (const i of items) console.log(`  item ${i.tagNumber}  ${i.status}  ${i.booking.referenceNumber}`);
  for (const t of tags) console.log(`  tag  ${t.tagNumber}  ASSIGNED  ${t.booking?.referenceNumber ?? "-"}`);

  if (!apply) return console.log("\nNothing changed. Re-run with --apply to fix the list above.");

  await prisma.$transaction(async (tx) => {
    await tx.luggageItem.updateMany({
      where: { id: { in: items.map((i) => i.id) } },
      data: { status: "DELIVERED", checkOutAt: new Date() },
    });
    await tx.baggageTag.updateMany({
      where: { id: { in: tags.map((t) => t.id) } },
      data: { status: "AVAILABLE", bookingId: null, luggageItemId: null, assignedAt: null },
    });
  });
  console.log("\nDone.");
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
