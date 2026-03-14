import { useState, useEffect, useCallback } from 'react';
import { Activity, Users, MessageSquare, Database, Clock } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { useNats } from '../hooks/useNats';
import { fetchNatsInfo, fetchNatsConnections, fetchJetStreamInfo } from '../services/nats-service';
import { subjectTracker } from '../services/subject-tracker';
import type { NatsServerInfo, NatsConnectionInfo, JetStreamInfo, SubjectData, TimeSeriesDataPoint } from '../types/monitoring';
import { formatBytes, formatUptime } from '../lib/format';

import { MetricCard } from '../components/monitoring/MetricCards';
import { useChartColors } from '../components/monitoring/useChartColors';
import { PerformanceTab } from '../components/monitoring/PerformanceTab';
import { SystemTab } from '../components/monitoring/SystemTab';

const SUBJECT_COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7c7c', '#8dd1e1', '#d084d8', '#ffb347', '#87ceeb', '#98fb98', '#dda0dd'];

function buildSubjectData(subjects: Array<{ subject: string; messageCount: number; lastMessage?: string }>): SubjectData[] {
  return subjects.map((subject, index) => ({
    subject: subject.subject || 'Unknown',
    messageCount: Number(subject.messageCount || 0),
    lastMessage: subject.lastMessage || '',
    name: subject.subject && subject.subject.length > 15 ? subject.subject.substring(0, 15) + '...' : subject.subject || 'Unknown',
    messages: Number(subject.messageCount || 0),
    color: SUBJECT_COLORS[index % SUBJECT_COLORS.length],
  }));
}

export function Monitoring() {
  const { isConnected } = useNats();
  const colors = useChartColors();
  const [serverInfo, setServerInfo] = useState<NatsServerInfo | null>(null);
  const [connections, setConnections] = useState<NatsConnectionInfo | null>(null);
  const [jetStreamInfo, setJetStreamInfo] = useState<JetStreamInfo | null>(null);
  const [subjectData, setSubjectData] = useState<SubjectData[]>([]);
  const [timeSeriesData, setTimeSeriesData] = useState<TimeSeriesDataPoint[]>([]);
  const [, setLoading] = useState(false);

  const fetchMetrics = useCallback(async () => {
    if (!isConnected) return;

    setLoading(true);
    try {
      const [info, conns, js] = await Promise.all([fetchNatsInfo(), fetchNatsConnections(), fetchJetStreamInfo()]);

      setServerInfo(info as unknown as NatsServerInfo);
      setConnections(conns as unknown as NatsConnectionInfo);
      setJetStreamInfo(js as unknown as JetStreamInfo);

      setSubjectData(buildSubjectData(subjectTracker.getSubjects().slice(0, 10)));

      const inBytes = Number(info?.in_bytes) || 0;
      const outBytes = Number(info?.out_bytes) || 0;
      const newMetric: TimeSeriesDataPoint = {
        time: new Date().toLocaleTimeString(),
        messages: Number(info?.in_msgs) || 0,
        bytes: inBytes + outBytes,
        connections: Array.isArray(conns?.connections) ? conns.connections.length : 0,
        bytesIn: inBytes,
        bytesOut: outBytes,
        cpu: Math.round((Number(info?.cpu) || 0) * 100) / 100,
        memory: Number(info?.mem) || 0,
      };

      setTimeSeriesData(prev => [...prev.slice(-23), newMetric]);
    } catch (error) {
      console.error('Failed to fetch NATS metrics:', error);
    } finally {
      setLoading(false);
    }
  }, [isConnected]);

  useEffect(() => {
    if (!isConnected) return;
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 5000);
    return () => clearInterval(interval);
  }, [isConnected, fetchMetrics]);

  useEffect(() => {
    if (!isConnected) return;
    const unsubscribe = subjectTracker.subscribe(() => {
      setSubjectData(buildSubjectData(subjectTracker.getSubjects().slice(0, 10)));
    });
    return unsubscribe;
  }, [isConnected]);

  if (!isConnected) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-3xl font-bold">Monitoring</h1>
          <p className="text-muted-foreground">Connect to NATS server to view real-time metrics</p>
        </div>
        <div className="flex flex-col items-center justify-center py-12">
          <div className="max-w-md" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Monitoring</h1>
          <p className="text-muted-foreground">Real-time NATS server metrics and performance data</p>
        </div>
        <Badge variant="default" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">
          <div className="mr-1 h-2 w-2 rounded-full bg-green-500 animate-pulse" />
          Live Data
        </Badge>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Messages Processed"
          value={serverInfo?.in_msgs?.toLocaleString() || '0'}
          description="Total messages processed"
          icon={<MessageSquare className="h-4 w-4 text-muted-foreground" />}
        />
        <MetricCard
          title="Active Connections"
          value={connections?.connections?.length || 0}
          description="Connected clients"
          icon={<Users className="h-4 w-4 text-muted-foreground" />}
        />
        <MetricCard
          title="Data In"
          value={serverInfo ? formatBytes(serverInfo.in_bytes || 0) : '0 B'}
          description="Total data received"
          icon={<Activity className="h-4 w-4 text-muted-foreground" />}
        />
        <MetricCard
          title="Uptime"
          value={serverInfo?.uptime ? formatUptime(serverInfo.uptime) : '0s'}
          description="Server availability"
          icon={<Clock className="h-4 w-4 text-muted-foreground" />}
        />
      </div>

      <Tabs
        defaultValue={localStorage.getItem('nats-ui-monitoring-tab') || 'performance'}
        onValueChange={(v) => localStorage.setItem('nats-ui-monitoring-tab', v)}
        className="space-y-4"
      >
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="connections">Connections</TabsTrigger>
          <TabsTrigger value="subjects">Subjects</TabsTrigger>
          <TabsTrigger value="system">System</TabsTrigger>
        </TabsList>

        <TabsContent value="performance" className="space-y-4">
          <PerformanceTab timeSeriesData={timeSeriesData} colors={colors} />
        </TabsContent>

        <TabsContent value="connections" className="space-y-4">
          <ConnectionsTab
            timeSeriesData={timeSeriesData}
            connections={connections}
            serverInfo={serverInfo}
            colors={colors}
          />
        </TabsContent>

        <TabsContent value="subjects" className="space-y-4">
          <SubjectsTab subjectData={subjectData} colors={colors} />
        </TabsContent>

        <TabsContent value="system" className="space-y-4">
          <SystemTab
            serverInfo={serverInfo}
            jetStreamInfo={jetStreamInfo}
            timeSeriesData={timeSeriesData}
            colors={colors}
            isConnected={isConnected}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/** Connections tab - inline since it's small and uses many shared imports */
function ConnectionsTab({ timeSeriesData, connections, serverInfo, colors }: {
  timeSeriesData: TimeSeriesDataPoint[];
  connections: NatsConnectionInfo | null;
  serverInfo: NatsServerInfo | null;
  colors: ReturnType<typeof useChartColors>;
}) {
  const hasData = timeSeriesData.length >= 2;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader className="pb-0">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Users className="h-4 w-4" />
            Connection Activity
          </CardTitle>
          <CardDescription className="text-xs">
            Connection count over time
          </CardDescription>
        </CardHeader>
        <CardContent>
          {hasData ? (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={timeSeriesData}>
                <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
                <XAxis dataKey="time" tick={{ fill: colors.text, fontSize: 12 }} />
                <YAxis tick={{ fill: colors.text, fontSize: 12 }} />
                <Tooltip contentStyle={{ backgroundColor: colors.tooltip.bg, borderColor: colors.tooltip.border, borderRadius: 8 }} />
                <Line type="monotone" dataKey="connections" stroke={colors.connections} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[220px] text-sm text-muted-foreground">
              Collecting data...
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-0">
          <CardTitle className="text-sm">Connection Details</CardTitle>
          <CardDescription className="text-xs">
            Current connection information
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {connections?.connections ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Total Connections</span>
                <Badge variant="default">{connections.connections.length}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Total Subscriptions</span>
                <span className="text-sm">{serverInfo?.subscriptions ?? 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Slow Consumers</span>
                <span className="text-sm">{serverInfo?.slow_consumers ?? 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Max Connections</span>
                <span className="text-sm">{serverInfo?.max_connections ?? 'Unlimited'}</span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No connection data available</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/** Subjects tab - inline since it's small */
function SubjectsTab({ subjectData, colors }: {
  subjectData: SubjectData[];
  colors: ReturnType<typeof useChartColors>;
}) {
  return (
    <Card>
      <CardHeader className="pb-0">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Database className="h-4 w-4" />
          Subject Activity
        </CardTitle>
        <CardDescription className="text-xs">
          Message distribution across subjects
        </CardDescription>
      </CardHeader>
      <CardContent>
        {subjectData.length > 0 ? (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={subjectData}>
              <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
              <XAxis dataKey="name" tick={{ fill: colors.text, fontSize: 12 }} />
              <YAxis tick={{ fill: colors.text, fontSize: 12 }} />
              <Tooltip contentStyle={{ backgroundColor: colors.tooltip.bg, borderColor: colors.tooltip.border, borderRadius: 8 }} />
              <Bar dataKey="messages" fill={colors.bar} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-[280px] text-sm text-muted-foreground">
            No subject activity yet
          </div>
        )}
      </CardContent>
    </Card>
  );
}
