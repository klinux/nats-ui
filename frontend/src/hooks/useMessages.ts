import { useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useMessageStore } from '@/stores/message-store';
import type { NatsService } from '@/services/nats-service';

/**
 * Convenience hook wrapping the message store.
 * Binds the connection so callers don't need to pass it every time.
 *
 * Actions are selected individually rather than by subscribing to the whole
 * store: `useMessageStore()` re-rendered every consumer on every single message
 * that arrived, which on a busy subject is the entire render budget.
 */
export function useMessages(connection: NatsService | null) {
  const messages = useMessageStore((s) => s.messages);
  const subscriptions = useMessageStore((s) => s.subscriptions);

  const {
    subscribe: subscribeTo,
    unsubscribe,
    isSubscribed,
    getSubscription,
    toggleSubscription: toggle,
    clearMessages,
    getFilteredMessages,
    exportMessages,
  } = useMessageStore(
    useShallow((s) => ({
      subscribe: s.subscribe,
      unsubscribe: s.unsubscribe,
      isSubscribed: s.isSubscribed,
      getSubscription: s.getSubscription,
      toggleSubscription: s.toggleSubscription,
      clearMessages: s.clearMessages,
      getFilteredMessages: s.getFilteredMessages,
      exportMessages: s.exportMessages,
    })),
  );

  const subscribe = useCallback(
    (subject: string, queueGroup?: string) => {
      if (!connection) return Promise.resolve();
      return subscribeTo(connection, subject, queueGroup);
    },
    [connection, subscribeTo],
  );

  const toggleSubscription = useCallback(
    (subject: string) => {
      if (!connection) return;
      toggle(connection, subject);
    },
    [connection, toggle],
  );

  return {
    messages,
    subscriptions,
    subscribe,
    unsubscribe,
    isSubscribed,
    getSubscription,
    toggleSubscription,
    clearMessages,
    getFilteredMessages,
    exportMessages,
  };
}
