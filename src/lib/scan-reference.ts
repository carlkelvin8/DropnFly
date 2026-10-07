export function normalizeScannedReference(raw: string): string {
  const value = raw.trim();
  try {
    const parsed = new URL(value, "https://dropnfly.local");
    const queryReference = parsed.searchParams.get("reference") || parsed.searchParams.get("ref");
    if (queryReference) return normalizePlainReference(queryReference);
  } catch { /* fall through to plain text/path parsing */ }

  return normalizePlainReference(value);
}

function normalizePlainReference(raw: string): string {
  const withoutQuery = raw.split("?")[0].split("#")[0];
  const lastPathSegment = withoutQuery.includes("/")
    ? withoutQuery.split("/").filter(Boolean).pop() || ""
    : withoutQuery;
  const normalized = lastPathSegment.trim().toUpperCase();

  // Accept legacy QR payloads that duplicated the configured prefix, such as
  // DNF-DNF-260911-X5HJ3P, while leaving normal references unchanged.
  return normalized.replace(/^([A-Z]+)-\1-/, "$1-");
}
