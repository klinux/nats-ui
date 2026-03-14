import { useNatsStore } from '@/stores/nats-store';

/**
 * Convenience hook that provides the same interface as the old NatsContext.
 * All state now lives in Zustand — this is just a selector wrapper.
 */
export function useNats() {
  const connection = useNatsStore((s) => s.connection);
  const status = useNatsStore((s) => s.status);
  const error = useNatsStore((s) => s.error);
  const isConnected = useNatsStore((s) => s.isConnected);
  const username = useNatsStore((s) => s.username);
  const connect = useNatsStore((s) => s.connect);
  const disconnect = useNatsStore((s) => s.disconnect);

  return {
    connection,
    status,
    error,
    isConnected,
    username,
    connect,
    disconnect,
  };
}
