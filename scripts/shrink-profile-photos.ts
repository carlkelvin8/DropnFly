/**
 * Resizes stored profile photos to at most 512px JPEG. A single 3 MB photo made every page that
 * shows that rider slow. Originals are written to a backup JSON file first.
 *
 * Dry run by default:  npx tsx --env-file=.env scripts/shrink-profile-photos.ts
 * Apply:               npx tsx --env-file=.env scripts/shrink-profile-photos.ts --apply [--backup=/path/file.json]
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { prisma } from "../src/lib/prisma";

const LIMIT = 150_000; // characters; anything bigger gets resized

async function main() {
  const apply = process.argv.includes("--apply");
  const backupArg = process.argv.find((arg) => arg.startsWith("--backup="));
  const backupFile = backupArg ? backupArg.slice("--backup=".length) : path.join(os.tmpdir(), `profile-photos-backup-${Date.now()}.json`);

  const users = await prisma.user.findMany({ where: { profilePic: { startsWith: "data:image/" } }, select: { id: true, name: true, profilePic: true } });
  const large = users.filter((u) => (u.profilePic?.length || 0) > LIMIT);
  console.log(`${apply ? "APPLY" : "DRY RUN"}: ${large.length} of ${users.length} photo(s) above ${Math.round(LIMIT / 1024)}KB`);

  const results: Array<{ id: string; before: number; after: number; data: string }> = [];
  for (const user of large) {
    const base64 = user.profilePic!.slice(user.profilePic!.indexOf(",") + 1);
    const resized = await sharp(Buffer.from(base64, "base64")).rotate().resize(512, 512, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 80 }).toBuffer();
    const data = `data:image/jpeg;base64,${resized.toString("base64")}`;
    results.push({ id: user.id, before: user.profilePic!.length, after: data.length, data });
    console.log(`  ${user.name}: ${Math.round(user.profilePic!.length / 1024)}KB -> ${Math.round(data.length / 1024)}KB`);
  }
  if (!apply || results.length === 0) return console.log(apply ? "Nothing to change." : "\nNothing changed. Re-run with --apply.");

  fs.writeFileSync(backupFile, JSON.stringify(large.map((u) => ({ id: u.id, profilePic: u.profilePic }))));
  console.log(`Backup of originals: ${backupFile}`);
  for (const r of results) await prisma.user.update({ where: { id: r.id }, data: { profilePic: r.data } });
  console.log("Done.");
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
