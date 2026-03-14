import { useState, useEffect, useRef, useCallback } from 'react';
import { Activity, Play, Square, Trash2, Filter } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { subscribeSystemEvents, type SystemEvent } from '../services/api-client-extended';

const MAX_EVENTS = 500;

function getEventColor(subject: string): string {
  const lower = subject.toLowerCase();
  if (lower.includes('disconnect') || lower.includes('error') || lower.includes('stall')) {
    return 'text-red-600 dark:text-red-400';
  }
  if (lower.includes('connect') || lower.includes('auth')) {
    return 'text-green-600 dark:text-green-400';
  }
  if (lower.includes('leafnode') || lower.includes('gateway')) {
    return 'text-blue-600 dark:text-blue-400';
  }
  if (lower.includes('jetstream') || lower.includes('stream')) {
    return 'text-purple-600 dark:text-purple-400';
  }
  return 'text-foreground';
}

function getEventBadgeVariant(subject: string): 'default' | 'destructive' | 'secondary' | 'outline' {
  const lower = subject.toLowerCase();
  if (lower.includes('disconnect') || lower.includes('error')) return 'destructive';
  if (lower.includes('connect')) return 'default';
  return 'secondary';
}

function getEventTypeLabel(subject: string): string {
  const parts = subject.split('.');
  return parts[parts.length - 1] || subject;
}

export function SystemEvents() {
  const [events, setEvents] = useState<SystemEvent[]>([]);
  const [listening, setListening] = useState(false);
  const [subjectFilter, setSubjectFilter] = useState('');
  const stopRef = useRef<(() => void) | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  const startListening = useCallback(() => {
    if (stopRef.current) stopRef.current();
    const stop = subscribeSystemEvents((event) => {
      setEvents((prev) => {
        const next = [...prev, event];
        return next.length > MAX_EVENTS ? next.slice(-MAX_EVENTS) : next;
      });
    });
    stopRef.current = stop;
    setListening(true);
  }, []);

  const stopListening = useCallback(() => {
    stopRef.current?.();
    stopRef.current = null;
    setListening(false);
  }, []);

  const clearEvents = useCallback(() => {
    setEvents([]);
  }, []);

  useEffect(() => {
    return () => {
      stopRef.current?.();
    };
  }, []);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [events]);

  const filteredEvents = subjectFilter.trim()
    ? events.filter((e) => e.subject.toLowerCase().includes(subjectFilter.toLowerCase()))
    : events;

  return (
    <div className="h-full flex flex-col p-4">
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div>
          <h1 className="text-3xl font-bold">System Events</h1>
          <p className="text-muted-foreground">
            Monitor NATS system events ($SYS.&gt;) in real time
          </p>
        </div>
        <div className="flex items-center gap-2">
          {listening ? (
            <Button variant="destructive" size="sm" onClick={stopListening}>
              <Square className="mr-2 h-4 w-4" /> Stop
            </Button>
          ) : (
            <Button size="sm" onClick={startListening}>
              <Play className="mr-2 h-4 w-4" /> Start
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={clearEvents}>
            <Trash2 className="mr-2 h-4 w-4" /> Clear
          </Button>
        </div>
      </div>

      <EventStats events={events} listening={listening} />

      <Card className="flex-1 flex flex-col overflow-hidden mt-4">
        <CardHeader className="flex-shrink-0 pb-2">
          <CardTitle className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Events ({filteredEvents.length})
              {listening && (
                <Badge variant="default" className="text-[10px]">
                  <span className="animate-pulse mr-1">&#9679;</span> Live
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Filter className="h-3 w-3 text-muted-foreground" />
              <Input
                value={subjectFilter}
                onChange={(e) => setSubjectFilter(e.target.value)}
                placeholder="Filter by subject..."
                className="h-7 w-52 text-xs"
              />
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 overflow-hidden p-0">
          <div ref={logRef} className="h-full overflow-y-auto px-4 pb-4">
            {filteredEvents.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Activity className="h-10 w-10 text-muted-foreground/50 mb-3" />
                <p className="text-sm text-muted-foreground">
                  {listening ? 'Waiting for system events...' : 'Click Start to begin monitoring'}
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                {filteredEvents.map((event, i) => (
                  <EventRow key={i} event={event} />
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function EventStats({ events, listening }: { events: SystemEvent[]; listening: boolean }) {
  const connectCount = events.filter((e) => e.subject.toLowerCase().includes('connect') && !e.subject.toLowerCase().includes('disconnect')).length;
  const disconnectCount = events.filter((e) => e.subject.toLowerCase().includes('disconnect')).length;

  return (
    <div className="grid gap-4 md:grid-cols-4 flex-shrink-0">
      <StatCard label="Total Events" value={events.length} icon={Activity} />
      <StatCard label="Connects" value={connectCount} icon={Play} className="text-green-600" />
      <StatCard label="Disconnects" value={disconnectCount} icon={Square} className="text-red-600" />
      <StatCard label="Status" value={listening ? 'Listening' : 'Stopped'} icon={Activity} />
    </div>
  );
}

function StatCard({ label, value, icon: Icon, className }: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  className?: string;
}) {
  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className={`text-xl font-bold ${className || ''}`}>{typeof value === 'number' ? value.toLocaleString() : value}</p>
          </div>
          <Icon className="h-5 w-5 text-muted-foreground" />
        </div>
      </CardContent>
    </Card>
  );
}

function EventRow({ event }: { event: SystemEvent }) {
  const [expanded, setExpanded] = useState(false);
  const colorClass = getEventColor(event.subject);

  return (
    <div
      className="p-2 rounded border text-xs cursor-pointer hover:bg-muted/50 transition-colors"
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground shrink-0 w-20">
          {new Date(event.timestamp).toLocaleTimeString()}
        </span>
        <Badge variant={getEventBadgeVariant(event.subject)} className="text-[10px] shrink-0">
          {getEventTypeLabel(event.subject)}
        </Badge>
        <span className={`font-mono truncate flex-1 ${colorClass}`}>
          {event.subject}
        </span>
      </div>
      {expanded && event.data && (
        <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-x-auto whitespace-pre-wrap">
          {typeof event.data === 'string' ? event.data : JSON.stringify(event.data, null, 2)}
        </pre>
      )}
    </div>
  );
}
