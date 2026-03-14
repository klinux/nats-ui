import { useState } from 'react';
import {
  Database,
  Plus,
  Trash2,
  RefreshCw,
  Search,
  HardDrive,
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { TopicSkeleton } from '../ui/skeletons';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { cn } from '@/lib/utils';
import { formatBytes } from '../../lib/format';
import type { ObjectStoreBucket } from '../../services/api-client';

interface BucketListProps {
  buckets: ObjectStoreBucket[];
  selectedBucket: string | null;
  isLoading: boolean;
  onSelect: (name: string) => void;
  onRefresh: () => void;
  onCreateBucket: () => void;
  onDeleteBucket: (name: string) => void;
}

export function BucketList({
  buckets,
  selectedBucket,
  isLoading,
  onSelect,
  onRefresh,
  onCreateBucket,
  onDeleteBucket,
}: BucketListProps) {
  const [search, setSearch] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const filtered = search.trim()
    ? buckets.filter((b) =>
        b.name.toLowerCase().includes(search.toLowerCase()),
      )
    : buckets;

  return (
    <Card className="flex-1 flex flex-col overflow-hidden">
      <CardHeader className="flex-shrink-0 pb-2">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            <Database className="h-4 w-4" />
            Buckets ({buckets.length})
          </div>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              onClick={onRefresh}
              disabled={isLoading}
              title="Refresh buckets"
            >
              <RefreshCw
                className={cn('h-3.5 w-3.5', isLoading && 'animate-spin')}
              />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              onClick={onCreateBucket}
              title="Create bucket"
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
        </CardTitle>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Filter buckets..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 pl-8 text-xs"
          />
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden px-4 relative">
        <div className="h-full overflow-y-auto space-y-1 pr-1">
          {isLoading && buckets.length === 0 ? (
            Array.from({ length: 5 }).map((_, i) => <TopicSkeleton key={i} />)
          ) : filtered.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">
              {search ? 'No buckets match filter' : 'No buckets found'}
            </p>
          ) : (
            filtered.map((bucket) => {
              const isSelected = selectedBucket === bucket.name;
              return (
                <div key={bucket.name} className="flex items-center gap-1">
                  <button
                    className={cn(
                      'flex-1 text-left rounded-md border px-3 py-2 transition-colors',
                      isSelected
                        ? 'bg-primary/10 border-primary'
                        : 'hover:bg-muted/50 border-transparent',
                    )}
                    onClick={() => onSelect(bucket.name)}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs truncate flex-1">
                        {bucket.name}
                      </span>
                      {bucket.sealed && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                          Sealed
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-1">
                      <span className="flex items-center gap-0.5">
                        <HardDrive className="h-2.5 w-2.5" />
                        {formatBytes(bucket.size)}
                      </span>
                      <span className="text-muted-foreground/50">·</span>
                      <span>{bucket.chunks} chunks</span>
                    </div>
                  </button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10 flex-shrink-0"
                    onClick={() => setDeleteTarget(bucket.name)}
                    title="Delete bucket"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              );
            })
          )}
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-card to-transparent pointer-events-none" />
      </CardContent>

      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Bucket</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete bucket &quot;{deleteTarget}&quot;?
              This will permanently delete all objects and cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              className="bg-red-600 text-white hover:bg-red-700"
              onClick={() => {
                if (deleteTarget) onDeleteBucket(deleteTarget);
                setDeleteTarget(null);
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
