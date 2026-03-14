import { useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  ArrowRightLeft,
  ChevronDown,
  ChevronRight,
  Loader2,
  Clock,
} from 'lucide-react';

import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { JsonViewer } from '../ui/json-viewer';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '../ui/collapsible';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { requestReply, type RequestReplyResponse } from '../../services/api-client';

const requestSchema = z.object({
  data: z.string(),
  headers: z.string().optional(),
  timeout: z.coerce.number().min(100).max(30000).default(5000),
});

type RequestFormData = z.infer<typeof requestSchema>;

interface RequestReplyPanelProps {
  topic: string;
  isExpanded: boolean;
  onToggle: (open: boolean) => void;
}

export function RequestReplyPanel({ topic, isExpanded, onToggle }: RequestReplyPanelProps) {
  const [response, setResponse] = useState<RequestReplyResponse | null>(null);
  const [responseTime, setResponseTime] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<RequestFormData>({
    resolver: zodResolver(requestSchema),
    defaultValues: { data: '', headers: '', timeout: 5000 },
  });

  const handleSubmit = useCallback(async (data: RequestFormData) => {
    setIsLoading(true);
    setResponse(null);
    setResponseTime(null);
    const start = performance.now();

    try {
      let headers: Record<string, string> | undefined;
      if (data.headers?.trim()) {
        try {
          headers = JSON.parse(data.headers);
        } catch {
          toast.error('Invalid JSON in headers');
          setIsLoading(false);
          return;
        }
      }

      const res = await requestReply(topic, data.data, headers, data.timeout);
      const elapsed = Math.round(performance.now() - start);
      setResponse(res);
      setResponseTime(elapsed);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Request failed';
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  }, [topic]);

  const isJsonResponse = response?.data
    ? (() => { try { JSON.parse(typeof response.data === 'string' ? response.data : JSON.stringify(response.data)); return true; } catch { return false; } })()
    : false;

  return (
    <Collapsible open={isExpanded} onOpenChange={onToggle} className="flex-shrink-0">
      <Card className={cn('overflow-hidden pt-0 gap-1', !isExpanded && 'pb-0')}>
        <CollapsibleTrigger asChild>
          <div className="cursor-pointer hover:bg-muted/50 transition-colors px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ArrowRightLeft className="h-4 w-4" />
                <span className="text-sm font-semibold">Request-Reply</span>
              </div>
              {isExpanded ? (
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
              )}
            </div>
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="px-4 pb-4 pt-0 space-y-3">
            <form
              onSubmit={form.handleSubmit(handleSubmit)}
              className="space-y-3"
              autoComplete="off"
              data-form-type="other"
            >
              <div className="space-y-1">
                <Label htmlFor="req-data" className="text-xs">Request Data</Label>
                <Textarea
                  id="req-data"
                  placeholder="Enter request payload..."
                  rows={3}
                  className="text-xs font-mono resize-none"
                  {...form.register('data')}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label htmlFor="req-headers" className="text-xs">Headers (JSON)</Label>
                  <Textarea
                    id="req-headers"
                    placeholder="{}"
                    rows={2}
                    className="text-xs font-mono resize-none"
                    {...form.register('headers')}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="req-timeout" className="text-xs">Timeout (ms)</Label>
                  <Input
                    id="req-timeout"
                    type="number"
                    className="text-xs h-8"
                    {...form.register('timeout')}
                  />
                </div>
              </div>
              <Button
                type="submit"
                disabled={isLoading}
                size="sm"
                className="w-full text-xs"
                variant="secondary"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                    Waiting for reply...
                  </>
                ) : (
                  <>
                    <ArrowRightLeft className="mr-1.5 h-3 w-3" />
                    Send Request
                  </>
                )}
              </Button>
            </form>

            {response && (
              <div className="space-y-2 border-t pt-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium">Response</span>
                  <div className="flex items-center gap-2">
                    {responseTime !== null && (
                      <Badge variant="outline" className="text-[10px] gap-1">
                        <Clock className="h-2.5 w-2.5" />
                        {responseTime}ms
                      </Badge>
                    )}
                    <Badge variant="default" className="text-[10px] bg-green-600">OK</Badge>
                  </div>
                </div>
                {isJsonResponse ? (
                  <JsonViewer
                    data={typeof response.data === 'string' ? response.data : JSON.stringify(response.data)}
                    defaultExpanded={true}
                  />
                ) : (
                  <pre className="text-xs bg-muted p-2 rounded font-mono whitespace-pre-wrap overflow-x-auto">
                    {typeof response.data === 'string' ? response.data : JSON.stringify(response.data, null, 2)}
                  </pre>
                )}
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
