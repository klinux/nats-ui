import { useState, useCallback, useEffect } from 'react';
import { Eye } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '../components/ui/button';
import { useNats } from '../hooks/useNats';

import { CreateBucketDialog } from '../components/kv/CreateBucketDialog';
import { EditKeyDialog } from '../components/kv/EditKeyDialog';
import { BucketList } from '../components/kv/BucketList';
import { KeyValueTable } from '../components/kv/KeyValueTable';
import { KVWatchPanel } from '../components/kv/KVWatchPanel';
import { KVStatsCards } from '../components/kv/KVStatsCards';
import type { KVEntry, KVFormData, BucketFormData } from '../components/kv/types';

export function KVStore() {
  const { connection, isConnected } = useNats();
  const [entries, setEntries] = useState<KVEntry[]>([]);
  const [buckets, setBuckets] = useState<string[]>([]);
  const [selectedEntry, setSelectedEntry] = useState<KVEntry | null>(null);
  const [selectedBucket, setSelectedBucket] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isCreateBucketOpen, setIsCreateBucketOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [currentBucket, setCurrentBucket] = useState<string>('');
  const [watchBucket, setWatchBucket] = useState<string | null>(null);

  const filteredEntries = entries.filter(entry => {
    const matchesSearch = entry.key.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         entry.value.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesBucket = selectedBucket === 'all' || entry.bucket === selectedBucket;
    return matchesSearch && matchesBucket;
  });

  const fetchKVData = useCallback(async () => {
    if (!isConnected || !connection) return;

    setLoading(true);
    try {
      const kvBuckets = await connection.jetstream.listKVBuckets();
      setBuckets(kvBuckets);

      const allEntries: KVEntry[] = [];
      for (const bucket of kvBuckets) {
        const keys = await connection.jetstream.getKVKeys(bucket);
        for (const key of keys) {
          const value = await connection.jetstream.getKVValue(bucket, key);
          if (value !== null) {
            allEntries.push({
              key,
              value,
              revision: 1,
              created: new Date(),
              updated: new Date(),
              bucket,
            });
          }
        }
      }
      setEntries(allEntries);
    } catch (error) {
      console.error('Failed to fetch KV data:', error);
    } finally {
      setLoading(false);
    }
  }, [isConnected, connection]);

  useEffect(() => {
    fetchKVData();
    if (isConnected) {
      const interval = setInterval(fetchKVData, 10000);
      return () => clearInterval(interval);
    }
  }, [isConnected, fetchKVData]);

  const handleCreateBucket = useCallback(async (data: BucketFormData) => {
    if (!connection) {
      toast.error('Not connected to NATS server');
      return;
    }
    try {
      await connection.jetstream.createKVBucket(data.name, data.ttl);
      toast.success(`Created bucket: ${data.name}`);
      setIsCreateBucketOpen(false);
      await fetchKVData();
    } catch (err) {
      console.error('Create bucket error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      if (errorMessage.includes('JetStream not enabled')) {
        toast.error('JetStream is not enabled on the NATS server');
      } else if (errorMessage.includes('already exists')) {
        toast.error(`Bucket "${data.name}" already exists`);
      } else {
        toast.error(`Failed to create bucket: ${errorMessage}`);
      }
    }
  }, [connection, fetchKVData]);

  const handleCreateOrUpdate = useCallback(async (data: KVFormData) => {
    if (!connection) {
      toast.error('Not connected to NATS server');
      return;
    }
    try {
      const bucket = isEditMode ? selectedEntry?.bucket : (currentBucket || buckets[0]);
      if (!bucket) {
        toast.error('No bucket selected');
        return;
      }
      await connection.jetstream.putKVValue(bucket, data.key, data.value);
      if (isEditMode && selectedEntry) {
        toast.success(`Updated key: ${selectedEntry.key}`);
      } else {
        toast.success(`Created key: ${data.key} in bucket: ${bucket}`);
      }
      setIsCreateOpen(false);
      setIsEditMode(false);
      setSelectedEntry(null);
      await fetchKVData();
      setTimeout(async () => { await fetchKVData(); }, 1500);
    } catch (err) {
      console.error('KV operation error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      toast.error(`Failed to save key-value pair: ${errorMessage}`);
    }
  }, [connection, isEditMode, selectedEntry, currentBucket, buckets, fetchKVData]);

  const handleEdit = useCallback((entry: KVEntry) => {
    setSelectedEntry(entry);
    setIsEditMode(true);
    setIsCreateOpen(true);
  }, []);

  const handleDelete = useCallback(async (key: string, bucket: string) => {
    if (!connection) {
      toast.error('Not connected to NATS server');
      return;
    }
    try {
      await connection.jetstream.deleteKVKey(bucket, key);
      toast.success(`Deleted key: ${key}`);
      await fetchKVData();
    } catch (err) {
      console.error('Delete key error:', err);
      toast.error(`Failed to delete key: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }, [connection, fetchKVData]);

  const handleDeleteBucket = useCallback(async (bucket: string) => {
    if (!connection) {
      toast.error('Not connected to NATS server');
      return;
    }
    try {
      await connection.jetstream.deleteKVBucket(bucket);
      toast.success(`Deleted bucket: ${bucket}`);
      await fetchKVData();
    } catch (err) {
      console.error('Delete bucket error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      toast.error(`Failed to delete bucket: ${errorMessage}`);
    }
  }, [connection, fetchKVData]);

  const handleEditDialogClose = useCallback(() => {
    setIsEditMode(false);
    setSelectedEntry(null);
  }, []);

  if (!isConnected) {
    return (
      <div className="h-full flex flex-col p-4">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">KV Store</h1>
            <p className="text-muted-foreground">
              Connect to NATS server to manage key-value storage
            </p>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center py-12">
          <div className="max-w-md" />
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col p-4 overflow-hidden">
      <div className="flex items-center justify-between mb-6 flex-shrink-0">
        <div>
          <h1 className="text-3xl font-bold">KV Store</h1>
          <p className="text-muted-foreground">
            Manage NATS JetStream key-value storage
          </p>
        </div>
        <div className="flex items-center gap-2">
          <CreateBucketDialog
            open={isCreateBucketOpen}
            onOpenChange={setIsCreateBucketOpen}
            onSubmit={handleCreateBucket}
          />
          <EditKeyDialog
            open={isCreateOpen}
            onOpenChange={setIsCreateOpen}
            isEditMode={isEditMode}
            selectedEntry={selectedEntry}
            buckets={buckets}
            currentBucket={currentBucket}
            onCurrentBucketChange={setCurrentBucket}
            onSubmit={handleCreateOrUpdate}
            onClose={handleEditDialogClose}
          />
        </div>
      </div>

      <KVStatsCards entries={entries} buckets={buckets} />

      <BucketList buckets={buckets} onDeleteBucket={handleDeleteBucket} />

      {/* Watch controls */}
      {buckets.length > 0 && !watchBucket && (
        <div className="flex items-center gap-2 mb-4 flex-shrink-0">
          <span className="text-sm text-muted-foreground">Watch bucket:</span>
          {buckets.map((b) => (
            <Button
              key={b}
              variant="outline"
              size="sm"
              onClick={() => setWatchBucket(b)}
            >
              <Eye className="mr-1 h-3 w-3" /> {b}
            </Button>
          ))}
        </div>
      )}

      {watchBucket && (
        <div className="mb-4 flex-shrink-0">
          <KVWatchPanel bucket={watchBucket} onClose={() => setWatchBucket(null)} />
        </div>
      )}

      <KeyValueTable
        entries={entries}
        filteredEntries={filteredEntries}
        buckets={buckets}
        loading={loading}
        searchTerm={searchTerm}
        selectedBucket={selectedBucket}
        onSearchChange={setSearchTerm}
        onBucketFilterChange={setSelectedBucket}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />
    </div>
  );
}
