import { useEffect, useState, useCallback, type ReactNode } from 'react';
import { toast } from 'sonner';
import { createNatsService } from '@/services/nats-service';
import { NatsContext, type ConnectionConfig, type ConnectionStatus, type NatsContextType } from './nats-context';
import { hasToken, setToken, clearToken, getMe, checkHealth } from '@/services/api-client';

interface NatsProviderProps {
  children: ReactNode;
}

export function NatsProvider({ children }: NatsProviderProps) {
  const [connection, setConnection] = useState<NatsContextType['connection']>(null);
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [error, setError] = useState<string | null>(null);
  const [connectionConfig] = useState<ConnectionConfig>({
    server: 'backend',
    httpUrl: '/api',
    timeout: 5000,
  });

  const connectToBackend = useCallback(async () => {
    if (status === 'connecting' || status === 'connected') return;
    if (!hasToken()) return;

    setStatus('connecting');
    setError(null);

    try {
      await getMe();
      const service = await createNatsService();
      setConnection(service);
      setStatus('connected');
      toast.success('Connected to NATS backend');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      setStatus('error');
    }
  }, [status]);

  const disconnect = useCallback(async () => {
    if (connection && !connection.isClosed()) {
      await connection.close();
    }
    setConnection(null);
    setStatus('disconnected');
    setError(null);
    clearToken();
    toast.info('Disconnected');
  }, [connection]);

  const updateConfig = useCallback((_newConfig: Partial<ConnectionConfig>) => {
    // Config is now managed by backend
  }, []);

  // Auto-connect if token exists
  useEffect(() => {
    if (hasToken() && status === 'disconnected') {
      connectToBackend();
    }
  }, [connectToBackend, status]);

  // Handle OAuth2 token from URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    if (token) {
      setToken(token);
      window.history.replaceState({}, '', window.location.pathname);
      connectToBackend();
    }
  }, [connectToBackend]);

  // Periodic health check
  useEffect(() => {
    if (status !== 'connected') return;
    const interval = setInterval(async () => {
      try {
        const health = await checkHealth();
        if (!health.connected) {
          setError('Backend lost NATS connection');
          setStatus('error');
        }
      } catch {
        // ignore
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [status]);

  const contextValue: NatsContextType = {
    connection,
    status,
    error,
    config: connectionConfig,
    connect: async () => { await connectToBackend(); },
    disconnect,
    updateConfig,
    isConnected: status === 'connected',
  };

  return (
    <NatsContext.Provider value={contextValue}>
      {children}
    </NatsContext.Provider>
  );
}
