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
