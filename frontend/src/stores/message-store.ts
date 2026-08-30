import { create } from 'zustand';
import { toast } from 'sonner';
import type { NatsService } from '@/services/nats-service';
import { filterMessages } from '@/lib/message-filter';
import { idIndex, retargetIndex } from './message-index';

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

/**
 * How long a message is kept. Configurable because messages silently vanishing
 * mid-investigation is surprising; set VITE_MESSAGE_TTL_MS to 0 to keep them
 * until the cap evicts them.
 */
const TTL_MS = (() => {
  const raw = import.meta.env.VITE_MESSAGE_TTL_MS;
  if (raw === undefined || raw === '') return 5 * 60 * 1000;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 5 * 60 * 1000;
})();

/** Unique message id; two identical payloads in the same millisecond are still
 * distinct messages, which a content-derived id could not express. */
function nextMessageId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `msg_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

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
      const ids = idIndex(state.messages);
      if (ids.has(msg.id)) return state;

      const messages = [msg, ...state.messages];
      ids.add(msg.id);
      if (messages.length > MAX_MESSAGES) {
        const dropped = messages.pop();
        if (dropped) ids.delete(dropped.id);
      }
      retargetIndex(messages);

      return { messages };
    });
  },

  subscribe: async (connection, subject, queueGroup) => {
    const subId = `sub_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;

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
        get().addMessage({
          id: nextMessageId(),
          subject: msg.subject,
          data: msgData,
          headers: msg.headers,
          timestamp: new Date(msg.timestamp),
          replyTo: msg.reply,
        });

        set((state) => ({
          subscriptions: state.subscriptions.map((s) =>
            s.id === subId ? { ...s, messageCount: s.messageCount + 1 } : s,
          ),
        }));
      });

      set((state) => ({
        subscriptions: state.subscriptions.map((s) =>
          s.id === subId ? { ...s, unsubscribe: unsub } : s,
        ),
      }));

      toast.success(`Subscribed to ${subject}`);
    } catch {
      // Drop the pending entry, or the UI shows a subscription that never was.
      set((state) => ({ subscriptions: state.subscriptions.filter((s) => s.id !== subId) }));
      toast.error('Failed to subscribe');
    }
  },

  unsubscribe: (subId) => {
    const sub = get().subscriptions.find((s) => s.id === subId);
    if (!sub) return;

    try {
      sub.unsubscribe?.();
    } catch (err) {
      console.warn(`Failed to close subscription to ${sub.subject}:`, err);
    }

    // Remove rather than flag: flagged entries accumulated forever and every
    // isSubscribed lookup had to walk past them.
    set((state) => ({ subscriptions: state.subscriptions.filter((s) => s.id !== subId) }));
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

  getFilteredMessages: (subject, search) => filterMessages(get().messages, subject, search),

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
    if (TTL_MS === 0) return;
    const cutoff = new Date(Date.now() - TTL_MS);
    set((state) => {
      const filtered = state.messages.filter((m) => m.timestamp > cutoff);
      return filtered.length !== state.messages.length ? { messages: filtered } : state;
    });
  },
}));
