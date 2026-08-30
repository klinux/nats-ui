import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { openEventStream } from './event-stream';
import { setToken, clearToken } from './api-client';

/** Minimal EventSource stand-in; jsdom does not provide one. */
class FakeEventSource {
  static instances: FakeEventSource[] = [];

  onopen: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onerror: ((e: unknown) => void) | null = null;
  closed = false;
  url: string;

  constructor(url: string) {
    this.url = url;
    FakeEventSource.instances.push(this);
  }

  close() {
    this.closed = true;
  }

  emit(data: unknown) {
    this.onmessage?.({ data: JSON.stringify(data) });
  }

  fail() {
    this.onerror?.(new Event('error'));
  }

  static reset() {
    FakeEventSource.instances = [];
  }

  static get last() {
    return FakeEventSource.instances[FakeEventSource.instances.length - 1];
  }
}

/** Resolves once the microtask queue (ticket fetch) has drained. */
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

function mockTicketEndpoint(ticket = 'ticket-123') {
  return vi.fn(async (input: RequestInfo | URL) => {
    if (String(input).includes('/auth/stream-ticket')) {
      return new Response(JSON.stringify({ ticket, expires_in: 120 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    throw new Error(`unexpected fetch: ${input}`);
  });
}

describe('openEventStream', () => {
  beforeEach(() => {
    FakeEventSource.reset();
    vi.stubGlobal('EventSource', FakeEventSource);
    setToken('session-token');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    clearToken();
  });

  it('mints a short-lived ticket and never puts the session token in the URL', async () => {
    vi.stubGlobal('fetch', mockTicketEndpoint());

    const stop = openEventStream('/messages/subscribe', { subject: 'orders.created' }, {
      onMessage: () => {},
    });
    await flush();

    const url = FakeEventSource.last.url;
    expect(url).toContain('ticket=ticket-123');
    expect(url).toContain('subject=orders.created');
    expect(url).not.toContain('session-token');
    stop();
  });

  it('delivers parsed messages to onMessage', async () => {
    vi.stubGlobal('fetch', mockTicketEndpoint());
    const onMessage = vi.fn();

    const stop = openEventStream('/messages/subscribe', { subject: 'a' }, { onMessage });
    await flush();

    FakeEventSource.last.emit({ subject: 'a', data: { ok: true } });
    expect(onMessage).toHaveBeenCalledWith({ subject: 'a', data: { ok: true } });
    stop();
  });

  it('ignores malformed payloads instead of throwing', async () => {
    vi.stubGlobal('fetch', mockTicketEndpoint());
    const onMessage = vi.fn();
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const stop = openEventStream('/messages/subscribe', { subject: 'a' }, { onMessage });
    await flush();

    expect(() => FakeEventSource.last.onmessage?.({ data: 'not json' })).not.toThrow();
    expect(onMessage).not.toHaveBeenCalled();
    stop();
  });

  it('reconnects with a fresh ticket after an error', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', mockTicketEndpoint());

    const stop = openEventStream('/messages/subscribe', { subject: 'a' }, { onMessage: () => {} });
    await vi.advanceTimersByTimeAsync(0);
    expect(FakeEventSource.instances).toHaveLength(1);

    FakeEventSource.last.fail();
    await vi.advanceTimersByTimeAsync(1100);

    expect(FakeEventSource.instances).toHaveLength(2);
    expect(FakeEventSource.instances[0].closed).toBe(true);
    stop();
    vi.useRealTimers();
  });

  it('stops retrying once the caller stops the stream', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', mockTicketEndpoint());

    const stop = openEventStream('/messages/subscribe', { subject: 'a' }, { onMessage: () => {} });
    await vi.advanceTimersByTimeAsync(0);

    FakeEventSource.last.fail();
    stop();
    await vi.advanceTimersByTimeAsync(60_000);

    expect(FakeEventSource.instances).toHaveLength(1);
    vi.useRealTimers();
  });

  it('does not open a connection when stopped while the ticket is in flight', async () => {
    vi.stubGlobal('fetch', mockTicketEndpoint());

    const stop = openEventStream('/messages/subscribe', { subject: 'a' }, { onMessage: () => {} });
    stop(); // before the ticket resolves
    await flush();

    expect(FakeEventSource.instances).toHaveLength(0);
  });

  it('gives up and reports the error when the session is no longer valid', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{"error":"unauthorized"}', { status: 401 })));
    const onError = vi.fn();

    openEventStream('/messages/subscribe', { subject: 'a' }, { onMessage: () => {}, onError });
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(60_000);

    expect(FakeEventSource.instances).toHaveLength(0);
    expect(onError).toHaveBeenCalled();
    vi.useRealTimers();
  });
});
