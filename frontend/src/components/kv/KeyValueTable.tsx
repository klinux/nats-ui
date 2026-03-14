import { useState, useRef, useEffect, useCallback } from 'react';
import { Database, Trash2, Edit3, Search, Key, Download } from 'lucide-react';
import { toast } from 'sonner';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../ui/dialog';
import { TableRowSkeleton } from '../ui/skeletons';

import type { KVEntry } from './types';

interface KeyValueTableProps {
  entries: KVEntry[];
  filteredEntries: KVEntry[];
  buckets: string[];
  loading: boolean;
  searchTerm: string;
  selectedBucket: string;
  onSearchChange: (term: string) => void;
  onBucketFilterChange: (bucket: string) => void;
  onEdit: (entry: KVEntry) => void;
  onDelete: (key: string, bucket: string) => Promise<void>;
}

export function KeyValueTable({
  entries,
  filteredEntries,
  buckets,
  loading,
  searchTerm,
  selectedBucket,
  onSearchChange,
  onBucketFilterChange,
  onEdit,
  onDelete,
}: KeyValueTableProps) {
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const [showBlur, setShowBlur] = useState(false);

  const checkScrollBlur = useCallback(() => {
    if (tableContainerRef.current) {
      const { scrollHeight, clientHeight } = tableContainerRef.current;
      setShowBlur(scrollHeight > clientHeight);
    }
  }, []);

  useEffect(() => {
    checkScrollBlur();
    window.addEventListener('resize', checkScrollBlur);
    return () => window.removeEventListener('resize', checkScrollBlur);
  }, [filteredEntries, checkScrollBlur]);

  const handleExport = useCallback(() => {
    const exportData = filteredEntries.reduce((acc, entry) => {
      acc[`${entry.bucket}.${entry.key}`] = {
        value: entry.value,
        revision: entry.revision,
        created: entry.created.toISOString(),
        updated: entry.updated.toISOString(),
      };
      return acc;
    }, {} as Record<string, unknown>);

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kv-store-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast.success('Key-value data exported successfully');
  }, [filteredEntries]);

  return (
    <Card className="flex-1 flex flex-col overflow-hidden">
      <CardHeader className="flex-shrink-0">
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          Key-Value Store ({filteredEntries.length})
          {loading && entries.length > 0 && (
            <div className="ml-auto">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          )}
        </CardTitle>
        <CardDescription>
          Browse and manage your key-value pairs
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden flex flex-col relative">
        <div className="flex items-center gap-4 flex-shrink-0 pb-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search keys or values..."
                value={searchTerm}
                onChange={(e) => onSearchChange(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="bucket-filter" className="text-sm font-medium whitespace-nowrap">
              Bucket:
            </Label>
            <select
              id="bucket-filter"
              value={selectedBucket}
              onChange={(e) => onBucketFilterChange(e.target.value)}
              className="px-3 py-2 border border-input bg-background rounded-md text-sm"
            >
              <option value="all">All Buckets</option>
              {buckets.map(bucket => (
                <option key={bucket} value={bucket}>{bucket}</option>
              ))}
            </select>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              disabled={filteredEntries.length === 0}
            >
              <Download className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {loading && entries.length === 0 ? (
          <div className="h-full overflow-auto" ref={tableContainerRef}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Key</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead>Bucket</TableHead>
                  <TableHead>Revision</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead className="w-32">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.from({ length: 4 }).map((_, i) => (
                  <TableRowSkeleton key={i} columns={6} />
                ))}
              </TableBody>
            </Table>
          </div>
        ) : filteredEntries.length === 0 ? (
          <EmptyState searchTerm={searchTerm} selectedBucket={selectedBucket} />
        ) : (
          <div className="h-full overflow-auto" ref={tableContainerRef}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Key</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead>Bucket</TableHead>
                  <TableHead>Revision</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead className="w-32">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEntries.map((entry) => (
                  <EntryRow
                    key={`${entry.bucket}-${entry.key}`}
                    entry={entry}
                    onEdit={onEdit}
                    onDelete={onDelete}
                  />
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        {showBlur && !loading && filteredEntries.length > 0 && (
          <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-background to-transparent pointer-events-none" />
        )}
      </CardContent>
    </Card>
  );
}

function EmptyState({ searchTerm, selectedBucket }: { searchTerm: string; selectedBucket: string }) {
  const hasFilter = searchTerm || selectedBucket !== 'all';
  return (
    <div className="flex flex-col items-center justify-center py-12 space-y-4">
      <Key className="h-12 w-12 text-muted-foreground/50" />
      <div className="text-center space-y-2">
        <h3 className="font-semibold">
          {hasFilter ? 'No matching keys found' : 'No key-value pairs'}
        </h3>
        <p className="text-sm text-muted-foreground">
          {hasFilter
            ? 'Try adjusting your search or filter criteria'
            : 'Create your first key-value pair to get started'
          }
        </p>
      </div>
    </div>
  );
}

function EntryRow({
  entry,
  onEdit,
  onDelete,
}: {
  entry: KVEntry;
  onEdit: (entry: KVEntry) => void;
  onDelete: (key: string, bucket: string) => Promise<void>;
}) {
  return (
    <TableRow>
      <TableCell className="font-medium font-mono text-sm">
        {entry.key}
      </TableCell>
      <TableCell className="max-w-xs">
        <div className="truncate" title={entry.value}>
          {entry.value}
        </div>
      </TableCell>
      <TableCell>
        <Badge variant="outline">{entry.bucket}</Badge>
      </TableCell>
      <TableCell>
        <Badge variant="secondary">v{entry.revision}</Badge>
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {entry.updated.toLocaleDateString()}
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={() => onEdit(entry)}>
            <Edit3 className="h-4 w-4" />
          </Button>
          <Dialog>
            <DialogTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="text-red-600 hover:text-red-700"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete Key</DialogTitle>
                <DialogDescription>
                  Are you sure you want to delete key &quot;{entry.key}&quot; from bucket &quot;{entry.bucket}&quot;? This action cannot be undone.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline">Cancel</Button>
                <Button
                  onClick={() => onDelete(entry.key, entry.bucket)}
                  className="bg-red-600 text-white hover:bg-red-700"
                >
                  Delete
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </TableCell>
    </TableRow>
  );
}
