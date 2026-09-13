/** Preserve locally confirmed sends when an older poll response arrives. */
export function mergeChatMessages<T extends { id: string; createdAt: string }>(existing: T[], incoming: T[]): T[] {
  const messages = new Map(existing.map(message => [message.id, message]));
  for (const message of incoming) messages.set(message.id, message);
  return [...messages.values()].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt) || a.id.localeCompare(b.id));
}
