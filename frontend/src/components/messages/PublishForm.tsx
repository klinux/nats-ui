import { useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Send,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';

import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '../ui/collapsible';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { NatsService } from '../../services/nats-service';

const publishSchema = z.object({
  data: z.string(),
  headers: z.string().optional(),
});

type PublishFormData = z.infer<typeof publishSchema>;

interface PublishFormProps {
  topic: string;
  connection: NatsService | null;
  isExpanded: boolean;
  onToggle: (open: boolean) => void;
}

export function PublishForm({ topic, connection, isExpanded, onToggle }: PublishFormProps) {
  const form = useForm<PublishFormData>({
    resolver: zodResolver(publishSchema),
    defaultValues: { data: '', headers: '' },
  });

  const handleSubmit = useCallback(async (data: PublishFormData) => {
    if (!connection) {
      toast.error('Not connected');
      return;
    }
    try {
      let headers: Record<string, string> | undefined;
      if (data.headers?.trim()) {
        try {
          headers = JSON.parse(data.headers);
        } catch {
          toast.error('Invalid JSON in headers');
          return;
        }
      }
      await connection.publish(topic, data.data, headers);
      toast.success(`Published to ${topic}`);
      form.reset();
    } catch {
      toast.error('Failed to publish');
    }
  }, [connection, topic, form]);

  return (
    <Collapsible open={isExpanded} onOpenChange={onToggle} className="flex-shrink-0">
      <Card className={cn('overflow-hidden pt-0 gap-1', !isExpanded && 'pb-0')}>
        <CollapsibleTrigger asChild>
          <div className="cursor-pointer hover:bg-muted/50 transition-colors px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Send className="h-4 w-4" />
                <span className="text-sm font-semibold">Publish</span>
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
          <CardContent className="px-4 pb-4 pt-0">
            <form
              onSubmit={form.handleSubmit(handleSubmit)}
              className="space-y-3"
              autoComplete="off"
              data-form-type="other"
            >
              <div className="space-y-1">
                <Label htmlFor="publish-data" className="text-xs">Message Data</Label>
                <Textarea
                  id="publish-data"
                  placeholder="Enter message content..."
                  rows={3}
                  className="text-xs font-mono resize-none"
                  {...form.register('data')}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="publish-headers" className="text-xs">Headers (JSON, optional)</Label>
                <Textarea
                  id="publish-headers"
                  placeholder='{"Content-Type": "application/json"}'
                  rows={2}
                  className="text-xs font-mono resize-none"
                  {...form.register('headers')}
                />
              </div>
              <Button
                type="submit"
                disabled={form.formState.isSubmitting}
                size="sm"
                className="w-full text-xs"
              >
                <Send className="mr-1.5 h-3 w-3" />
                Publish Message
              </Button>
            </form>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
