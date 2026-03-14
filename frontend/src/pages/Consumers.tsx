import { useState, useCallback, useEffect, useRef } from 'react';
import { Users, Trash2, Info, Clock, TrendingUp } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '../components/ui/dialog';
import { useNats } from '../hooks/useNats';
import { toast } from 'sonner';
import { fetchAllConsumers } from '../services/nats-service';
import { TableRowSkeleton } from '../components/ui/skeletons';
import { ConsumerDetail } from '../components/consumers/ConsumerDetail';
import { CreateConsumerDialog } from '../components/consumers/CreateConsumerDialog';
import type { Consumer } from '../components/consumers/ConsumerDetail';

function convertJetStreamConsumer(jsData: Record<string, unknown>): Consumer {
  const config = (jsData.config as Record<string, unknown>) || {};
  const delivered = (jsData.delivered as Record<string, unknown>) || {};
  const ackFloor = (jsData.ack_floor as Record<string, unknown>) || {};

  return {
    name: (config.name as string) || (jsData.name as string) || '',
    stream: (jsData.stream_name as string) || '',
    subject: (config.filter_subject as string) || '',
    deliverPolicy: ((config.deliver_policy as string) || 'all') as Consumer['deliverPolicy'],
    ackPolicy: ((config.ack_policy as string) || 'explicit') as Consumer['ackPolicy'],
    replayPolicy: ((config.replay_policy as string) || 'instant') as Consumer['replayPolicy'],
    maxDeliver: (config.max_deliver as number) || 0,
    delivered: (delivered.consumer_seq as number) || 0,
    acknowledged: (ackFloor.consumer_seq as number) || 0,
    pending: (jsData.num_pending as number) || 0,
    redelivered: (jsData.num_redelivered as number) || 0,
    numWaiting: (jsData.num_waiting as number) || 0,
    paused: (jsData.paused as boolean) || false,
    created: new Date((jsData.created as string | number) || Date.now()),
    lastActivity: delivered.last_active ? new Date(delivered.last_active as string | number) : new Date(),
    isActive: (jsData.push_bound as boolean) || (jsData.num_waiting as number) > 0,
  };
}

function getActivityStatus(lastActivity: Date) {
  const diffMinutes = (Date.now() - lastActivity.getTime()) / (1000 * 60);
  if (diffMinutes < 5) return { status: 'active', color: 'bg-green-500' };
  if (diffMinutes < 30) return { status: 'idle', color: 'bg-yellow-500' };
  return { status: 'stale', color: 'bg-gray-500' };
}

function lagColor(pending: number): string {
  if (pending < 100) return 'bg-green-500';
  if (pending <= 1000) return 'bg-yellow-500';
  return 'bg-red-500';
}

export function Consumers() {
  const { connection, isConnected } = useNats();
  const [consumers, setConsumers] = useState<Consumer[]>([]);
  const [selectedConsumer, setSelectedConsumer] = useState<Consumer | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [consumerToDelete, setConsumerToDelete] = useState<{ name: string; stream: string } | null>(null);
  const [showBlur, setShowBlur] = useState(false);
  const tableContainerRef = useRef<HTMLDivElement>(null);

  const fetchConsumers = useCallback(async () => {
    if (!isConnected || !connection) return;
    try {
      let data: Record<string, unknown>[] = [];
      try {
        const streams = await connection.jetstream.listStreams();
        for (const stream of streams) {
          const name = (stream.config as Record<string, unknown> | undefined)?.name as string || stream.name as string;
          if (name) {
            const sc = await connection.jetstream.listConsumers(name);
            data.push(...sc.map((c: Record<string, unknown>) => ({ ...c, stream_name: name })));
          }
        }
      } catch {
        console.warn('JetStream API not available, using HTTP monitoring API');
        data = await fetchAllConsumers();
      }
      setConsumers(data.map(convertJetStreamConsumer));
    } catch (error) {
      console.error('Failed to fetch consumers:', error);
      toast.error('Failed to fetch consumers');
    } finally {
      setInitialLoading(false);
    }
  }, [isConnected, connection]);

  const handleDeleteConsumer = useCallback(async (consumerName: string, streamName: string) => {
    if (!connection) { toast.error('Not connected to NATS server'); return; }
    try {
      await connection.jetstream.deleteConsumer(streamName, consumerName);
      toast.success(`Consumer ${consumerName} deleted`);
      await fetchConsumers();
    } catch (err) {
      toast.error(`Failed to delete consumer: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }, [connection, fetchConsumers]);

  const checkScrollBlur = useCallback(() => {
    if (tableContainerRef.current) {
      const { scrollHeight, clientHeight } = tableContainerRef.current;
      setShowBlur(scrollHeight > clientHeight);
    }
  }, []);

  useEffect(() => {
    fetchConsumers();
    if (isConnected) {
      const interval = setInterval(fetchConsumers, 10000);
      return () => clearInterval(interval);
    }
  }, [isConnected, fetchConsumers]);

  useEffect(() => {
    checkScrollBlur();
    window.addEventListener('resize', checkScrollBlur);
    return () => window.removeEventListener('resize', checkScrollBlur);
  }, [consumers, checkScrollBlur]);

  if (!isConnected) {
    return (
      <div className="h-full flex flex-col p-4">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">Consumers</h1>
            <p className="text-muted-foreground">Connect to NATS server to manage JetStream consumers</p>
          </div>
        </div>
      </div>
    );
  }

  const tableHeaders = ['Name', 'Stream', 'Subject', 'Status', 'Delivered', 'Pending', 'Redelivered', 'Last Activity', 'Actions'];

  return (
    <div className="h-full flex flex-col p-4 overflow-hidden">
      <div className="flex items-center justify-between mb-6 flex-shrink-0">
        <div>
          <h1 className="text-3xl font-bold">Consumers</h1>
          <p className="text-muted-foreground">Monitor and manage JetStream consumers</p>
        </div>
        <CreateConsumerDialog onCreated={fetchConsumers} />
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 flex-shrink-0">
        <SummaryCard title="Total Consumers" icon={<Users className="h-4 w-4 text-muted-foreground" />}
          value={consumers.length} subtitle={`${consumers.filter(c => c.isActive).length} active`} />
        <SummaryCard title="Messages Delivered" icon={<TrendingUp className="h-4 w-4 text-muted-foreground" />}
          value={consumers.reduce((s, c) => s + c.delivered, 0)} subtitle="Total across all consumers" />
        <SummaryCard title="Pending Messages" icon={<Clock className="h-4 w-4 text-muted-foreground" />}
          value={consumers.reduce((s, c) => s + c.pending, 0)} subtitle="Awaiting acknowledgment" />
        <SummaryCard title="Redeliveries" icon={<TrendingUp className="h-4 w-4 text-muted-foreground" />}
          value={consumers.reduce((s, c) => s + c.redelivered, 0)} subtitle="Messages redelivered" />
      </div>

      {/* Consumers Table */}
      <Card className="flex-1 flex flex-col mt-6 overflow-hidden">
        <CardHeader className="flex-shrink-0">
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            JetStream Consumers ({consumers.length})
          </CardTitle>
          <CardDescription>Overview of all JetStream consumers and their status</CardDescription>
        </CardHeader>
        <CardContent className="flex-1 overflow-hidden relative">
          {initialLoading ? (
            <div className="h-full overflow-auto" ref={tableContainerRef}>
              <Table>
                <TableHeader><TableRow>{tableHeaders.map(h => <TableHead key={h}>{h}</TableHead>)}</TableRow></TableHeader>
                <TableBody>{Array.from({ length: 3 }).map((_, i) => <TableRowSkeleton key={i} columns={9} />)}</TableBody>
              </Table>
            </div>
          ) : consumers.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full space-y-4">
              <Users className="h-12 w-12 text-muted-foreground/50" />
              <div className="text-center space-y-2">
                <h3 className="font-semibold">No consumers found</h3>
                <p className="text-sm text-muted-foreground">Consumers will appear here once you create them</p>
              </div>
            </div>
          ) : (
            <div className="h-full overflow-auto" ref={tableContainerRef}>
              <Table>
                <TableHeader><TableRow>{tableHeaders.map(h => <TableHead key={h} className={h === 'Actions' ? 'w-32' : ''}>{h}</TableHead>)}</TableRow></TableHeader>
                <TableBody>
                  {consumers.map((consumer) => {
                    const activity = getActivityStatus(consumer.lastActivity);
                    return (
                      <TableRow key={consumer.name}>
                        <TableCell className="font-medium">{consumer.name}</TableCell>
                        <TableCell><Badge variant="outline">{consumer.stream}</Badge></TableCell>
                        <TableCell>{consumer.subject}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {consumer.paused ? (
                              <Badge className="bg-yellow-500 text-white">Paused</Badge>
                            ) : (
                              <>
                                <div className={`w-2 h-2 rounded-full ${consumer.isActive ? activity.color : 'bg-red-500'}`} />
                                <Badge variant={consumer.isActive ? 'default' : 'secondary'}>{consumer.isActive ? 'Active' : 'Stopped'}</Badge>
                              </>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{consumer.delivered.toLocaleString()}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${lagColor(consumer.pending)}`} />
                            <span className={consumer.pending > 0 ? 'text-yellow-600 font-medium' : ''}>{consumer.pending.toLocaleString()}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className={consumer.redelivered > 0 ? 'text-red-600 font-medium' : ''}>{consumer.redelivered.toLocaleString()}</span>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{consumer.lastActivity.toLocaleString()}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="sm" onClick={() => setSelectedConsumer(consumer)}><Info className="h-4 w-4" /></Button>
                            <DeleteConsumerButton consumer={consumer} consumerToDelete={consumerToDelete}
                              onRequestDelete={setConsumerToDelete} onConfirmDelete={handleDeleteConsumer} />
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
          {showBlur && !initialLoading && consumers.length > 0 && (
            <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-background to-transparent pointer-events-none" />
          )}
        </CardContent>
      </Card>

      {selectedConsumer && (
        <ConsumerDetail consumer={selectedConsumer} onClose={() => setSelectedConsumer(null)}
          onRefresh={fetchConsumers} getActivityStatus={getActivityStatus} />
      )}
    </div>
  );
}

function SummaryCard({ title, icon, value, subtitle }: { title: string; icon: React.ReactNode; value: number; subtitle: string }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value.toLocaleString()}</div>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </CardContent>
    </Card>
  );
}

function DeleteConsumerButton({ consumer, consumerToDelete, onRequestDelete, onConfirmDelete }: {
  consumer: Consumer;
  consumerToDelete: { name: string; stream: string } | null;
  onRequestDelete: (v: { name: string; stream: string } | null) => void;
  onConfirmDelete: (name: string, stream: string) => void;
}) {
  return (
    <Dialog open={consumerToDelete?.name === consumer.name} onOpenChange={(open) => { if (!open) onRequestDelete(null); }}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" onClick={() => onRequestDelete({ name: consumer.name, stream: consumer.stream })}
          className="text-red-600 hover:text-red-700"><Trash2 className="h-4 w-4" /></Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Consumer</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete consumer &quot;{consumer.name}&quot; from stream &quot;{consumer.stream}&quot;? This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onRequestDelete(null)}>Cancel</Button>
          <Button onClick={() => { onConfirmDelete(consumer.name, consumer.stream); onRequestDelete(null); }}
            className="bg-red-600 text-white hover:bg-red-700">Delete Consumer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
