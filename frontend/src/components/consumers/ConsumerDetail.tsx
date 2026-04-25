import { useState, useCallback } from 'react';
import { Users, Pause, Play, Download } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import { toast } from 'sonner';
import { pauseConsumer, resumeConsumer } from '../../services/api-client';
import { fetchNextMessages, type PulledMessage } from '../../services/api-client-extended';

export interface Consumer {
  name: string;
  stream: string;
  subject: string;
  deliverPolicy: 'all' | 'last' | 'new' | 'by_start_sequence' | 'by_start_time';
  ackPolicy: 'none' | 'all' | 'explicit';
  replayPolicy: 'instant' | 'original';
  maxDeliver: number;
  delivered: number;
  acknowledged: number;
  pending: number;
  redelivered: number;
  numWaiting: number;
  paused: boolean;
  created: Date;
  lastActivity: Date;
  isActive: boolean;
}

interface ConsumerDetailProps {
  consumer: Consumer;
  onClose: () => void;
  onRefresh: () => void;
  getActivityStatus: (lastActivity: Date) => { status: string; color: string };
}

function getLagColor(pending: number): string {
  if (pending < 100) return 'bg-green-500';
  if (pending <= 1000) return 'bg-yellow-500';
  return 'bg-red-500';
}

function getLagLabel(pending: number): string {
  if (pending < 100) return 'Healthy';
  if (pending <= 1000) return 'Behind';
  return 'Critical';
}

function getLagBadgeVariant(pending: number): 'default' | 'secondary' | 'destructive' {
  if (pending < 100) return 'default';
  if (pending <= 1000) return 'secondary';
  return 'destructive';
}

export function ConsumerDetail({ consumer, onClose, onRefresh, getActivityStatus }: ConsumerDetailProps) {
  const [loading, setLoading] = useState(false);
  const [batchSize, setBatchSize] = useState(1);
  const [pulledMessages, setPulledMessages] = useState<PulledMessage[]>([]);
  const [pulling, setPulling] = useState(false);

  const handlePause = useCallback(async () => {
    setLoading(true);
    try {
      await pauseConsumer(consumer.stream, consumer.name);
      toast.success(`Consumer ${consumer.name} paused`);
      onRefresh();
    } catch (err) {
      toast.error(`Failed to pause consumer: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  }, [consumer.stream, consumer.name, onRefresh]);

  const handleResume = useCallback(async () => {
    setLoading(true);
    try {
      await resumeConsumer(consumer.stream, consumer.name);
      toast.success(`Consumer ${consumer.name} resumed`);
      onRefresh();
    } catch (err) {
      toast.error(`Failed to resume consumer: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  }, [consumer.stream, consumer.name, onRefresh]);

  const handlePull = useCallback(async () => {
    setPulling(true);
    try {
      const msgs = await fetchNextMessages(consumer.stream, consumer.name, batchSize);
      setPulledMessages(msgs);
      if (msgs.length === 0) {
        toast.info('No messages available');
      }
    } catch (err) {
      toast.error(`Failed to pull messages: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setPulling(false);
    }
  }, [consumer.stream, consumer.name, batchSize]);

  const activity = getActivityStatus(consumer.lastActivity);
  const lagColor = getLagColor(consumer.pending);
  const lagLabel = getLagLabel(consumer.pending);

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 min-w-0">
            <Users className="h-5 w-5 shrink-0" />
            <span className="truncate" title={consumer.name}>Consumer: {consumer.name}</span>
            {consumer.paused ? (
              <Badge className="bg-yellow-500 text-white shrink-0">Paused</Badge>
            ) : (
              <Badge className="bg-green-500 text-white shrink-0">Active</Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            Detailed information and statistics for this consumer
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <MetricsGrid consumer={consumer} />
          <LagIndicator lagColor={lagColor} lagLabel={lagLabel} pending={consumer.pending} />
          <ConfigAndTimestamps consumer={consumer} activity={activity} />

          {/* Pull Messages */}
          <PullMessagesSection
            batchSize={batchSize}
            onBatchSizeChange={setBatchSize}
            onPull={handlePull}
            pulling={pulling}
            messages={pulledMessages}
          />

          {/* Actions */}
          <div className="flex items-center gap-3 pt-4 border-t">
            {consumer.paused ? (
              <Button onClick={handleResume} disabled={loading} size="sm">
                <Play className="mr-2 h-4 w-4" />
                Resume Consumer
              </Button>
            ) : (
              <Button onClick={handlePause} disabled={loading} variant="secondary" size="sm">
                <Pause className="mr-2 h-4 w-4" />
                Pause Consumer
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function MetricsGrid({ consumer }: { consumer: Consumer }) {
  return (
    <div className="grid grid-cols-5 gap-3">
      <MetricCard label="Delivered" value={consumer.delivered} />
      <MetricCard label="Acknowledged" value={consumer.acknowledged} />
      <MetricCard label="Pending" value={consumer.pending} className="text-yellow-600" />
      <MetricCard label="Redelivered" value={consumer.redelivered} className="text-red-600" />
      <MetricCard label="Waiting" value={consumer.numWaiting} />
    </div>
  );
}

function LagIndicator({ lagColor, lagLabel, pending }: { lagColor: string; lagLabel: string; pending: number }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border">
      <div className={`w-3 h-3 rounded-full ${lagColor}`} />
      <span className="text-sm font-medium">Consumer Lag:</span>
      <Badge variant={getLagBadgeVariant(pending)}>{lagLabel}</Badge>
      <span className="text-sm text-muted-foreground ml-auto">
        {pending.toLocaleString()} pending messages
      </span>
    </div>
  );
}

function ConfigAndTimestamps({ consumer, activity }: { consumer: Consumer; activity: { status: string; color: string } }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <DetailRow
            label="Stream"
            value={
              <Badge variant="outline" className="max-w-full truncate" title={consumer.stream}>
                {consumer.stream}
              </Badge>
            }
          />
          <DetailRow label="Subject" value={consumer.subject} />
          <DetailRow label="Deliver Policy" value={consumer.deliverPolicy} />
          <DetailRow label="Ack Policy" value={consumer.ackPolicy} />
          <DetailRow label="Max Deliver" value={String(consumer.maxDeliver)} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Timestamps</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <DetailRow label="Created" value={consumer.created.toLocaleDateString()} />
          <DetailRow label="Last Activity" value={consumer.lastActivity.toLocaleString()} />
          <DetailRow
            label="Status"
            value={
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${consumer.isActive ? activity.color : 'bg-red-500'}`} />
                <span className="text-sm">{consumer.isActive ? 'Active' : 'Stopped'}</span>
              </div>
            }
          />
        </CardContent>
      </Card>
    </div>
  );
}

function PullMessagesSection({
  batchSize, onBatchSizeChange, onPull, pulling, messages,
}: {
  batchSize: number;
  onBatchSizeChange: (v: number) => void;
  onPull: () => void;
  pulling: boolean;
  messages: PulledMessage[];
}) {
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
        {messages.length > 0 && (
          <div className="max-h-48 overflow-y-auto space-y-2">
            {messages.map((msg, i) => (
              <div key={i} className="p-2 rounded border text-xs space-y-1">
                <div className="flex items-center justify-between gap-2 min-w-0">
                  <Badge variant="outline" className="text-[10px] shrink-0">seq: {msg.sequence}</Badge>
                  <span className="font-mono text-muted-foreground truncate" title={msg.subject}>
                    {msg.subject}
                  </span>
                  <span className="text-muted-foreground shrink-0">
                    {new Date(msg.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <pre className="text-xs bg-muted p-1 rounded overflow-x-auto">
                  {typeof msg.data === 'string' ? msg.data : JSON.stringify(msg.data, null, 2)}
                </pre>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MetricCard({ label, value, className }: { label: string; value: number; className?: string }) {
  return (
    <div className="text-center p-2 rounded-lg border">
      <div className={`text-lg font-bold ${className || ''}`}>{value.toLocaleString()}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between items-center gap-2 min-w-0">
      <span className="text-sm text-muted-foreground shrink-0">{label}:</span>
      {typeof value === 'string' ? (
        <span className="text-sm font-medium truncate text-right" title={value}>{value}</span>
      ) : (
        <div className="min-w-0 truncate text-right">{value}</div>
      )}
    </div>
  );
}
