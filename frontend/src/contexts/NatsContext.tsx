import { useEffect, type ReactNode } from 'react';
import { useNatsStore } from '@/stores/nats-store';
import { useMessageStore } from '@/stores/message-store';
import { hasToken } from '@/services/api-client';

interface NatsProviderProps {
  children: ReactNode;
}

/**
 * Thin provider that handles side effects (auto-connect, OAuth, health check).
 * All state lives in Zustand stores — this just orchestrates lifecycle.
 */
export function NatsProvider({ children }: NatsProviderProps) {
  const connect = useNatsStore((s) => s.connect);
  const handleOAuthToken = useNatsStore((s) => s.handleOAuthToken);
  const checkHealthStatus = useNatsStore((s) => s.checkHealthStatus);
  const status = useNatsStore((s) => s.status);

  // Auto-connect if token exists (mount-only)
  useEffect(() => {
    if (hasToken()) {
      connect();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle OAuth2 token from URL (mount-only)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    if (token) {
      handleOAuthToken(token);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Periodic health check
  useEffect(() => {
    if (status !== 'connected') return;
    const interval = setInterval(checkHealthStatus, 30000);
    return () => clearInterval(interval);
  }, [status, checkHealthStatus]);

  // TTL eviction for messages
  useEffect(() => {
    const interval = setInterval(() => {
      useMessageStore.getState().evictExpired();
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  return <>{children}</>;
}
