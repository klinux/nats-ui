import { useRef, useState, useEffect, useCallback } from 'react';
import {
  GitBranch, Plus, Trash2, Info, Calendar, Users, Eraser, Eye,
  Download, Upload,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader,
  DialogTitle, DialogTrigger, DialogFooter,
} from '../ui/dialog';
import { TableRowSkeleton } from '../ui/skeletons';
import { formatBytes } from '../../lib/format';
import type { StreamInfo } from './types';

interface StreamListProps {
  streams: StreamInfo[];
  loading: boolean;
  onCreateOpen: () => void;
  onSelectStream: (stream: StreamInfo) => void;
  onViewMessages: (name: string) => void;
  onPurgeStream: (name: string, subject?: string) => Promise<void>;
  onDeleteStream: (name: string) => Promise<void>;
  onExportStream: (stream: StreamInfo) => void;
  onImportStream: () => void;
}

export function StreamList({
  streams, loading, onCreateOpen, onSelectStream,
  onViewMessages, onPurgeStream, onDeleteStream,
  onExportStream, onImportStream,
}: StreamListProps) {
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const [showBlur, setShowBlur] = useState(false);
  const [streamToDelete, setStreamToDelete] = useState<string | null>(null);
  const [streamToPurge, setStreamToPurge] = useState<string | null>(null);
  const [purgeSubject, setPurgeSubject] = useState('');

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
  }, [streams, checkScrollBlur]);

  const handlePurgeConfirm = async (name: string) => {
    await onPurgeStream(name, purgeSubject || undefined);
    setStreamToPurge(null);
    setPurgeSubject('');
  };

  const tableHeaders = (
    <TableRow>
      <TableHead>Name</TableHead>
      <TableHead>Subjects</TableHead>
      <TableHead>Messages</TableHead>
      <TableHead>Size</TableHead>
      <TableHead>Consumers</TableHead>
      <TableHead>Storage</TableHead>
      <TableHead>Created</TableHead>
      <TableHead className="w-28">Actions</TableHead>
    </TableRow>
  );

  return (
    <Card className="flex-1 flex flex-col overflow-hidden">
      <CardHeader className="flex-shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <GitBranch className="h-5 w-5" />
              JetStream Streams ({streams.length})
            </CardTitle>
            <CardDescription>
              Overview of all configured JetStream streams
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onImportStream} title="Import stream config">
              <Upload className="h-4 w-4 mr-1" /> Import
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden relative">
        {loading ? (
          <div className="h-full overflow-auto" ref={tableContainerRef}>
            <Table>
              <TableHeader>{tableHeaders}</TableHeader>
              <TableBody>
                {Array.from({ length: 3 }).map((_, i) => (
                  <TableRowSkeleton key={i} columns={8} />
                ))}
              </TableBody>
            </Table>
          </div>
        ) : streams.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-12 space-y-4">
            <GitBranch className="h-12 w-12 text-muted-foreground/50" />
            <div className="text-center space-y-2">
              <h3 className="font-semibold">No streams configured</h3>
              <p className="text-sm text-muted-foreground">
                Create your first JetStream stream to get started
              </p>
            </div>
            <Button onClick={onCreateOpen}>
              <Plus className="mr-2 h-4 w-4" /> Create Stream
            </Button>
          </div>
        ) : (
          <div className="h-full overflow-auto" ref={tableContainerRef}>
            <Table>
              <TableHeader>{tableHeaders}</TableHeader>
              <TableBody>
                {streams.map((stream) => (
                  <StreamRow
                    key={stream.name}
                    stream={stream}
                    onSelect={onSelectStream}
                    onViewMessages={onViewMessages}
                    onExport={onExportStream}
                    streamToPurge={streamToPurge}
                    setStreamToPurge={setStreamToPurge}
                    purgeSubject={purgeSubject}
                    setPurgeSubject={setPurgeSubject}
                    onPurgeConfirm={handlePurgeConfirm}
                    streamToDelete={streamToDelete}
                    setStreamToDelete={setStreamToDelete}
                    onDeleteConfirm={onDeleteStream}
                  />
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        {showBlur && !loading && streams.length > 0 && (
          <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-background to-transparent pointer-events-none" />
        )}
      </CardContent>
    </Card>
  );
}

/* --- Extracted row to keep StreamList under 300 lines --- */

interface StreamRowProps {
  stream: StreamInfo;
  onSelect: (s: StreamInfo) => void;
  onViewMessages: (name: string) => void;
  onExport: (s: StreamInfo) => void;
  streamToPurge: string | null;
  setStreamToPurge: (v: string | null) => void;
  purgeSubject: string;
  setPurgeSubject: (v: string) => void;
  onPurgeConfirm: (name: string) => void;
  streamToDelete: string | null;
  setStreamToDelete: (v: string | null) => void;
  onDeleteConfirm: (name: string) => void;
}

function StreamRow({
  stream, onSelect, onViewMessages, onExport,
  streamToPurge, setStreamToPurge, purgeSubject, setPurgeSubject, onPurgeConfirm,
  streamToDelete, setStreamToDelete, onDeleteConfirm,
}: StreamRowProps) {
  return (
    <TableRow>
      <TableCell className="font-medium">{stream.name}</TableCell>
      <TableCell>
        <div className="flex flex-wrap gap-1">
          {stream.subjects.map((subject) => (
            <Badge key={subject} variant="secondary" className="text-xs">{subject}</Badge>
          ))}
        </div>
      </TableCell>
      <TableCell>{stream.messages.toLocaleString()}</TableCell>
      <TableCell>{formatBytes(stream.bytes)}</TableCell>
      <TableCell>
        <div className="flex items-center gap-1"><Users className="h-3 w-3" />{stream.consumers}</div>
      </TableCell>
      <TableCell>
        <Badge variant={stream.storage === 'file' ? 'default' : 'secondary'}>{stream.storage}</Badge>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          <Calendar className="h-3 w-3" />{stream.created.toLocaleDateString()}
        </div>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={() => onSelect(stream)} title="Details">
            <Info className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onViewMessages(stream.name)} title="Browse Messages">
            <Eye className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onExport(stream)} title="Export Config">
            <Download className="h-4 w-4" />
          </Button>

          {/* Purge dialog */}
          <Dialog open={streamToPurge === stream.name} onOpenChange={(open) => {
            if (!open) { setStreamToPurge(null); setPurgeSubject(''); }
          }}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="sm" onClick={() => setStreamToPurge(stream.name)}
                className="text-orange-600 hover:text-orange-700" title="Purge Messages">
                <Eraser className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Purge Stream</DialogTitle>
                <DialogDescription>
                  Purge messages from stream &ldquo;{stream.name}&rdquo;. Optionally filter by subject.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-2">
                <Label htmlFor="purge-subject">Subject filter (optional)</Label>
                <Input id="purge-subject" placeholder="e.g. orders.created"
                  value={purgeSubject} onChange={(e) => setPurgeSubject(e.target.value)} />
                <p className="text-xs text-muted-foreground">
                  Leave empty to purge all messages, or enter a subject to purge only matching messages.
                </p>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => { setStreamToPurge(null); setPurgeSubject(''); }}>Cancel</Button>
                <Button onClick={() => onPurgeConfirm(stream.name)}
                  className="bg-orange-600 text-white hover:bg-orange-700">
                  {purgeSubject ? 'Purge Matching' : 'Purge All'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Delete dialog */}
          <Dialog open={streamToDelete === stream.name} onOpenChange={(open) => {
            if (!open) setStreamToDelete(null);
          }}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="sm" onClick={() => setStreamToDelete(stream.name)}
                className="text-red-600 hover:text-red-700">
                <Trash2 className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete Stream</DialogTitle>
                <DialogDescription>
                  Are you sure you want to delete stream &ldquo;{stream.name}&rdquo;? This action cannot be undone.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setStreamToDelete(null)}>Cancel</Button>
                <Button onClick={() => { onDeleteConfirm(stream.name); setStreamToDelete(null); }}
                  className="bg-red-600 text-white hover:bg-red-700">
                  Delete Stream
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </TableCell>
    </TableRow>
  );
}
