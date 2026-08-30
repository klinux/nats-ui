import { TrendingUp } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';

export interface MetricCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon: React.ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
  };
}

/**
 * Compact secondary readout.
 *
 * Deliberately quiet: these sit beside the throughput hero, which is the number
 * worth looking at. The spring-animated count, hover lift and icon wobble were
 * removed — motion on a card that repolls every five seconds reads as noise,
 * and the project's own guidance keeps framer-motion off high-frequency
 * components.
 */
export function MetricCard({ title, value, description, icon, trend }: MetricCardProps) {
  return (
    <Card className="transition-colors hover:border-primary/40">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold tabular">
          {typeof value === 'number' ? value.toLocaleString() : value}
        </div>
        {description && (
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        )}
        {trend && (
          <div className="mt-1 flex items-center">
            <TrendingUp className={`h-4 w-4 ${trend.isPositive ? 'text-state-ok' : 'text-state-crit'}`} />
            <span className={`ml-1 text-xs ${trend.isPositive ? 'text-state-ok' : 'text-state-crit'}`}>
              {trend.isPositive ? '+' : ''}{trend.value}%
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
