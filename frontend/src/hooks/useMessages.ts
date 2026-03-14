import { useCallback } from 'react';
import { useMessageStore } from '@/stores/message-store';
import type { NatsService } from '@/services/nats-service';

/**
 * Convenience hook wrapping the message store.
 * Binds the connection so callers don't need to pass it every time.
 */
export function useMessages(connection: NatsService | null) {
  const store = useMessageStore();

  const subscribe = useCallback(
    (subject: string, queueGroup?: string) => {
      if (!connection) return Promise.resolve();
      return store.subscribe(connection, subject, queueGroup);
    },
    [connection, store],
  );

  const toggleSubscription = useCallback(
    (subject: string) => {
      if (!connection) return;
      store.toggleSubscription(connection, subject);
    },
    [connection, store],
  );

  return {
    messages: store.messages,
    subscriptions: store.subscriptions,
    subscribe,
    unsubscribe: store.unsubscribe,
    isSubscribed: store.isSubscribed,
    getSubscription: store.getSubscription,
    toggleSubscription,
    clearMessages: store.clearMessages,
    getFilteredMessages: store.getFilteredMessages,
    exportMessages: store.exportMessages,
  };
}
