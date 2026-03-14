import { toast } from 'sonner';
import * as api from './api-client';
import { subjectTracker } from './subject-tracker';
import { useMessageStore } from '@/stores/message-store';

// Compatibility layer: same interface as before, but uses backend API instead of nats.ws

export interface NatsService {
  publish: (subject: string, data: unknown, headers?: Record<string, string>) => Promise<void>;
  subscribe: (subject: string, callback: (msg: { subject: string; data: unknown; headers?: Record<string, string>; timestamp: number; reply?: string }) => void) => Promise<() => void>;
  close: () => Promise<void>;
  isClosed: () => boolean;
  jetstream: JetStreamManager;
}

class ApiNatsService implements NatsService {
  private closed = false;
  public readonly jetstream: JetStreamManager;

  constructor() {
    this.jetstream = new JetStreamManager();
  }

  async publish(subject: string, data: unknown, msgHeaders?: Record<string, string>): Promise<void> {
    await api.publishMessage(subject, data, msgHeaders);
    const payload = typeof data === 'string' ? data : JSON.stringify(data);
    subjectTracker.track(subject, payload);

    // Optimistic: add message to store immediately if subscribed
    const store = useMessageStore.getState();
    if (store.isSubscribed(subject)) {
      const msgId = `msg_${Date.now()}_${subject}_${payload.slice(0, 50)}`;
      store.addMessage({
        id: msgId,
        subject,
        data: payload,
        headers: msgHeaders,
        timestamp: new Date(),
      });
    }
  }

  async subscribe(subject: string, callback: (msg: { subject: string; data: unknown; headers?: Record<string, string>; timestamp: number; reply?: string }) => void): Promise<() => void> {
    const cleanup = api.subscribeSSE(subject, (msg) => {
      subjectTracker.track(msg.subject, typeof msg.data === 'string' ? msg.data : JSON.stringify(msg.data));
      callback(msg);
    }, () => {
      console.warn('SSE connection error for subject:', subject);
    });
    return cleanup;
  }

  async close(): Promise<void> {
    this.closed = true;
  }

  isClosed(): boolean {
    return this.closed;
  }
}

export async function createNatsService(): Promise<NatsService> {
  try {
    const health = await api.checkHealth();
    if (!health.connected) {
      throw new Error('Backend not connected to NATS');
    }
    return new ApiNatsService();
  } catch (error) {
    console.error('Failed to connect to backend:', error);
    toast.error(`Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    throw error;
  }
}

// Monitoring API functions - now proxy through backend
export async function fetchNatsInfo(): Promise<Record<string, unknown> | null> {
  try {
    return await api.fetchServerInfo();
  } catch (error) {
    console.warn('Could not fetch NATS info:', error);
    return null;
  }
}

export async function fetchNatsConnections(): Promise<Record<string, unknown> | null> {
  try {
    return await api.fetchConnections();
  } catch (error) {
    console.warn('Could not fetch NATS connections:', error);
    return null;
  }
}

export async function fetchJetStreamInfo(): Promise<Record<string, unknown> | null> {
  try {
    return await api.fetchJetStreamInfo();
  } catch (error) {
    console.warn('Could not fetch JetStream info:', error);
    return null;
  }
}

export async function fetchActiveSubjects(): Promise<string[]> {
  try {
    return await api.fetchActiveSubjects();
  } catch (error) {
    console.warn('Could not fetch active subjects:', error);
    return [];
  }
}

export async function fetchJetStreamStreams(): Promise<Record<string, unknown>[]> {
  try {
    const streams = await api.listStreams();
    return streams as unknown as Record<string, unknown>[];
  } catch (error) {
    console.warn('Could not fetch JetStream streams:', error);
    return [];
  }
}

export async function fetchAllConsumers(): Promise<Record<string, unknown>[]> {
  try {
    const streams = await api.listStreams();
    const consumers: Record<string, unknown>[] = [];
    for (const stream of streams) {
      const cfg = stream.config as Record<string, unknown>;
      const name = cfg?.name as string;
      if (name) {
        const streamConsumers = await api.listConsumers(name);
        consumers.push(...streamConsumers.map(c => ({ ...c, stream_name: name } as unknown as Record<string, unknown>)));
      }
    }
    return consumers;
  } catch (error) {
    console.warn('Could not fetch consumers:', error);
    return [];
  }
}

// JetStream Manager - uses API client
export class JetStreamManager {
  async createStream(config: {
    name: string;
    subjects: string[];
    description?: string;
    retention: 'limits' | 'interest' | 'workqueue';
    storage: 'file' | 'memory';
    maxMsgs: number;
    maxBytes: number;
    maxAge: number;
    replicas: number;
  }): Promise<Record<string, unknown>> {
    return await api.createStream(config) as unknown as Record<string, unknown>;
  }

  async deleteStream(streamName: string): Promise<void> {
    await api.deleteStream(streamName);
  }

  async listStreams(): Promise<Record<string, unknown>[]> {
    return await api.listStreams() as unknown as Record<string, unknown>[];
  }

  async getStreamInfo(streamName: string): Promise<Record<string, unknown> | null> {
    try {
      return await api.getStream(streamName) as unknown as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  async listConsumers(streamName: string): Promise<Record<string, unknown>[]> {
    return await api.listConsumers(streamName) as unknown as Record<string, unknown>[];
  }

  async getConsumerInfo(streamName: string, consumerName: string): Promise<Record<string, unknown> | null> {
    try {
      return await api.getConsumer(streamName, consumerName) as unknown as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  async deleteConsumer(streamName: string, consumerName: string): Promise<void> {
    await api.deleteConsumer(streamName, consumerName);
  }

  async listKVBuckets(): Promise<string[]> {
    const buckets = await api.listKVBuckets();
    return buckets.map(b => b.name);
  }

  async createKVBucket(name: string, ttl?: number): Promise<void> {
    await api.createKVBucket(name, ttl);
  }

  async deleteKVBucket(name: string): Promise<void> {
    await api.deleteKVBucket(name);
  }

  async getKVKeys(bucket: string): Promise<string[]> {
    return await api.listKVKeys(bucket);
  }

  async getKVValue(bucket: string, key: string): Promise<string | null> {
    try {
      const result = await api.getKVValue(bucket, key);
      return result.value;
    } catch {
      return null;
    }
  }

  async putKVValue(bucket: string, key: string, value: string): Promise<void> {
    await api.putKVValue(bucket, key, value);
  }

  async deleteKVKey(bucket: string, key: string): Promise<void> {
    await api.deleteKVKey(bucket, key);
  }
}
