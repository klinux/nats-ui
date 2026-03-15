import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Activity,
  MessageSquare,
  Users,
  TrendingUp,
  Zap,
  Clock,
} from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { useNats } from '../hooks/useNats';
import { fetchNatsInfo, fetchNatsConnections, fetchJetStreamInfo } from '../services/nats-service';
import { MetricCardSkeleton } from '../components/ui/skeletons';
import { formatBytes, parseUptimeToSeconds, formatUptimeFromSeconds } from '../lib/format';
import { staggerContainer, easings } from '../lib/animations';
import { MetricCard } from '../components/dashboard/MetricCard';
import { ServerInfo } from '../components/dashboard/ServerInfo';
import { DisconnectedView } from '../components/dashboard/DisconnectedView';

export default function Dashboard() {
  const { isConnected, status, error } = useNats();
  const [serverInfo, setServerInfo] = useState<Record<string, unknown> | null>(null);
  const [connections, setConnections] = useState<Record<string, unknown> | null>(null);
  const [jetStreamInfo, setJetStreamInfo] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [uptimeOffset, setUptimeOffset] = useState<number>(0);
  const [lastFetchTime, setLastFetchTime] = useState<number>(Date.now());
  const [currentTime, setCurrentTime] = useState<number>(Date.now());

  // Fetch real NATS metrics
  const fetchMetrics = useCallback(async () => {
    if (!isConnected) return;

    // Only show loading on initial load
    if (initialLoading) {
      setLoading(true);
    }

    try {
      const [info, conns, js] = await Promise.all([
        fetchNatsInfo(),
        fetchNatsConnections(),
        fetchJetStreamInfo()
      ]);

      setServerInfo(info);
      setConnections(conns);
      setJetStreamInfo(js);

      // Update the uptime reference point
      if (info?.uptime && typeof info.uptime === 'string') {
        setUptimeOffset(parseUptimeToSeconds(info.uptime));
        setLastFetchTime(Date.now());
      }

      if (initialLoading) {
        setInitialLoading(false);
      }
    } catch (error) {
      console.error('Failed to fetch NATS metrics:', error);
    } finally {
      if (initialLoading) {
        setLoading(false);
      }
    }
  }, [isConnected, initialLoading]);

  useEffect(() => {
    fetchMetrics();

    // Refresh metrics every 5 seconds when connected
    if (isConnected) {
      const interval = setInterval(fetchMetrics, 5000);
      return () => clearInterval(interval);
    }
  }, [fetchMetrics, isConnected]);

  // Update current time every second for real-time uptime
  useEffect(() => {
    if (isConnected) {
      const interval = setInterval(() => {
        setCurrentTime(Date.now());
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [isConnected]);

  // Calculate real-time uptime
  const getRealTimeUptime = (): string => {
    if (!uptimeOffset || !isConnected) return '0s';

    const elapsedSinceLastFetch = Math.floor((currentTime - lastFetchTime) / 1000);
    const currentUptimeSeconds = uptimeOffset + elapsedSinceLastFetch;

    return formatUptimeFromSeconds(currentUptimeSeconds);
  };

  // Calculate metrics from real data
  const metrics = {
    connections: Array.isArray((connections as Record<string, unknown>)?.connections)
      ? ((connections as Record<string, unknown>).connections as unknown[]).length
      : 0,
    subscriptions: typeof serverInfo?.subscriptions === 'number' ? serverInfo.subscriptions : 0,
    messages: typeof serverInfo?.in_msgs === 'number' ? serverInfo.in_msgs : 0,
    bytesIn: serverInfo && typeof serverInfo.in_bytes === 'number'
      ? formatBytes(serverInfo.in_bytes)
      : '0 B',
    bytesOut: serverInfo && typeof serverInfo.out_bytes === 'number'
      ? formatBytes(serverInfo.out_bytes)
      : '0 B',
    uptime: getRealTimeUptime(),
  };

  if (!isConnected) {
    return <DisconnectedView status={status} error={error} />;
  }

  return (
    <div className="flex-1 space-y-4">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
      </div>

      {/* Connection Status */}
      <ConnectionStatusCard status={status} error={error} />

      {/* Metrics Grid */}
      <motion.div
        className="grid gap-4 md:grid-cols-2 lg:grid-cols-4"
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
      >
        {initialLoading && loading ? (
          <>
            <MetricCardSkeleton />
            <MetricCardSkeleton />
            <MetricCardSkeleton />
            <MetricCardSkeleton />
          </>
        ) : (
          <>
            <MetricCard
              title="Active Connections"
              value={metrics.connections}
              description="Current client connections"
              icon={<Users className="h-4 w-4 text-muted-foreground" />}
            />
            <MetricCard
              title="Subscriptions"
              value={metrics.subscriptions}
              description="Total active subscriptions"
              icon={<MessageSquare className="h-4 w-4 text-muted-foreground" />}
            />
            <MetricCard
              title="Messages Processed"
              value={metrics.messages}
              description="Total messages processed"
              icon={<Zap className="h-4 w-4 text-muted-foreground" />}
            />
            <MetricCard
              title="Uptime"
              value={metrics.uptime}
              description="Server uptime"
              icon={<Clock className="h-4 w-4 text-muted-foreground" />}
            />
          </>
        )}
      </motion.div>

      {/* Data Transfer */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Data In
            </CardTitle>
            <CardDescription>
              Total data received by the server
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.bytesIn}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 rotate-180" />
              Data Out
            </CardTitle>
            <CardDescription>
              Total data sent by the server
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.bytesOut}</div>
          </CardContent>
        </Card>
      </div>

      {/* Server & JetStream Information */}
      <ServerInfo serverInfo={serverInfo} jetStreamInfo={jetStreamInfo} />

      {loading && (
        <div className="text-center text-muted-foreground">
          <Activity className="h-4 w-4 animate-spin inline-block mr-2" />
          Refreshing metrics...
        </div>
      )}
    </div>
  );
}

interface ConnectionStatusCardProps {
  status: string;
  error: string | null;
}

function ConnectionStatusCard({ status, error }: ConnectionStatusCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <motion.div
              animate={status === 'connected' ? {
                scale: [1, 1.08, 1],
                transition: {
                  duration: 2,
                  repeat: Infinity,
                  ease: easings.standard
                }
              } : {}}
            >
              <Activity className="h-5 w-5" />
            </motion.div>
            Connection Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Server</p>
              <p className="text-lg font-semibold">Backend API</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Status</p>
              <motion.div
                initial={{ scale: 0.9 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.2 }}
              >
                <Badge variant={status === 'connected' ? 'default' : 'destructive'}>
                  {status}
                </Badge>
              </motion.div>
            </div>
          </div>
          {error && (
            <motion.div
              className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-md"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
            >
              <p className="text-sm text-destructive">{error}</p>
            </motion.div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

