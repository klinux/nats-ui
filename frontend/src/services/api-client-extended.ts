/**
 * Extended API client functions for health, seal, consumer pull,
 * KV watch, system events, and benchmarks.
 *
 * Re-exports everything from the base api-client for convenience.
 */

const API_BASE = import.meta.env.VITE_API_URL || '';

function getToken(): string | null {
  return localStorage.getItem('nats-ui-token');
}

// Health check
export async function fetchHealthCheck(): Promise<unknown> {
  const token = getToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const response = await fetch(`${API_BASE}/api/server/healthz`, { headers });
  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(body.error || `HTTP ${response.status}`);
  }
  return response.json();
}

// Stream seal
export async function sealStream(name: string): Promise<void> {
  const token = getToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const response = await fetch(`${API_BASE}/api/streams/${encodeURIComponent(name)}/seal`, {
    method: 'POST',
    headers,
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(body.error || `HTTP ${response.status}`);
  }
}

// Consumer next messages
export interface PulledMessage {
  sequence: number;
  subject: string;
  data: unknown;
  timestamp: string;
  headers?: Record<string, string>;
}

export async function fetchNextMessages(
  stream: string,
  consumer: string,
  batch = 1,
): Promise<PulledMessage[]> {
  const token = getToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const url = `${API_BASE}/api/streams/${encodeURIComponent(stream)}/consumers/${encodeURIComponent(consumer)}/next?batch=${batch}`;
  const response = await fetch(url, { method: 'POST', headers });
  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(body.error || `HTTP ${response.status}`);
  }
  return response.json();
}

// KV watch (SSE)
export function watchKVBucket(
  bucket: string,
  key: string,
  onEvent: (data: unknown) => void,
): () => void {
  const token = getToken();
  const url = `${API_BASE}/api/kv/${encodeURIComponent(bucket)}/watch?key=${encodeURIComponent(key)}`;
  const es = new EventSource(url + (token ? `&token=${token}` : ''));
  es.onmessage = (e) => {
    try {
      onEvent(JSON.parse(e.data));
    } catch (err) {
      console.error('Failed to parse KV watch event:', err);
    }
  };
  return () => es.close();
}

// System events (SSE)
export interface SystemEvent {
  subject: string;
  data: string;
  timestamp: number;
}

export function subscribeSystemEvents(
  onEvent: (data: SystemEvent) => void,
): () => void {
  const token = getToken();
  const url = `${API_BASE}/api/server/events`;
  const es = new EventSource(url + (token ? `?token=${token}` : ''));
  es.onmessage = (e) => {
    try {
      onEvent(JSON.parse(e.data));
    } catch (err) {
      console.error('Failed to parse system event:', err);
    }
  };
  return () => es.close();
}

// Benchmark
export interface BenchRequest {
  subject: string;
  msg_size?: number;
  num_msgs?: number;
  num_pubs?: number;
  num_subs?: number;
}

export interface BenchResult {
  duration_ms: number;
  msgs_per_sec: number;
  bytes_per_sec: number;
  total_msgs: number;
  total_bytes: number;
  msg_size: number;
  publishers: number;
  subscribers: number;
}

export async function runBenchmark(req: BenchRequest): Promise<BenchResult> {
  const token = getToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const response = await fetch(`${API_BASE}/api/bench`, {
    method: 'POST',
    headers,
    body: JSON.stringify(req),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(body.error || `HTTP ${response.status}`);
  }
  return response.json();
}
