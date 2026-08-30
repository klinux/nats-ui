/**
 * Shared Server-Sent Events client.
 *
 * `EventSource` cannot send an `Authorization` header, so the backend
 * authenticates SSE routes with a short-lived, SSE-scoped ticket passed in the
 * query string. A fresh ticket is minted for every connection attempt — the
 * session token itself never travels in a URL, where it would be captured by
 * proxy access logs.
 */
import { fetchStreamTicket, UnauthorizedError } from './api-client';

const INITIAL_RETRY_MS = 1000;
const MAX_RETRY_MS = 30000;

export interface EventStreamHandlers<T> {
  onMessage: (data: T) => void;
  /** Called on every connection failure, including the terminal one. */
  onError?: (err: unknown) => void;
}

export type QueryParams = Record<string, string | number | undefined>;

function buildQuery(params: QueryParams, ticket: string): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) search.set(key, String(value));
  }
  search.set('ticket', ticket);
  return search.toString();
}

/**
 * Opens an authenticated SSE stream that reconnects with exponential backoff.
 * Returns a function that permanently stops the stream.
 */
export function openEventStream<T = unknown>(
  path: string,
  params: QueryParams,
  handlers: EventStreamHandlers<T>,
): () => void {
  const base = import.meta.env.VITE_API_URL || '';
  let source: EventSource | null = null;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let retryDelay = INITIAL_RETRY_MS;
  let stopped = false;

  function scheduleRetry() {
    if (stopped || retryTimer) return;
    const delay = retryDelay;
    retryDelay = Math.min(retryDelay * 2, MAX_RETRY_MS);
    retryTimer = setTimeout(() => {
      retryTimer = null;
      void connect();
    }, delay);
  }

  async function connect() {
    if (stopped) return;

    let ticket: string;
    try {
      ticket = await fetchStreamTicket();
    } catch (err) {
      handlers.onError?.(err);
      // A rejected session will keep being rejected; retrying would only spin
      // against the server. `fetchStreamTicket` already clears the session.
      if (!(err instanceof UnauthorizedError)) scheduleRetry();
      return;
    }

    // The caller may have stopped the stream while the ticket was in flight.
    if (stopped) return;

    const es = new EventSource(`${base}/api${path}?${buildQuery(params, ticket)}`);
    source = es;

    es.onopen = () => {
      retryDelay = INITIAL_RETRY_MS;
    };

    es.onmessage = (event) => {
      try {
        handlers.onMessage(JSON.parse(event.data) as T);
      } catch (err) {
        console.error(`Failed to parse SSE payload from ${path}:`, err);
      }
    };

    es.onerror = (err) => {
      handlers.onError?.(err);
      // Close before retrying: EventSource reconnects on its own otherwise, and
      // it would reuse the URL of a ticket that is about to expire.
      es.close();
      if (source === es) source = null;
      scheduleRetry();
    };
  }

  void connect();

  return () => {
    stopped = true;
    if (retryTimer) {
      clearTimeout(retryTimer);
      retryTimer = null;
    }
    source?.close();
    source = null;
  };
}
