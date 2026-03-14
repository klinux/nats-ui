import { useState, useCallback, useEffect } from 'react';
import { FileBox } from 'lucide-react';

import { Card, CardContent } from '../components/ui/card';
import { useNats } from '../hooks/useNats';
import { toast } from 'sonner';
import {
  listObjectStoreBuckets,
  listObjects,
  createObjectStoreBucket,
  deleteObjectStoreBucket,
  uploadObject,
  downloadObject,
  deleteObject,
} from '../services/api-client';
import type { ObjectStoreBucket, ObjectInfo } from '../services/api-client';

import { BucketList } from '../components/objectstore/BucketList';
import { ObjectList } from '../components/objectstore/ObjectList';
import { UploadDialog } from '../components/objectstore/UploadDialog';
import { ObjectInfoDialog } from '../components/objectstore/ObjectInfoDialog';
import {
  CreateBucketDialog,
  type CreateBucketFormData,
} from '../components/objectstore/CreateBucketDialog';

export function ObjectStore() {
  const { isConnected } = useNats();

  const [buckets, setBuckets] = useState<ObjectStoreBucket[]>([]);
  const [selectedBucket, setSelectedBucket] = useState<string | null>(null);
  const [objects, setObjects] = useState<ObjectInfo[]>([]);
  const [loadingBuckets, setLoadingBuckets] = useState(false);
  const [loadingObjects, setLoadingObjects] = useState(false);

  const [isCreateBucketOpen, setIsCreateBucketOpen] = useState(false);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [infoObject, setInfoObject] = useState<ObjectInfo | null>(null);

  const fetchBuckets = useCallback(async () => {
    if (!isConnected) return;
    setLoadingBuckets(true);
    try {
      const data = await listObjectStoreBuckets();
      setBuckets(data ?? []);
    } catch (error) {
      console.error('Failed to fetch object store buckets:', error);
    } finally {
      setLoadingBuckets(false);
    }
  }, [isConnected]);

  const fetchObjects = useCallback(async (bucket: string) => {
    setLoadingObjects(true);
    try {
      const data = await listObjects(bucket);
      setObjects(data ?? []);
    } catch (error) {
      console.error('Failed to fetch objects:', error);
      toast.error(`Failed to load objects: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoadingObjects(false);
    }
  }, []);

  useEffect(() => {
    fetchBuckets();
    if (!isConnected) return;
    const interval = setInterval(fetchBuckets, 15000);
    return () => clearInterval(interval);
  }, [isConnected, fetchBuckets]);

  useEffect(() => {
    if (selectedBucket) {
      fetchObjects(selectedBucket);
    } else {
      setObjects([]);
    }
  }, [selectedBucket, fetchObjects]);

  const handleSelectBucket = useCallback((name: string) => {
    setSelectedBucket((prev) => (prev === name ? null : name));
  }, []);

  const handleCreateBucket = useCallback(
    async (data: CreateBucketFormData) => {
      try {
        await createObjectStoreBucket({
          name: data.name,
          description: data.description,
          max_bytes: data.max_bytes,
          ttl: data.ttl,
        });
        toast.success(`Created bucket: ${data.name}`);
        setIsCreateBucketOpen(false);
        await fetchBuckets();
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        if (msg.includes('already exists')) {
          toast.error(`Bucket "${data.name}" already exists`);
        } else {
          toast.error(`Failed to create bucket: ${msg}`);
        }
      }
    },
    [fetchBuckets],
  );

  const handleDeleteBucket = useCallback(
    async (name: string) => {
      try {
        await deleteObjectStoreBucket(name);
        toast.success(`Deleted bucket: ${name}`);
        if (selectedBucket === name) setSelectedBucket(null);
        await fetchBuckets();
      } catch (error) {
        toast.error(
          `Failed to delete bucket: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }
    },
    [selectedBucket, fetchBuckets],
  );

  const handleUpload = useCallback(
    async (name: string, file: File) => {
      if (!selectedBucket) return;
      try {
        const buffer = await file.arrayBuffer();
        await uploadObject(selectedBucket, name, buffer);
        toast.success(`Uploaded: ${name}`);
        await fetchObjects(selectedBucket);
      } catch (error) {
        toast.error(
          `Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
        throw error;
      }
    },
    [selectedBucket, fetchObjects],
  );

  const handleDownload = useCallback(
    async (name: string) => {
      if (!selectedBucket) return;
      try {
        const blob = await downloadObject(selectedBucket, name);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success(`Downloaded: ${name}`);
      } catch (error) {
        toast.error(
          `Download failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }
    },
    [selectedBucket],
  );

  const handleDeleteObject = useCallback(
    async (name: string) => {
      if (!selectedBucket) return;
      try {
        await deleteObject(selectedBucket, name);
        toast.success(`Deleted: ${name}`);
        await fetchObjects(selectedBucket);
      } catch (error) {
        toast.error(
          `Failed to delete object: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }
    },
    [selectedBucket, fetchObjects],
  );

  if (!isConnected) {
    return (
      <div className="h-full flex flex-col p-4">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">Object Store</h1>
            <p className="text-muted-foreground">
              Connect to NATS server to manage object storage
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col p-4">
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div>
          <h1 className="text-2xl font-bold">Object Store</h1>
          <p className="text-sm text-muted-foreground">
            Manage NATS JetStream object storage buckets and objects
          </p>
        </div>
      </div>

      <div className="flex-1 lg:grid lg:grid-cols-12 gap-4 lg:min-h-0 lg:max-h-[calc(100vh-10rem)]">
        {/* Bucket list -- 3 cols */}
        <div className="lg:col-span-3 flex flex-col min-h-0 mb-4 lg:mb-0">
          <BucketList
            buckets={buckets}
            selectedBucket={selectedBucket}
            isLoading={loadingBuckets}
            onSelect={handleSelectBucket}
            onRefresh={fetchBuckets}
            onCreateBucket={() => setIsCreateBucketOpen(true)}
            onDeleteBucket={handleDeleteBucket}
          />
        </div>

        {/* Object list -- 9 cols */}
        <div className="lg:col-span-9 flex flex-col min-h-0">
          {!selectedBucket ? (
            <Card className="flex-1 flex flex-col">
              <CardContent className="flex-1 flex items-center justify-center p-8">
                <div className="text-center space-y-3">
                  <FileBox className="h-10 w-10 mx-auto text-muted-foreground/50" />
                  <div className="space-y-1">
                    <h3 className="text-sm font-semibold">Select a Bucket</h3>
                    <p className="text-xs text-muted-foreground max-w-[280px] mx-auto">
                      Choose a bucket from the list to view and manage its
                      objects
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <ObjectList
              bucketName={selectedBucket}
              objects={objects}
              isLoading={loadingObjects}
              onUpload={() => setIsUploadOpen(true)}
              onDownload={handleDownload}
              onDelete={handleDeleteObject}
              onInfo={setInfoObject}
            />
          )}
        </div>
      </div>

      <CreateBucketDialog
        open={isCreateBucketOpen}
        onOpenChange={setIsCreateBucketOpen}
        onSubmit={handleCreateBucket}
      />

      {selectedBucket && (
        <UploadDialog
          open={isUploadOpen}
          onOpenChange={setIsUploadOpen}
          bucketName={selectedBucket}
          onUpload={handleUpload}
        />
      )}

      <ObjectInfoDialog
        open={!!infoObject}
        onOpenChange={(open) => !open && setInfoObject(null)}
        object={infoObject}
      />
    </div>
  );
}
