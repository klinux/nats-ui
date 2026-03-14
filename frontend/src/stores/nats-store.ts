import { create } from 'zustand';
import { toast } from 'sonner';
import { createNatsService, type NatsService } from '@/services/nats-service';
import { hasToken, setToken, clearToken, getMe, checkHealth } from '@/services/api-client';

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

interface NatsState {
  connection: NatsService | null;
  status: ConnectionStatus;
  error: string | null;
  username: string | null;
  isConnected: boolean;
}

interface NatsActions {
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  handleOAuthToken: (token: string) => void;
  checkHealthStatus: () => Promise<void>;
  _setError: (error: string) => void;
}

// Lock to prevent concurrent connect attempts
let connecting = false;

export const useNatsStore = create<NatsState & NatsActions>((set, get) => ({
  connection: null,
  status: 'disconnected',
  error: null,
  username: null,
  isConnected: false,

  connect: async () => {
    if (connecting) return;
    if (!hasToken()) return;

    connecting = true;
    set({ status: 'connecting', error: null, isConnected: false });

    try {
      const me = await getMe();
      const service = await createNatsService();
      set({
        connection: service,
        status: 'connected',
        error: null,
        username: me.username,
        isConnected: true,
      });
      toast.success('Connected to NATS backend');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      set({ error: message, status: 'error', isConnected: false });
    } finally {
      connecting = false;
    }
  },

  disconnect: async () => {
    const { connection } = get();
    if (connection && !connection.isClosed()) {
      await connection.close();
    }
    clearToken();
    set({
      connection: null,
      status: 'disconnected',
      error: null,
      username: null,
      isConnected: false,
    });
    toast.info('Disconnected');
  },

  handleOAuthToken: (token: string) => {
    setToken(token);
    window.history.replaceState({}, '', window.location.pathname);
    get().connect();
  },

  checkHealthStatus: async () => {
    if (get().status !== 'connected') return;
    try {
      const health = await checkHealth();
      if (!health.connected) {
        set({
          error: 'Backend lost NATS connection',
          status: 'error',
          isConnected: false,
        });
      }
    } catch {
      // ignore transient errors
    }
  },

  _setError: (error: string) => {
    set({ error, status: 'error', isConnected: false });
  },
}));
