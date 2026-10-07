/**
 * Turns a failed request into a message an employee can act on. Browsers report a dropped
 * connection as a bare TypeError ("Load failed" on iOS Safari, "Failed to fetch" in Chrome).
 */
export function requestErrorMessage(error: unknown, fallback: string): string {
  const networkFailure = error instanceof TypeError || (error instanceof Error && /load failed|failed to fetch|networkerror|network request failed/i.test(error.message));
  if (networkFailure) return "Connection problem — the update was not saved. Check your signal and try again.";
  return error instanceof Error && error.message ? error.message : fallback;
}
