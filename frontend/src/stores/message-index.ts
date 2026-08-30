/**
 * O(1) duplicate detection for the message list.
 *
 * Scanning the array on every arrival was O(n) per message with n up to 1000,
 * which is the hot path while a busy subject is being watched. The index is
 * keyed to the array it was built from, so it rebuilds itself whenever the list
 * is replaced from outside (clearing, eviction, tests) and can never go stale.
 */
interface Identifiable {
  id: string;
}

let indexedArray: readonly Identifiable[] | null = null;
let index = new Set<string>();

/** Returns the id index for `messages`, rebuilding it if the array changed. */
export function idIndex(messages: readonly Identifiable[]): Set<string> {
  if (indexedArray !== messages) {
    index = new Set(messages.map((m) => m.id));
    indexedArray = messages;
  }
  return index;
}

/** Re-points the index at the array it now describes, without rebuilding it. */
export function retargetIndex(messages: readonly Identifiable[]) {
  indexedArray = messages;
}
