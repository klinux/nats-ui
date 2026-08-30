/**
 * Shared message search predicate.
 *
 * The same filter used to be written out twice — once in the message store and
 * once in MessageList — which meant the two could drift apart.
 */
export interface FilterableMessage {
  subject: string;
  data: string;
  headers?: Record<string, string>;
}

/** Reports whether a message matches a free-text query. */
export function matchesSearch(message: FilterableMessage, search?: string): boolean {
  const query = search?.trim().toLowerCase();
  if (!query) return true;

  return (
    message.data.toLowerCase().includes(query) ||
    message.subject.toLowerCase().includes(query) ||
    Object.values(message.headers ?? {}).some((v) => v.toLowerCase().includes(query))
  );
}

/** Filters messages by exact subject, then by an optional free-text query. */
export function filterMessages<T extends FilterableMessage>(
  messages: T[],
  subject: string,
  search?: string,
): T[] {
  return messages.filter((m) => m.subject === subject && matchesSearch(m, search));
}
