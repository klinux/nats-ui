import { useState, useCallback } from 'react';
import { Users, Pause, Play } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import { toast } from 'sonner';
import { pauseConsumer, resumeConsumer } from '../../services/api-client';

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

  const activity = getActivityStatus(consumer.lastActivity);
  const lagColor = getLagColor(consumer.pending);
  const lagLabel = getLagLabel(consumer.pending);

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Consumer: {consumer.name}
            {consumer.paused ? (
              <Badge className="bg-yellow-500 text-white">Paused</Badge>
            ) : (
              <Badge className="bg-green-500 text-white">Active</Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            Detailed information and statistics for this consumer
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Metrics Grid */}
          <div className="grid grid-cols-5 gap-3">
            <MetricCard label="Delivered" value={consumer.delivered} />
            <MetricCard label="Acknowledged" value={consumer.acknowledged} />
            <MetricCard label="Pending" value={consumer.pending} className="text-yellow-600" />
            <MetricCard label="Redelivered" value={consumer.redelivered} className="text-red-600" />
            <MetricCard label="Waiting" value={consumer.numWaiting} />
          </div>

          {/* Lag Indicator */}
          <div className="flex items-center gap-3 p-3 rounded-lg border">
            <div className={`w-3 h-3 rounded-full ${lagColor}`} />
            <span className="text-sm font-medium">Consumer Lag:</span>
            <Badge variant={getLagBadgeVariant(consumer.pending)}>{lagLabel}</Badge>
            <span className="text-sm text-muted-foreground ml-auto">
              {consumer.pending.toLocaleString()} pending messages
            </span>
          </div>

          {/* Configuration & Stats */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Configuration</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <DetailRow label="Stream" value={<Badge variant="outline">{consumer.stream}</Badge>} />
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
    <div className="flex justify-between items-center">
      <span className="text-sm text-muted-foreground">{label}:</span>
      {typeof value === 'string' ? <span className="text-sm font-medium">{value}</span> : value}
    </div>
  );
}
