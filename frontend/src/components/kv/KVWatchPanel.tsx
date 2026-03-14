import { useState, useEffect, useRef, useCallback } from 'react';
import { Eye, EyeOff } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { watchKVBucket } from '../../services/api-client-extended';

interface KVWatchEvent {
  key: string;
  value: string;
  revision: number;
  operation: string;
  created: string;
}

interface KVWatchPanelProps {
  bucket: string;
  onClose: () => void;
}

function getOperationBadge(op: string) {
  switch (op?.toUpperCase()) {
    case 'PUT':
      return <Badge className="bg-green-500 text-white text-[10px]">PUT</Badge>;
    case 'DEL':
    case 'DELETE':
      return <Badge className="bg-red-500 text-white text-[10px]">DEL</Badge>;
    case 'PURGE':
      return <Badge className="bg-orange-500 text-white text-[10px]">PURGE</Badge>;
    default:
      return <Badge variant="secondary" className="text-[10px]">{op}</Badge>;
  }
}

export function KVWatchPanel({ bucket, onClose }: KVWatchPanelProps) {
  const [keyFilter, setKeyFilter] = useState('>');
  const [events, setEvents] = useState<KVWatchEvent[]>([]);
  const [watching, setWatching] = useState(false);
  const stopRef = useRef<(() => void) | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const startWatch = useCallback(() => {
    if (stopRef.current) stopRef.current();
    setEvents([]);
    const stop = watchKVBucket(bucket, keyFilter, (data) => {
      const event = data as KVWatchEvent;
      setEvents((prev) => {
        const next = [...prev, event];
        return next.length > 500 ? next.slice(-500) : next;
      });
    });
    stopRef.current = stop;
    setWatching(true);
  }, [bucket, keyFilter]);

  const stopWatch = useCallback(() => {
    stopRef.current?.();
    stopRef.current = null;
    setWatching(false);
  }, []);

  useEffect(() => {
    return () => {
      stopRef.current?.();
    };
  }, []);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [events]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <Eye className="h-4 w-4" />
            Watch: {bucket}
            {watching && (
              <Badge variant="default" className="text-[10px]">Live</Badge>
            )}
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="text-xs">
            Close
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-end gap-3">
          <div className="space-y-1 flex-1">
            <Label htmlFor="kv-key-filter" className="text-xs">Key Filter</Label>
            <Input
              id="kv-key-filter"
              value={keyFilter}
              onChange={(e) => setKeyFilter(e.target.value)}
              placeholder="e.g., > or mykey.*"
              className="h-8 text-xs"
              disabled={watching}
            />
          </div>
          {watching ? (
            <Button size="sm" variant="destructive" onClick={stopWatch}>
              <EyeOff className="mr-2 h-4 w-4" /> Stop
            </Button>
          ) : (
            <Button size="sm" onClick={startWatch}>
              <Eye className="mr-2 h-4 w-4" /> Start
            </Button>
          )}
        </div>
        <div
          ref={listRef}
          className="max-h-64 overflow-y-auto space-y-1 rounded border p-2"
        >
          {events.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">
              {watching ? 'Waiting for events...' : 'Start watching to see real-time changes'}
            </p>
          ) : (
            events.map((ev, i) => (
              <div key={i} className="flex items-center gap-2 text-xs py-1 border-b last:border-0">
                {getOperationBadge(ev.operation)}
                <span className="font-mono truncate flex-1">{ev.key}</span>
                <Badge variant="outline" className="text-[10px]">r{ev.revision}</Badge>
                <span className="text-muted-foreground shrink-0">
                  {ev.created ? new Date(ev.created).toLocaleTimeString() : ''}
                </span>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
