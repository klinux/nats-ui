import { create } from 'zustand';
import { toast } from 'sonner';
import type { NatsService } from '@/services/nats-service';

export interface Message {
  id: string;
  subject: string;
  data: string;
  headers?: Record<string, string>;
  timestamp: Date;
  replyTo?: string;
}

export interface Subscription {
  id: string;
  subject: string;
  queueGroup?: string;
  messageCount: number;
  isActive: boolean;
  unsubscribe?: () => void;
}

const MAX_MESSAGES = 1000;
const TTL_MS = 5 * 60 * 1000;

interface MessageState {
  messages: Message[];
  subscriptions: Subscription[];
}

interface MessageActions {
  subscribe: (connection: NatsService, subject: string, queueGroup?: string) => Promise<void>;
  unsubscribe: (subId: string) => void;
  isSubscribed: (subject: string) => boolean;
  getSubscription: (subject: string) => Subscription | undefined;
  toggleSubscription: (connection: NatsService, subject: string) => void;
  addMessage: (msg: Message) => void;
  clearMessages: (subject?: string) => void;
  getFilteredMessages: (subject: string, search?: string) => Message[];
  exportMessages: (subject: string) => void;
  evictExpired: () => void;
}

export const useMessageStore = create<MessageState & MessageActions>((set, get) => ({
  messages: [],
  subscriptions: [],

  addMessage: (msg) => {
    set((state) => {
      // Deduplicate by id
      if (state.messages.some((m) => m.id === msg.id)) return state;
      return { messages: [msg, ...state.messages].slice(0, MAX_MESSAGES) };
    });
  },

  subscribe: async (connection, subject, queueGroup) => {
    const subId = `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const newSub: Subscription = {
      id: subId,
      subject,
      queueGroup,
      messageCount: 0,
      isActive: true,
    };

    set((state) => ({ subscriptions: [...state.subscriptions, newSub] }));

    try {
      const unsub = await connection.subscribe(subject, (msg) => {
        const msgData = typeof msg.data === 'string' ? msg.data : JSON.stringify(msg.data);
        const msgId = `msg_${msg.timestamp}_${msg.subject}_${msgData.slice(0, 50)}`;
        const message: Message = {
          id: msgId,
          subject: msg.subject,
          data: msgData,
          headers: msg.headers,
          timestamp: new Date(msg.timestamp),
          replyTo: msg.reply,
        };

        set((state) => {
          // Deduplicate: skip if message with same id already exists (optimistic add)
          if (state.messages.some((m) => m.id === msgId)) {
            return {
              subscriptions: state.subscriptions.map((s) =>
                s.id === subId ? { ...s, messageCount: s.messageCount + 1 } : s,
              ),
            };
          }
          return {
            messages: [message, ...state.messages].slice(0, MAX_MESSAGES),
            subscriptions: state.subscriptions.map((s) =>
              s.id === subId ? { ...s, messageCount: s.messageCount + 1 } : s,
            ),
          };
        });
      });

      set((state) => ({
        subscriptions: state.subscriptions.map((s) =>
          s.id === subId ? { ...s, unsubscribe: unsub } : s,
        ),
      }));

      toast.success(`Subscribed to ${subject}`);
    } catch {
      toast.error('Failed to subscribe');
    }
  },

  unsubscribe: (subId) => {
    set((state) => ({
      subscriptions: state.subscriptions.map((s) => {
        if (s.id === subId) {
          try { s.unsubscribe?.(); } catch { /* ignore */ }
          return { ...s, isActive: false };
        }
        return s;
      }),
    }));
    toast.success('Unsubscribed');
  },

  isSubscribed: (subject) => {
    return get().subscriptions.some((s) => s.subject === subject && s.isActive);
  },

  getSubscription: (subject) => {
    return get().subscriptions.find((s) => s.subject === subject && s.isActive);
  },

  toggleSubscription: (connection, subject) => {
    const sub = get().subscriptions.find((s) => s.subject === subject && s.isActive);
    if (sub) {
      get().unsubscribe(sub.id);
    } else {
      get().subscribe(connection, subject);
    }
  },

  clearMessages: (subject) => {
    if (subject) {
      set((state) => ({ messages: state.messages.filter((m) => m.subject !== subject) }));
    } else {
      set({ messages: [] });
    }
    toast.success('Messages cleared');
  },

  getFilteredMessages: (subject, search) => {
    let filtered = get().messages.filter((m) => m.subject === subject);
    if (search?.trim()) {
      const q = search.toLowerCase();
      filtered = filtered.filter(
        (m) =>
          m.data.toLowerCase().includes(q) ||
          m.subject.toLowerCase().includes(q) ||
          Object.values(m.headers || {}).some((v) => v.toLowerCase().includes(q)),
      );
    }
    return filtered;
  },

  exportMessages: (subject) => {
    const filtered = get().messages.filter((m) => m.subject === subject);
    const data = filtered.map((msg) => ({
      subject: msg.subject,
      data: msg.data,
      headers: msg.headers,
      timestamp: msg.timestamp.toISOString(),
      replyTo: msg.replyTo,
    }));
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nats-${subject}-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Messages exported');
  },

  evictExpired: () => {
    const cutoff = new Date(Date.now() - TTL_MS);
    set((state) => {
      const filtered = state.messages.filter((m) => m.timestamp > cutoff);
      return filtered.length !== state.messages.length ? { messages: filtered } : state;
    });
  },
}));
