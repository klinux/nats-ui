import { useState } from 'react';
import {
  MessageSquare,
  RefreshCw,
  Plus,
  MailX,
  Inbox,
  Radio,
  Search,
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { TopicSkeleton } from '../ui/skeletons';
import { cn } from '@/lib/utils';
import type { SubjectActivity } from '../../services/subject-tracker';

interface TopicListProps {
  topics: string[];
  activities: Map<string, SubjectActivity>;
  selectedTopic: string | null;
  isLoading: boolean;
  isSubscribedFn: (topic: string) => boolean;
  onSelect: (topic: string) => void;
  onRefresh: () => void;
  onAddTopic: () => void;
  hideInbox: boolean;
  onToggleInbox: () => void;
}

export function TopicList({
  topics,
  activities,
  selectedTopic,
  isLoading,
  isSubscribedFn,
  onSelect,
  onRefresh,
  onAddTopic,
  hideInbox,
  onToggleInbox,
}: TopicListProps) {
  const [search, setSearch] = useState('');

  const filtered = search.trim()
    ? topics.filter(t => t.toLowerCase().includes(search.toLowerCase()))
    : topics;

  return (
    <Card className="flex-1 flex flex-col overflow-hidden">
      <CardHeader className="flex-shrink-0 pb-2">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            <MessageSquare className="h-4 w-4" />
            Topics ({topics.length})
          </div>
          <div className="flex gap-1">
            <Button
              variant={hideInbox ? 'outline' : 'default'}
              size="icon"
              className="h-7 w-7"
              onClick={onToggleInbox}
              title={hideInbox ? 'Show _INBOX topics' : 'Hide _INBOX topics'}
            >
              {hideInbox ? <MailX className="h-3.5 w-3.5" /> : <Inbox className="h-3.5 w-3.5" />}
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              onClick={onRefresh}
              disabled={isLoading}
              title="Refresh topics"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', isLoading && 'animate-spin')} />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              onClick={onAddTopic}
              title="Add custom topic"
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
        </CardTitle>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Filter topics..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 pl-8 text-xs"
          />
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden px-4 relative">
        <div className="h-full overflow-y-auto space-y-1 pr-1">
          {isLoading && topics.length === 0 ? (
            Array.from({ length: 5 }).map((_, i) => <TopicSkeleton key={i} />)
          ) : filtered.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">
              {search ? 'No topics match filter' : 'No topics found'}
            </p>
          ) : (
            filtered.map((topic) => {
              const activity = activities.get(topic);
              const isSelected = selectedTopic === topic;
              const subscribed = isSubscribedFn(topic);

              return (
                <button
                  key={topic}
                  className={cn(
                    'w-full text-left rounded-md border px-3 py-2 transition-colors',
                    isSelected
                      ? 'bg-primary/10 border-primary'
                      : 'hover:bg-muted/50 border-transparent',
                  )}
                  onClick={() => onSelect(topic)}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs truncate flex-1">{topic}</span>
                    {subscribed && (
                      <Badge variant="default" className="text-[10px] px-1.5 py-0 h-4 flex items-center gap-1">
                        <Radio className="h-2.5 w-2.5 animate-pulse" />
                        Live
                      </Badge>
                    )}
                  </div>
                  {activity && (
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-1">
                      <span>{activity.messageCount} msgs</span>
                      <span className="text-muted-foreground/50">·</span>
                      <span>{new Date(activity.lastSeen).toLocaleTimeString()}</span>
                    </div>
                  )}
                </button>
              );
            })
          )}
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-card to-transparent pointer-events-none" />
      </CardContent>
    </Card>
  );
}
