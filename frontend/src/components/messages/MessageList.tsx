import { useState, useCallback } from 'react';
import {
  MessageSquare,
  Play,
  Square,
  Trash2,
  Download,
  Search,
  X,
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { MessageItem } from './MessageItem';
import type { Message } from '../../stores/message-store';

interface MessageListProps {
  topic: string;
  messages: Message[];
  isSubscribed: boolean;
  onToggleSubscription: () => void;
  onClear: () => void;
  onExport: () => void;
}

export function MessageList({
  topic,
  messages,
  isSubscribed,
  onToggleSubscription,
  onClear,
  onExport,
}: MessageListProps) {
  const [search, setSearch] = useState('');
  const [expandedHeaders, setExpandedHeaders] = useState<Set<string>>(new Set());

  const toggleHeader = useCallback((id: string) => {
    setExpandedHeaders(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const filtered = search.trim()
    ? messages.filter(m => {
        const q = search.toLowerCase();
        return (
          m.data.toLowerCase().includes(q) ||
          m.subject.toLowerCase().includes(q) ||
          Object.values(m.headers || {}).some(v => v.toLowerCase().includes(q))
        );
      })
    : messages;

  return (
    <Card className="flex-1 flex flex-col min-h-0 overflow-hidden">
      <CardHeader className="flex-shrink-0 pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-sm truncate">
            <MessageSquare className="h-4 w-4 flex-shrink-0" />
            <span className="truncate">{topic}</span>
            <Badge variant="secondary" className="text-[10px] flex-shrink-0">
              {filtered.length}{search && `/${messages.length}`}
            </Badge>
          </CardTitle>
          <div className="flex items-center gap-1 flex-shrink-0">
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              onClick={onExport}
              disabled={messages.length === 0}
              title="Export messages"
            >
              <Download className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              onClick={onClear}
              disabled={messages.length === 0}
              title="Clear messages"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant={isSubscribed ? 'default' : 'outline'}
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={onToggleSubscription}
            >
              {isSubscribed ? (
                <>
                  <Square className="h-3 w-3" />
                  Stop
                </>
              ) : (
                <>
                  <Play className="h-3 w-3" />
                  Subscribe
                </>
              )}
            </Button>
          </div>
        </div>
        {messages.length > 0 && (
          <div className="relative">
            <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search messages..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-7 pl-8 pr-8 text-xs"
            />
            {search && (
              <button
                className="absolute right-2 top-1.5 text-muted-foreground hover:text-foreground"
                onClick={() => setSearch('')}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden px-4">
        <div className="h-full overflow-y-auto space-y-2 pr-1">
          {filtered.length === 0 ? (
            <div className="flex items-center justify-center h-full min-h-[200px]">
              <div className="text-center space-y-3">
                <MessageSquare className="h-10 w-10 mx-auto text-muted-foreground/50" />
                <div className="space-y-1">
                  <p className="text-sm font-medium">
                    {search ? 'No matching messages' : 'No messages yet'}
                  </p>
                  <p className="text-xs text-muted-foreground max-w-[240px]">
                    {search
                      ? 'Try a different search term'
                      : isSubscribed
                        ? 'Waiting for messages...'
                        : 'Subscribe to start receiving messages'}
                  </p>
                </div>
                {!isSubscribed && !search && (
                  <Button size="sm" onClick={onToggleSubscription} className="text-xs">
                    <Play className="mr-1 h-3 w-3" />
                    Subscribe
                  </Button>
                )}
              </div>
            </div>
          ) : (
            filtered.map((message) => (
              <MessageItem
                key={message.id}
                message={message}
                isHeaderExpanded={expandedHeaders.has(message.id)}
                onToggleHeader={toggleHeader}
              />
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
