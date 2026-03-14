import { Activity, Database } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { MetricCard } from './MetricCards';
import type { ChartColors } from './useChartColors';
import type { NatsServerInfo, JetStreamInfo, TimeSeriesDataPoint } from '../../types/monitoring';
import { formatBytes } from '../../lib/format';

interface SystemTabProps {
  serverInfo: NatsServerInfo | null;
  jetStreamInfo: JetStreamInfo | null;
  timeSeriesData: TimeSeriesDataPoint[];
  colors: ChartColors;
  isConnected: boolean;
}

export function SystemTab({ serverInfo, jetStreamInfo, timeSeriesData, colors, isConnected }: SystemTabProps) {
  const hasData = timeSeriesData.length >= 2;

  return (
    <div className="space-y-4">
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
            {hasData ? (
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
            {hasData ? (
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
    </div>
  );
}
