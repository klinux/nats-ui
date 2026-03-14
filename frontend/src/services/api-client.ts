const API_BASE = import.meta.env.VITE_API_URL || '';

function getToken(): string | null {
  return localStorage.getItem('nats-ui-token');
}

export function setToken(token: string) {
  localStorage.setItem('nats-ui-token', token);
}

export function clearToken() {
  localStorage.removeItem('nats-ui-token');
}

export function hasToken(): boolean {
  return !!getToken();
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}/api${path}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    clearToken();
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(body.error || `HTTP ${response.status}`);
  }

  return response.json();
}

// Auth
export async function login(username: string, password: string): Promise<{ token: string; username: string }> {
  const res = await request<{ token: string; username: string }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
  setToken(res.token);
  return res;
}

export async function getMe(): Promise<{ username: string }> {
  return request('/auth/me');
}

export async function getOAuth2Providers(): Promise<{ name: string; clientId: string }[]> {
  return request('/auth/oauth2/providers');
}

export function getOAuth2AuthorizeURL(provider: string): string {
  return `${API_BASE}/api/auth/oauth2/${provider}/authorize`;
}

// Server
export async function fetchServerInfo(): Promise<Record<string, unknown>> {
  return request('/server/info');
}

export async function fetchConnections(subs?: boolean): Promise<Record<string, unknown>> {
  const q = subs ? '?subs=1' : '';
  return request(`/server/connections${q}`);
}

export async function fetchJetStreamInfo(params?: string): Promise<Record<string, unknown>> {
  const q = params ? `?${params}` : '';
  return request(`/server/jetstream${q}`);
}

// Streams
export interface StreamInfo {
  config: Record<string, unknown>;
  state: Record<string, unknown>;
}

export async function listStreams(): Promise<StreamInfo[]> {
  return request('/streams');
}

export async function getStream(name: string): Promise<StreamInfo> {
  return request(`/streams/${name}`);
}

export async function createStream(config: {
  name: string;
  subjects: string[];
  description?: string;
  retention: string;
  storage: string;
  maxMsgs: number;
  maxBytes: number;
  maxAge: number;
  replicas: number;
}): Promise<StreamInfo> {
  return request('/streams', { method: 'POST', body: JSON.stringify(config) });
}

export async function updateStream(name: string, config: {
  subjects: string[];
  description?: string;
  retention: string;
  storage: string;
  maxMsgs: number;
  maxBytes: number;
  maxAge: number;
  replicas: number;
}): Promise<StreamInfo> {
  return request(`/streams/${name}`, { method: 'PUT', body: JSON.stringify(config) });
}

export async function deleteStream(name: string): Promise<void> {
  await request(`/streams/${name}`, { method: 'DELETE' });
}

export async function purgeStream(name: string): Promise<void> {
  await request(`/streams/${name}/purge`, { method: 'POST' });
}

export interface StreamMessage {
  sequence: number;
  subject: string;
  data: unknown;
  headers: Record<string, string>;
  timestamp: string;
}

export async function getStreamMessages(name: string, last?: number): Promise<StreamMessage[]> {
  const q = last ? `?last=${last}` : '';
  return request(`/streams/${name}/messages${q}`);
}

// Consumers
export interface ConsumerInfo {
  config: Record<string, unknown>;
  stream_name: string;
  name: string;
  delivered: Record<string, unknown>;
  ack_floor: Record<string, unknown>;
  num_pending: number;
  num_waiting: number;
  num_ack_pending: number;
  created: string;
}

export async function listConsumers(streamName: string): Promise<ConsumerInfo[]> {
  return request(`/streams/${streamName}/consumers`);
}

export async function getConsumer(streamName: string, consumerName: string): Promise<ConsumerInfo> {
  return request(`/streams/${streamName}/consumers/${consumerName}`);
}

export async function createConsumer(streamName: string, config: {
  name: string;
  filterSubject?: string;
  deliverPolicy?: string;
  ackPolicy?: string;
  maxDeliver?: number;
  maxAckPending?: number;
  description?: string;
  durable?: boolean;
}): Promise<ConsumerInfo> {
  return request(`/streams/${streamName}/consumers`, { method: 'POST', body: JSON.stringify(config) });
}

export async function deleteConsumer(streamName: string, consumerName: string): Promise<void> {
  await request(`/streams/${streamName}/consumers/${consumerName}`, { method: 'DELETE' });
}

// KV Store
export interface KVBucket {
  name: string;
  values?: number;
  bytes?: number;
  history?: number;
  ttl?: number;
}

export async function listKVBuckets(): Promise<KVBucket[]> {
  return request('/kv');
}

export async function createKVBucket(name: string, ttl?: number, history?: number): Promise<KVBucket> {
  return request('/kv', { method: 'POST', body: JSON.stringify({ name, ttl, history }) });
}

export async function deleteKVBucket(name: string): Promise<void> {
  await request(`/kv/${name}`, { method: 'DELETE' });
}

export async function listKVKeys(bucket: string): Promise<string[]> {
  return request(`/kv/${bucket}/keys`);
}

export async function getKVValue(bucket: string, key: string): Promise<{ key: string; value: string; revision: number; created: string }> {
  return request(`/kv/${bucket}/keys/${key}`);
}

export async function putKVValue(bucket: string, key: string, value: string): Promise<{ key: string; revision: number }> {
  return request(`/kv/${bucket}/keys/${key}`, { method: 'PUT', body: JSON.stringify({ value }) });
}

export async function deleteKVKey(bucket: string, key: string): Promise<void> {
  await request(`/kv/${bucket}/keys/${key}`, { method: 'DELETE' });
}

// Messages
export async function publishMessage(subject: string, data: unknown, headers?: Record<string, string>): Promise<void> {
  await request('/messages/publish', { method: 'POST', body: JSON.stringify({ subject, data, headers }) });
}

export async function fetchActiveSubjects(): Promise<string[]> {
  return request('/messages/subjects');
}

export interface RequestReplyResponse {
  subject: string;
  data: unknown;
  headers: Record<string, string>;
  timestamp: number;
}

export async function requestReply(subject: string, data: unknown, headers?: Record<string, string>, timeout?: number): Promise<RequestReplyResponse> {
  return request('/messages/request', { method: 'POST', body: JSON.stringify({ subject, data, headers, timeout }) });
}

// Server monitoring
export async function fetchSubscriptions(): Promise<Record<string, unknown>> {
  return request('/server/subscriptions');
}

export async function fetchRoutes(): Promise<Record<string, unknown>> {
  return request('/server/routes');
}

// SSE Subscribe
export function subscribeSSE(
  subject: string,
  onMessage: (msg: { subject: string; data: unknown; headers?: Record<string, string>; timestamp: number; reply?: string }) => void,
  onError?: (err: Event) => void
): () => void {
  const token = getToken();
  const url = `${API_BASE}/api/messages/subscribe?subject=${encodeURIComponent(subject)}&token=${encodeURIComponent(token || '')}`;
  const es = new EventSource(url);

  es.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      onMessage(msg);
    } catch (e) {
      console.error('Failed to parse SSE message:', e);
    }
  };

  es.onerror = (err) => {
    onError?.(err);
  };

  return () => es.close();
}

// Health
export async function checkHealth(): Promise<{ status: string; connected: boolean }> {
  const response = await fetch(`${API_BASE}/api/health`);
  return response.json();
}
