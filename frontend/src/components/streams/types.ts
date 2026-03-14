export interface StreamInfo {
  name: string;
  subjects: string[];
  description?: string;
  retention: 'limits' | 'interest' | 'workqueue';
  storage: 'file' | 'memory';
  messages: number;
  bytes: number;
  maxMsgs: number;
  maxBytes: number;
  maxAge: number;
  replicas: number;
  created: Date;
  consumers: number;
  mirror?: string;
  sources?: string[];
}

/** Convert raw JetStream API data to StreamInfo */
export function convertJetStreamData(jsData: Record<string, unknown>): StreamInfo {
  const config = (jsData.config as Record<string, unknown>) || {};
  const state = (jsData.state as Record<string, unknown>) || {};
  const mirror = config.mirror as Record<string, unknown> | undefined;
  const sources = config.sources as Record<string, unknown>[] | undefined;

  return {
    name: (config.name as string) || '',
    subjects: (config.subjects as string[]) || [],
    description: (config.description as string) || '',
    retention: ((config.retention as string) || 'limits') as StreamInfo['retention'],
    storage: ((config.storage as string) || 'file') as StreamInfo['storage'],
    messages: (state.messages as number) || 0,
    bytes: (state.bytes as number) || 0,
    maxMsgs: (config.max_msgs as number) || 0,
    maxBytes: (config.max_bytes as number) || 0,
    maxAge: (config.max_age as number) ? (config.max_age as number) / 1000000000 : 0,
    replicas: (config.num_replicas as number) || 1,
    created: new Date((jsData.created as string | number) || Date.now()),
    consumers: (state.consumer_count as number) || 0,
    mirror: mirror?.name as string | undefined,
    sources: sources?.map((s) => s.name as string),
  };
}

export function formatDuration(ms: number): string {
  if (ms === 0) return 'Forever';
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d`;
  if (hours > 0) return `${hours}h`;
  if (minutes > 0) return `${minutes}m`;
  return `${seconds}s`;
}
