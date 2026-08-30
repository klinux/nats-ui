import { AlertTriangle, Download } from 'lucide-react';

import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import { JsonViewer } from '../ui/json-viewer';
import type { PulledMessage } from '../../services/api-client-extended';

interface PullMessagesSectionProps {
  batchSize: number;
  onBatchSizeChange: (v: number) => void;
  onPull: () => void;
  pulling: boolean;
  messages: PulledMessage[];
  ack: boolean;
  onAckChange: (v: boolean) => void;
}

export function PullMessagesSection({
  batchSize, onBatchSizeChange, onPull, pulling, messages, ack, onAckChange,
}: PullMessagesSectionProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Download className="h-4 w-4" /> Pull Messages
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-end gap-3">
          <div className="space-y-1">
            <Label htmlFor="batch-size" className="text-xs">Batch Size</Label>
            <Input
              id="batch-size"
              type="number"
              min={1}
              max={100}
              value={batchSize}
              onChange={(e) => onBatchSizeChange(Math.min(100, Math.max(1, Number(e.target.value) || 1)))}
              className="w-24 h-8"
            />
          </div>
          <Button size="sm" onClick={onPull} disabled={pulling}>
            <Download className="mr-2 h-4 w-4" />
            {pulling ? 'Fetching...' : 'Fetch Next'}
          </Button>
        </div>

        {/* Browsing is non-destructive unless the user opts in: acking here
            consumes the messages for the real consumer too. */}
        <div className="flex items-center gap-2">
          <Switch id="ack-after-fetch" checked={ack} onCheckedChange={onAckChange} />
          <Label htmlFor="ack-after-fetch" className="text-xs font-normal">
            Ack after fetch
          </Label>
        </div>
        {ack && (
          <p className="flex items-start gap-1.5 text-xs text-yellow-600 dark:text-yellow-500">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Fetched messages will be acknowledged and permanently removed from this consumer.
          </p>
        )}
        {messages.length > 0 && (
          <div className="max-h-96 overflow-y-auto space-y-2">
            {messages.map((msg) => (
              <div key={msg.sequence} className="p-2 rounded border text-xs space-y-1">
                <div className="flex items-center justify-between gap-2 min-w-0">
                  <Badge variant="outline" className="text-[10px] shrink-0">seq: {msg.sequence}</Badge>
                  <span className="font-mono text-muted-foreground truncate" title={msg.subject}>
                    {msg.subject}
                  </span>
                  <span className="text-muted-foreground shrink-0">
                    {new Date(msg.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                {/* JsonViewer keeps nested objects/arrays individually expandable.
                    A single pulled message is shown open; larger batches stay
                    collapsed so a batch of 100 doesn't render 100 full trees. */}
                <JsonViewer
                  data={msg.data}
                  defaultExpanded={messages.length === 1}
                  className="text-xs p-1"
                />
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
