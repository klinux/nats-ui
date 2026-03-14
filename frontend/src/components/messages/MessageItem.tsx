import { memo, useMemo, useCallback } from 'react';
import {
  Clock,
  Copy,
  ChevronRight,
  MoreVertical,
} from 'lucide-react';

import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { JsonViewer } from '../ui/json-viewer';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { Message } from '../../stores/message-store';

interface MessageItemProps {
  message: Message;
  isHeaderExpanded: boolean;
  onToggleHeader: (id: string) => void;
}

export const MessageItem = memo(function MessageItem({
  message,
  isHeaderExpanded,
  onToggleHeader,
}: MessageItemProps) {
  const isJson = useMemo(() => {
    try { JSON.parse(message.data); return true; } catch { return false; }
  }, [message.data]);

  const hasJsonContentType = useMemo(() => {
    return message.headers?.['Content-Type']?.includes('json') ||
           message.headers?.['content-type']?.includes('json');
  }, [message.headers]);

  const headerCount = message.headers ? Object.keys(message.headers).length : 0;

  const copyBody = useCallback(() => {
    try {
      const parsed = JSON.parse(message.data);
      navigator.clipboard.writeText(JSON.stringify(parsed, null, 2));
    } catch {
      navigator.clipboard.writeText(message.data);
    }
    toast.success('Body copied');
  }, [message.data]);

  const copyHeaders = useCallback(() => {
    if (headerCount > 0) {
      navigator.clipboard.writeText(JSON.stringify(message.headers, null, 2));
      toast.success('Headers copied');
    }
  }, [message.headers, headerCount]);

  const copyAll = useCallback(() => {
    const json = {
      subject: message.subject,
      data: (() => { try { return JSON.parse(message.data); } catch { return message.data; } })(),
      headers: message.headers,
      timestamp: message.timestamp.toISOString(),
      ...(message.replyTo && { replyTo: message.replyTo }),
    };
    navigator.clipboard.writeText(JSON.stringify(json, null, 2));
    toast.success('Message copied as JSON');
  }, [message]);

  return (
    <div className="rounded-md border p-3 space-y-2 text-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[10px] font-mono">{message.subject}</Badge>
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <Clock className="h-2.5 w-2.5" />
            {message.timestamp.toLocaleTimeString()}
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-6 w-6">
              <MoreVertical className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={copyBody}>
              <Copy className="h-3 w-3 mr-2" />
              Copy Body
            </DropdownMenuItem>
            {headerCount > 0 && (
              <DropdownMenuItem onClick={copyHeaders}>
                <Copy className="h-3 w-3 mr-2" />
                Copy Headers
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={copyAll}>
              <Copy className="h-3 w-3 mr-2" />
              Copy All
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {headerCount > 0 && (
        <div>
          <button
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => onToggleHeader(message.id)}
          >
            <ChevronRight className={cn('h-3 w-3 transition-transform', isHeaderExpanded && 'rotate-90')} />
            Headers ({headerCount})
          </button>
          {isHeaderExpanded && (
            <div className="mt-1.5 text-xs bg-muted p-2 rounded font-mono space-y-0.5">
              {Object.entries(message.headers!).map(([key, value]) => (
                <div key={key} className="flex gap-2">
                  <span className="text-blue-600 dark:text-blue-400">{key}:</span>
                  <span className="text-muted-foreground">{value}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {message.data && (
        <div>
          {(isJson || hasJsonContentType) ? (
            <JsonViewer data={message.data} defaultExpanded={true} />
          ) : (
            <pre className="text-xs bg-muted p-2 rounded overflow-x-auto font-mono whitespace-pre-wrap">
              {message.data}
            </pre>
          )}
        </div>
      )}

      {message.replyTo && (
        <div className="flex items-center gap-2 text-[10px]">
          <span className="text-muted-foreground">Reply To:</span>
          <span className="font-mono text-muted-foreground">{message.replyTo}</span>
        </div>
      )}
    </div>
  );
});
