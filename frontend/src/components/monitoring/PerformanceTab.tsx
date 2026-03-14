import { Activity, MessageSquare } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import type { ChartColors } from './useChartColors';
import type { TimeSeriesDataPoint } from '../../types/monitoring';

interface PerformanceTabProps {
  timeSeriesData: TimeSeriesDataPoint[];
  colors: ChartColors;
}

export function PerformanceTab({ timeSeriesData, colors }: PerformanceTabProps) {
  const hasData = timeSeriesData.length >= 2;

  return (
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
          {hasData ? (
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
          {hasData ? (
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
  );
}
