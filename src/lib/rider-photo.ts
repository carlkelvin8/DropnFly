import { prisma } from "./prisma";

/**
 * Profile photos are stored as base64 data URLs (one is over 3 MB). Selecting that column in list or
 * polling queries made every request move megabytes from the database and to the browser, which is
 * what made pages slow and requests time out. Lists select only a short fingerprint of the photo and
 * return a URL to the photo route; the fingerprint changes when the photo changes, so browsers never
 * show a stale cached image.
 */
export function riderPhotoUrl(userId: string, version: string | null | undefined): string | null {
  if (!version) return null;
  return `/api/public/riders/${encodeURIComponent(userId)}/photo?v=${encodeURIComponent(version)}`;
}

/** Map of userId -> photo fingerprint, for users that have a profile photo. */
export async function photoVersions(userIds: Array<string | null | undefined>): Promise<Map<string, string>> {
  const ids = [...new Set(userIds.filter((id): id is string => Boolean(id)))];
  if (ids.length === 0) return new Map();
  const rows = await prisma.$queryRaw<Array<{ id: string; v: string }>>`
    SELECT id, left(md5("profilePic"), 12) AS v FROM "User" WHERE id = ANY(${ids}) AND "profilePic" IS NOT NULL AND "profilePic" <> ''
  `;
  return new Map(rows.map((row) => [row.id, row.v]));
}

/** Sets `profilePic` to the photo URL (or null) using fingerprints from `photoVersions`. */
export function withPhotoUrl<T extends { id: string }>(user: T, versions: Map<string, string>): T & { profilePic: string | null } {
  return { ...user, profilePic: riderPhotoUrl(user.id, versions.get(user.id)) };
}
