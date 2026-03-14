import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useMessageStore, type Message } from './message-store';

// Mock sonner to avoid side effects
vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

function makeMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: `msg_${Math.random()}`,
    subject: 'test.subject',
    data: '{"key":"value"}',
    timestamp: new Date(),
    ...overrides,
  };
}

describe('message-store', () => {
  beforeEach(() => {
    useMessageStore.setState({ messages: [], subscriptions: [] });
  });

  describe('addMessage', () => {
    it('adds a message to the front of the list', () => {
      const msg1 = makeMessage({ id: 'msg_1' });
      const msg2 = makeMessage({ id: 'msg_2' });

      useMessageStore.getState().addMessage(msg1);
      useMessageStore.getState().addMessage(msg2);

      const messages = useMessageStore.getState().messages;
      expect(messages[0].id).toBe('msg_2');
      expect(messages[1].id).toBe('msg_1');
    });

    it('deduplicates messages by id', () => {
      const msg = makeMessage({ id: 'dup_1' });

      useMessageStore.getState().addMessage(msg);
      useMessageStore.getState().addMessage(msg);

      expect(useMessageStore.getState().messages).toHaveLength(1);
    });

    it('caps messages at MAX_MESSAGES (1000)', () => {
      const existingMessages = Array.from({ length: 999 }, (_, i) =>
        makeMessage({ id: `existing_${i}` }),
      );
      useMessageStore.setState({ messages: existingMessages });

      useMessageStore.getState().addMessage(makeMessage({ id: 'new_1' }));
      expect(useMessageStore.getState().messages).toHaveLength(1000);

      useMessageStore.getState().addMessage(makeMessage({ id: 'new_2' }));
      expect(useMessageStore.getState().messages).toHaveLength(1000);
      expect(useMessageStore.getState().messages[0].id).toBe('new_2');
    });
  });

  describe('clearMessages', () => {
    it('clears all messages when no subject is given', () => {
      useMessageStore.setState({
        messages: [
          makeMessage({ subject: 'a' }),
          makeMessage({ subject: 'b' }),
        ],
      });

      useMessageStore.getState().clearMessages();
      expect(useMessageStore.getState().messages).toHaveLength(0);
    });

    it('clears only messages matching the given subject', () => {
      useMessageStore.setState({
        messages: [
          makeMessage({ id: '1', subject: 'a' }),
          makeMessage({ id: '2', subject: 'b' }),
          makeMessage({ id: '3', subject: 'a' }),
        ],
      });

      useMessageStore.getState().clearMessages('a');

      const remaining = useMessageStore.getState().messages;
      expect(remaining).toHaveLength(1);
      expect(remaining[0].subject).toBe('b');
    });
  });

  describe('getFilteredMessages', () => {
    it('filters messages by subject', () => {
      useMessageStore.setState({
        messages: [
          makeMessage({ id: '1', subject: 'orders' }),
          makeMessage({ id: '2', subject: 'events' }),
          makeMessage({ id: '3', subject: 'orders' }),
        ],
      });

      const result = useMessageStore.getState().getFilteredMessages('orders');
      expect(result).toHaveLength(2);
      expect(result.every((m) => m.subject === 'orders')).toBe(true);
    });

    it('filters by subject and search text in data', () => {
      useMessageStore.setState({
        messages: [
          makeMessage({ id: '1', subject: 'orders', data: 'hello world' }),
          makeMessage({ id: '2', subject: 'orders', data: 'goodbye' }),
        ],
      });

      const result = useMessageStore.getState().getFilteredMessages('orders', 'hello');
      expect(result).toHaveLength(1);
      expect(result[0].data).toBe('hello world');
    });

    it('filters by search text in headers', () => {
      useMessageStore.setState({
        messages: [
          makeMessage({
            id: '1',
            subject: 'orders',
            data: 'payload',
            headers: { 'X-Trace': 'abc123' },
          }),
          makeMessage({ id: '2', subject: 'orders', data: 'other' }),
        ],
      });

      const result = useMessageStore.getState().getFilteredMessages('orders', 'abc123');
      expect(result).toHaveLength(1);
    });

    it('returns empty array when no messages match', () => {
      const result = useMessageStore.getState().getFilteredMessages('nonexistent');
      expect(result).toEqual([]);
    });
  });

  describe('isSubscribed', () => {
    it('returns false when there are no subscriptions', () => {
      expect(useMessageStore.getState().isSubscribed('test')).toBe(false);
    });

    it('returns false for inactive subscriptions', () => {
      useMessageStore.setState({
        subscriptions: [
          { id: 'sub_1', subject: 'test', messageCount: 0, isActive: false },
        ],
      });

      expect(useMessageStore.getState().isSubscribed('test')).toBe(false);
    });

    it('returns true for active subscriptions', () => {
      useMessageStore.setState({
        subscriptions: [
          { id: 'sub_1', subject: 'test', messageCount: 0, isActive: true },
        ],
      });

      expect(useMessageStore.getState().isSubscribed('test')).toBe(true);
    });
  });

  describe('evictExpired', () => {
    it('removes messages older than TTL (5 minutes)', () => {
      const oldDate = new Date(Date.now() - 6 * 60 * 1000);
      const recentDate = new Date();

      useMessageStore.setState({
        messages: [
          makeMessage({ id: 'old', timestamp: oldDate }),
          makeMessage({ id: 'recent', timestamp: recentDate }),
        ],
      });

      useMessageStore.getState().evictExpired();

      const messages = useMessageStore.getState().messages;
      expect(messages).toHaveLength(1);
      expect(messages[0].id).toBe('recent');
    });

    it('keeps all messages if none are expired', () => {
      useMessageStore.setState({
        messages: [
          makeMessage({ id: '1', timestamp: new Date() }),
          makeMessage({ id: '2', timestamp: new Date() }),
        ],
      });

      useMessageStore.getState().evictExpired();
      expect(useMessageStore.getState().messages).toHaveLength(2);
    });
  });
});
