import { useState, useEffect, useCallback, useRef } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '../components/ui/button';
import { useNats } from '../hooks/useNats';
import { toast } from 'sonner';
import { fetchJetStreamStreams } from '../services/nats-service';
import { purgeStream } from '../services/api-client';
import { convertJetStreamData, type StreamInfo } from '../components/streams/types';
import { StreamList } from '../components/streams/StreamList';
import { StreamDetail } from '../components/streams/StreamDetail';
import { MessageBrowser } from '../components/streams/MessageBrowser';
import { CreateStreamDialog, type CreateStreamFormData } from '../components/streams/CreateStreamDialog';

export function Streams() {
  const { connection, isConnected } = useNats();
  const [streams, setStreams] = useState<StreamInfo[]>([]);
  const [selectedStream, setSelectedStream] = useState<StreamInfo | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [messagesStream, setMessagesStream] = useState<string | null>(null);
  const importRef = useRef<HTMLInputElement>(null);

  const fetchStreams = useCallback(async (isInitialLoad = false) => {
    if (!isConnected || !connection) return;
    if (isInitialLoad) setLoading(true);

    try {
      let streamsData: Record<string, unknown>[] = [];
      try {
        streamsData = await connection.jetstream.listStreams();
      } catch (jsError) {
        console.warn('JetStream API not available, using HTTP monitoring API', jsError);
        streamsData = await fetchJetStreamStreams();
      }

      const converted = streamsData.map(convertJetStreamData);
      setStreams((prev) => {
        const changed = prev.length !== converted.length ||
          !prev.every((p, i) => {
            const n = converted[i];
            return p.name === n?.name && p.messages === n?.messages &&
              p.bytes === n?.bytes && p.consumers === n?.consumers;
          });
        return changed ? converted : prev;
      });
    } catch (error) {
      console.error('Failed to fetch streams:', error);
      if (error instanceof Error && !error.message.includes('not enabled')) {
        toast.error('Failed to fetch streams');
      }
    } finally {
      if (isInitialLoad) setLoading(false);
    }
  }, [isConnected, connection]);

  const handleCreateStream = useCallback(async (data: CreateStreamFormData) => {
    if (!connection) { toast.error('Not connected to NATS server'); return; }

    try {
      const config: Record<string, unknown> = {
        name: data.name,
        subjects: data.subjects.split(',').map((s) => s.trim()),
        description: data.description,
        retention: data.retention,
        storage: data.storage,
        maxMsgs: data.maxMsgs,
        maxBytes: data.maxBytes,
        maxAge: data.maxAge,
        replicas: data.replicas,
      };

      if (data.mirror?.trim()) {
        config.mirror = { name: data.mirror.trim() };
      }
      if (data.sources?.trim()) {
        config.sources = data.sources.split(',').map((s) => ({ name: s.trim() }));
      }

      await connection.jetstream.createStream(config);
      setIsCreateOpen(false);
      toast.success(`Stream ${data.name} created successfully`);
      await fetchStreams();
    } catch (err) {
      console.error('Create stream error:', err);
      const msg = err instanceof Error ? err.message : 'Unknown error';
      if (msg.includes('JetStream not enabled')) toast.error('JetStream is not enabled on the NATS server');
      else if (msg.includes('already exists')) toast.error(`Stream "${data.name}" already exists`);
      else toast.error(`Failed to create stream: ${msg}`);
    }
  }, [connection, fetchStreams]);

  const handleDeleteStream = useCallback(async (name: string) => {
    if (!connection) { toast.error('Not connected to NATS server'); return; }
    try {
      await connection.jetstream.deleteStream(name);
      toast.success(`Stream ${name} deleted`);
      await fetchStreams();
    } catch (err) {
      toast.error(`Failed to delete stream: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }, [connection, fetchStreams]);

  const handlePurgeStream = useCallback(async (name: string, subject?: string) => {
    try {
      await purgeStream(name, subject);
      toast.success(subject ? `Purged matching messages from ${name}` : `Stream ${name} purged`);
      await fetchStreams();
    } catch (err) {
      toast.error(`Failed to purge stream: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }, [fetchStreams]);

  const handleExportStream = useCallback((stream: StreamInfo) => {
    const config = {
      name: stream.name,
      subjects: stream.subjects,
      description: stream.description,
      retention: stream.retention,
      storage: stream.storage,
      max_msgs: stream.maxMsgs,
      max_bytes: stream.maxBytes,
      max_age: stream.maxAge,
      num_replicas: stream.replicas,
    };
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stream-${stream.name}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported config for ${stream.name}`);
  }, []);

  const handleImportStream = useCallback(() => {
    importRef.current?.click();
  }, []);

  const handleImportFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !connection) return;

    try {
      const text = await file.text();
      const config = JSON.parse(text);

      if (!config.name) {
        toast.error('Invalid stream config: missing name');
        return;
      }

      await connection.jetstream.createStream({
        name: config.name,
        subjects: config.subjects || [],
        description: config.description,
        retention: config.retention || 'limits',
        storage: config.storage || 'file',
        maxMsgs: config.max_msgs || config.maxMsgs || 0,
        maxBytes: config.max_bytes || config.maxBytes || 0,
        maxAge: config.max_age || config.maxAge || 0,
        replicas: config.num_replicas || config.replicas || 1,
      });
      toast.success(`Stream ${config.name} imported successfully`);
      await fetchStreams();
    } catch (err) {
      toast.error(`Import failed: ${err instanceof Error ? err.message : 'Invalid JSON'}`);
    } finally {
      e.target.value = '';
    }
  }, [connection, fetchStreams]);

  useEffect(() => {
    fetchStreams(true);
    if (isConnected) {
      const interval = setInterval(() => fetchStreams(false), 10000);
      return () => clearInterval(interval);
    }
  }, [isConnected, fetchStreams]);

  if (!isConnected) {
    return (
      <div className="h-full flex flex-col p-4">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">Streams</h1>
            <p className="text-muted-foreground">
              Connect to NATS server to manage JetStream streams
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col p-4 overflow-hidden">
      <div className="flex items-center justify-between mb-6 flex-shrink-0">
        <div>
          <h1 className="text-3xl font-bold">Streams</h1>
          <p className="text-muted-foreground">
            Manage JetStream streams and their configurations
          </p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Create Stream
        </Button>
      </div>

      <input ref={importRef} type="file" accept=".json" className="hidden"
        onChange={handleImportFile} />

      <StreamList
        streams={streams}
        loading={loading}
        onCreateOpen={() => setIsCreateOpen(true)}
        onSelectStream={setSelectedStream}
        onViewMessages={setMessagesStream}
        onPurgeStream={handlePurgeStream}
        onDeleteStream={handleDeleteStream}
        onExportStream={handleExportStream}
        onImportStream={handleImportStream}
      />

      <StreamDetail stream={selectedStream} onClose={() => setSelectedStream(null)} />
      <MessageBrowser streamName={messagesStream} onClose={() => setMessagesStream(null)} />
      <CreateStreamDialog open={isCreateOpen} onOpenChange={setIsCreateOpen} onSubmit={handleCreateStream} />
    </div>
  );
}
