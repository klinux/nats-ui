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
  status?: 'normal' | 'warning' | 'error';
}

export function MetricCard({ title, value, description, icon, trend, status = 'normal' }: MetricCardProps) {
  const getStatusColor = () => {
    switch (status) {
      case 'warning':
        return 'border-state-warn/40 bg-state-warn-soft';
      case 'error':
        return 'border-state-crit/40 bg-state-crit-soft';
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
                trend.isPositive ? 'text-state-ok' : 'text-destructive'
              }`}
            />
            <span
              className={`text-xs ${
                trend.isPositive ? 'text-state-ok' : 'text-destructive'
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
