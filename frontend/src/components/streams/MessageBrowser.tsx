import { useState, useCallback } from 'react';
import { Eye } from 'lucide-react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '../ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { JsonViewer } from '../ui/json-viewer';
import { replayStreamMessages, type StreamMessage } from '../../services/api-client';
import { toast } from 'sonner';

interface MessageBrowserProps {
  streamName: string | null;
  onClose: () => void;
}

type FilterMode = 'last' | 'sequence' | 'subject' | 'time';

const LIMIT_OPTIONS = [25, 50, 100, 200] as const;

export function MessageBrowser({ streamName, onClose }: MessageBrowserProps) {
  const [messages, setMessages] = useState<StreamMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterMode, setFilterMode] = useState<FilterMode>('last');
  const [limit, setLimit] = useState<number>(50);
  const [lastN, setLastN] = useState<number>(50);
  const [sequence, setSequence] = useState<number>(1);
  const [subjectFilter, setSubjectFilter] = useState('');
  const [startTime, setStartTime] = useState('');
  const [expandedSeqs, setExpandedSeqs] = useState<Set<number>>(new Set());

  const fetchMessages = useCallback(async () => {
    if (!streamName) return;
    setLoading(true);
    try {
      const params: Record<string, unknown> = { limit };
      if (filterMode === 'last') params.last = lastN;
      if (filterMode === 'sequence') params.seq = sequence;
      if (filterMode === 'subject') params.subject = subjectFilter;
      if (filterMode === 'time' && startTime) params.start_time = new Date(startTime).toISOString();

      const msgs = await replayStreamMessages(streamName, params as Parameters<typeof replayStreamMessages>[1]);
      setMessages(msgs);
      setExpandedSeqs(new Set());
    } catch (err) {
      toast.error(`Failed to fetch messages: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setMessages([]);
    } finally {
      setLoading(false);
    }
  }, [streamName, filterMode, limit, lastN, sequence, subjectFilter, startTime]);

  const toggleExpand = (seq: number) => {
    setExpandedSeqs((prev) => {
      const next = new Set(prev);
      if (next.has(seq)) next.delete(seq);
      else next.add(seq);
      return next;
    });
  };

  if (!streamName) return null;

  return (
    <Dialog open={!!streamName} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-5xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" /> Browse Messages: {streamName}
          </DialogTitle>
          <DialogDescription>
            Replay and browse messages stored in this stream
          </DialogDescription>
        </DialogHeader>

        {/* Filter controls */}
        <div className="space-y-3 border rounded-lg p-4">
          <div className="flex items-end gap-4 flex-wrap">
            <Tabs value={filterMode} onValueChange={(v) => setFilterMode(v as FilterMode)} className="flex-1">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="last">Last N</TabsTrigger>
                <TabsTrigger value="sequence">By Sequence</TabsTrigger>
                <TabsTrigger value="subject">By Subject</TabsTrigger>
                <TabsTrigger value="time">By Time</TabsTrigger>
              </TabsList>

              <TabsContent value="last" className="mt-3">
                <div className="flex items-center gap-2">
                  <Label className="shrink-0">Last</Label>
                  <Input type="number" min={1} max={1000} value={lastN}
                    onChange={(e) => setLastN(Number(e.target.value))} className="w-24" />
                  <span className="text-sm text-muted-foreground">messages</span>
                </div>
              </TabsContent>

              <TabsContent value="sequence" className="mt-3">
                <div className="flex items-center gap-2">
                  <Label className="shrink-0">Start at sequence</Label>
                  <Input type="number" min={1} value={sequence}
                    onChange={(e) => setSequence(Number(e.target.value))} className="w-32" />
                </div>
              </TabsContent>

              <TabsContent value="subject" className="mt-3">
                <div className="flex items-center gap-2">
                  <Label className="shrink-0">Subject</Label>
                  <Input placeholder="e.g. orders.created" value={subjectFilter}
                    onChange={(e) => setSubjectFilter(e.target.value)} className="flex-1" />
                </div>
              </TabsContent>

              <TabsContent value="time" className="mt-3">
                <div className="flex items-center gap-2">
                  <Label className="shrink-0">Start time</Label>
                  <Input type="datetime-local" value={startTime}
                    onChange={(e) => setStartTime(e.target.value)} className="w-64" />
                </div>
              </TabsContent>
            </Tabs>
          </div>

          <div className="flex items-center gap-3">
            <Label className="shrink-0">Limit</Label>
            <Select value={String(limit)} onValueChange={(v) => setLimit(Number(v))}>
              <SelectTrigger className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LIMIT_OPTIONS.map((n) => (
                  <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={fetchMessages} disabled={loading}>
              {loading ? 'Loading...' : 'Fetch Messages'}
            </Button>
          </div>
        </div>

        {/* Messages list */}
        <div className="overflow-auto max-h-[50vh]">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              {messages.length === 0 ? 'Click "Fetch Messages" to load messages' : 'No messages found'}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Seq</TableHead>
                  <TableHead className="w-48">Subject</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="w-44">Timestamp</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {messages.map((msg) => (
                  <TableRow key={msg.sequence}>
                    <TableCell className="font-mono text-xs align-top">{msg.sequence}</TableCell>
                    <TableCell className="align-top">
                      <Badge variant="secondary" className="text-xs">{msg.subject}</Badge>
                    </TableCell>
                    <TableCell>
                      <div
                        className="cursor-pointer"
                        onClick={() => toggleExpand(msg.sequence)}
                      >
                        {expandedSeqs.has(msg.sequence) ? (
                          <JsonViewer data={msg.data} defaultExpanded className="max-w-lg" />
                        ) : (
                          <pre className="text-xs max-w-md truncate font-mono bg-muted p-1 rounded">
                            {typeof msg.data === 'string' ? msg.data : JSON.stringify(msg.data)}
                          </pre>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground align-top">
                      {new Date(msg.timestamp).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
