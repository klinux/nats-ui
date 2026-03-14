import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Activity,
  TrendingUp,
  Users,
  MessageSquare,
  Database,
  Clock,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { useNats } from '../hooks/useNats';
import { fetchNatsInfo, fetchNatsConnections, fetchJetStreamInfo } from '../services/nats-service';
import { subjectTracker } from '../services/subject-tracker';
import type { NatsServerInfo, NatsConnectionInfo, JetStreamInfo, SubjectData, TimeSeriesDataPoint } from '../types/monitoring';
import { formatBytes, formatUptime } from '../lib/format';


interface MetricCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon: React.ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  status?: 'normal' | 'warning' | 'error';
}

function MetricCard({ title, value, description, icon, trend, status = 'normal' }: MetricCardProps) {
  const getStatusColor = () => {
    switch (status) {
      case 'warning':
        return 'border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950';
      case 'error':
        return 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950';
      default:
        return '';
    }
  };

  return (
    <Card className={`gap-2 py-3 ${getStatusColor()}`}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 px-4 pb-0">
        <CardTitle className="text-xs font-medium text-muted-foreground">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent className="px-4">
        <div className="text-xl font-bold">{value}</div>
        {description && (
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        )}
        {trend && (
          <div className="flex items-center mt-1">
            <TrendingUp
              className={`mr-1 h-3 w-3 ${
                trend.isPositive ? 'text-green-600' : 'text-red-600'
              }`}
            />
            <span
              className={`text-xs ${
                trend.isPositive ? 'text-green-600' : 'text-red-600'
              }`}
            >
              {trend.isPositive ? '+' : ''}{trend.value}%
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Chart colors that work in both light and dark mode
function useChartColors() {
  const { resolvedTheme } = useTheme();
  return useMemo(() => {
    const dark = resolvedTheme === 'dark';
    return {
      grid: dark ? '#333' : '#e5e7eb',
      text: dark ? '#a1a1aa' : '#6b7280',
      messages: dark ? '#a78bfa' : '#8884d8',
      bytesIn: dark ? '#6ee7b7' : '#82ca9d',
      bytesOut: dark ? '#93c5fd' : '#8884d8',
      connections: dark ? '#fcd34d' : '#ffc658',
      cpu: dark ? '#fca5a5' : '#ff7c7c',
      memory: dark ? '#67e8f9' : '#8dd1e1',
      bar: dark ? '#a78bfa' : '#8884d8',
      tooltip: { bg: dark ? '#1f2937' : '#fff', border: dark ? '#374151' : '#e5e7eb' },
    };
  }, [resolvedTheme]);
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

  // Fetch real NATS metrics
  const fetchMetrics = useCallback(async () => {
    if (!isConnected) return;
    
    setLoading(true);
    try {
      const [info, conns, js] = await Promise.all([
        fetchNatsInfo(),
        fetchNatsConnections(),
        fetchJetStreamInfo()
      ]);
      
      setServerInfo(info as unknown as NatsServerInfo);
      setConnections(conns as unknown as NatsConnectionInfo);
      setJetStreamInfo(js as unknown as JetStreamInfo);
      
      // Update subject data from tracker
      const subjects = subjectTracker.getSubjects().slice(0, 10);
      const colors = ['#8884d8', '#82ca9d', '#ffc658', '#ff7c7c', '#8dd1e1', '#d084d8', '#ffb347', '#87ceeb', '#98fb98', '#dda0dd'];
      setSubjectData(subjects.map((subject, index) => ({
        subject: subject.subject || 'Unknown',
        messageCount: Number(subject.messageCount || 0),
        lastMessage: subject.lastMessage || '',
        name: subject.subject && subject.subject.length > 15 ? subject.subject.substring(0, 15) + '...' : subject.subject || 'Unknown',
        messages: Number(subject.messageCount || 0),
        color: colors[index % colors.length]
      })));
      
      // Add to metrics history for time series
      const now = new Date();
      const inBytes = Number(info?.in_bytes) || 0;
      const outBytes = Number(info?.out_bytes) || 0;
      const inMsgs = Number(info?.in_msgs) || 0;
      const connCount = Array.isArray(conns?.connections) ? conns.connections.length : 0;
      const cpuPercent = Number(info?.cpu) || 0;
      const memBytes = Number(info?.mem) || 0;
      const newMetric: TimeSeriesDataPoint = {
        time: now.toLocaleTimeString(),
        messages: inMsgs,
        bytes: inBytes + outBytes,
        connections: connCount,
        bytesIn: inBytes,
        bytesOut: outBytes,
        cpu: Math.round(cpuPercent * 100) / 100,
        memory: memBytes,
      };
      
      setTimeSeriesData(prev => {
        const updated = [...prev.slice(-23), newMetric]; // Keep last 24 data points
        return updated;
      });
      
    } catch (error) {
      console.error('Failed to fetch NATS metrics:', error);
    } finally {
      setLoading(false);
    }
  }, [isConnected]);

  useEffect(() => {
    if (!isConnected) return;
    
    fetchMetrics();
    
    // Refresh metrics every 5 seconds when connected
    const interval = setInterval(() => {
      fetchMetrics();
    }, 5000);
    return () => clearInterval(interval);
  }, [isConnected, fetchMetrics]);

  // Listen to subject tracker updates
  useEffect(() => {
    if (isConnected) {
      const unsubscribe = subjectTracker.subscribe(() => {
        // Update subject data when new subjects are tracked
        const subjects = subjectTracker.getSubjects().slice(0, 10);
        const colors = ['#8884d8', '#82ca9d', '#ffc658', '#ff7c7c', '#8dd1e1', '#d084d8', '#ffb347', '#87ceeb', '#98fb98', '#dda0dd'];
        setSubjectData(subjects.map((subject, index) => ({
          subject: subject.subject || 'Unknown',
          messageCount: Number(subject.messageCount || 0),
          lastMessage: subject.lastMessage || '',
          name: subject.subject && subject.subject.length > 15 ? subject.subject.substring(0, 15) + '...' : subject.subject || 'Unknown',
          messages: Number(subject.messageCount || 0),
          color: colors[index % colors.length]
        })));
      });
      
      return unsubscribe;
    }
  }, [isConnected]);

  if (!isConnected) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Monitoring</h1>
            <p className="text-muted-foreground">
              Connect to NATS server to view real-time metrics
            </p>
          </div>
        </div>

        <div className="flex flex-col items-center justify-center py-12">
          <div className="max-w-md">
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Monitoring</h1>
          <p className="text-muted-foreground">
            Real-time NATS server metrics and performance data
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="default" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">
            <div className="mr-1 h-2 w-2 rounded-full bg-green-500 animate-pulse" />
            Live Data
          </Badge>
        </div>
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
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-0">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <MessageSquare className="h-4 w-4" />
                  Message Throughput
                </CardTitle>
                <CardDescription className="text-xs">
                  Messages processed over time
                </CardDescription>
              </CardHeader>
              <CardContent>
                {timeSeriesData.length >= 2 ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={timeSeriesData}>
                      <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
                      <XAxis dataKey="time" tick={{ fill: colors.text, fontSize: 12 }} />
                      <YAxis tick={{ fill: colors.text, fontSize: 12 }} />
                      <Tooltip contentStyle={{ backgroundColor: colors.tooltip.bg, borderColor: colors.tooltip.border, borderRadius: 8 }} />
                      <Line
                        type="monotone"
                        dataKey="messages"
                        stroke={colors.messages}
                        strokeWidth={2}
                        dot={false}
                      />
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
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Activity className="h-4 w-4" />
                  Data Transfer
                </CardTitle>
                <CardDescription className="text-xs">
                  Bytes in/out over time
                </CardDescription>
              </CardHeader>
              <CardContent>
                {timeSeriesData.length >= 2 ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={timeSeriesData}>
                      <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
                      <XAxis dataKey="time" tick={{ fill: colors.text, fontSize: 12 }} />
                      <YAxis tick={{ fill: colors.text, fontSize: 12 }} />
                      <Tooltip contentStyle={{ backgroundColor: colors.tooltip.bg, borderColor: colors.tooltip.border, borderRadius: 8 }} />
                      <Line
                        type="monotone"
                        dataKey="bytesIn"
                        stroke={colors.bytesIn}
                        strokeWidth={2}
                        name="Bytes In"
                        dot={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="bytesOut"
                        stroke={colors.bytesOut}
                        strokeWidth={2}
                        name="Bytes Out"
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[220px] text-sm text-muted-foreground">
                    Collecting data...
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="connections" className="space-y-4">
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
                {timeSeriesData.length >= 2 ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={timeSeriesData}>
                      <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
                      <XAxis dataKey="time" tick={{ fill: colors.text, fontSize: 12 }} />
                      <YAxis tick={{ fill: colors.text, fontSize: 12 }} />
                      <Tooltip contentStyle={{ backgroundColor: colors.tooltip.bg, borderColor: colors.tooltip.border, borderRadius: 8 }} />
                      <Line
                        type="monotone"
                        dataKey="connections"
                        stroke={colors.connections}
                        strokeWidth={2}
                        dot={false}
                      />
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
                      <Badge variant="default">
                        {connections.connections.length}
                      </Badge>
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
        </TabsContent>

        <TabsContent value="subjects" className="space-y-4">
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
        </TabsContent>

        <TabsContent value="system" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <MetricCard
              title="Data Out"
              value={serverInfo ? formatBytes(serverInfo.out_bytes || 0) : '0 B'}
              description="Total data sent"
              icon={<Activity className="h-4 w-4 text-muted-foreground" />}
            />
            <MetricCard
              title="JetStream Memory"
              value={jetStreamInfo ? formatBytes(jetStreamInfo.memory || 0) : '0 B'}
              description="JetStream memory usage"
              icon={<Database className="h-4 w-4 text-muted-foreground" />}
            />
            <MetricCard
              title="JetStream Storage"
              value={jetStreamInfo ? formatBytes(jetStreamInfo.storage || 0) : '0 B'}
              description="JetStream storage usage"
              icon={<Database className="h-4 w-4 text-muted-foreground" />}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-0">
                <CardTitle className="text-sm">CPU Usage</CardTitle>
                <CardDescription className="text-xs">
                  NATS server CPU usage over time
                </CardDescription>
              </CardHeader>
              <CardContent>
                {timeSeriesData.length >= 2 ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={timeSeriesData}>
                      <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
                      <XAxis dataKey="time" tick={{ fill: colors.text, fontSize: 12 }} />
                      <YAxis unit="%" tick={{ fill: colors.text, fontSize: 12 }} />
                      <Tooltip formatter={(value: number) => [`${value}%`, 'CPU']} contentStyle={{ backgroundColor: colors.tooltip.bg, borderColor: colors.tooltip.border, borderRadius: 8 }} />
                      <Line
                        type="monotone"
                        dataKey="cpu"
                        stroke={colors.cpu}
                        strokeWidth={2}
                        name="CPU %"
                        dot={false}
                      />
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
                <CardTitle className="text-sm">Memory Usage</CardTitle>
                <CardDescription className="text-xs">
                  NATS server memory usage over time
                </CardDescription>
              </CardHeader>
              <CardContent>
                {timeSeriesData.length >= 2 ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={timeSeriesData}>
                      <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
                      <XAxis dataKey="time" tick={{ fill: colors.text, fontSize: 12 }} />
                      <YAxis tickFormatter={(v: number) => formatBytes(v)} tick={{ fill: colors.text, fontSize: 12 }} />
                      <Tooltip formatter={(value: number) => [formatBytes(value), 'Memory']} contentStyle={{ backgroundColor: colors.tooltip.bg, borderColor: colors.tooltip.border, borderRadius: 8 }} />
                      <Line
                        type="monotone"
                        dataKey="memory"
                        stroke={colors.memory}
                        strokeWidth={2}
                        name="Memory"
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[220px] text-sm text-muted-foreground">
                    Collecting data...
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-0">
              <CardTitle className="text-sm">System Health</CardTitle>
              <CardDescription className="text-xs">
                Overall system status indicators
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Server Status</span>
                  <Badge variant="default" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">
                    {isConnected ? 'Healthy' : 'Disconnected'}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">JetStream</span>
                  <Badge variant={serverInfo?.jetstream !== undefined ? 'default' : 'secondary'}
                         className={serverInfo?.jetstream !== undefined ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' : ''}>
                    {serverInfo?.jetstream !== undefined ? 'Enabled' : 'Disabled'}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Version</span>
                  <span className="text-sm">{serverInfo?.version || 'N/A'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Go</span>
                  <span className="text-sm">{serverInfo?.go || 'N/A'}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}