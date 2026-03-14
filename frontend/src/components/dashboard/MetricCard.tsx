import { useEffect } from 'react';
import { motion, useSpring, useTransform } from 'framer-motion';
import { TrendingUp } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { staggerItem, iconSpring, easings } from '../../lib/animations';

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

export function MetricCard({ title, value, description, icon, trend }: MetricCardProps) {
  const isNumeric = typeof value === 'number';
  const numericValue = isNumeric ? value : 0;
  const springValue = useSpring(numericValue, { stiffness: 100, damping: 30 });
  const display = useTransform(springValue, (latest) => Math.floor(latest).toLocaleString());

  useEffect(() => {
    if (isNumeric) {
      springValue.set(numericValue);
    }
  }, [numericValue, springValue, isNumeric]);

  return (
    <motion.div
      variants={staggerItem}
      initial="hidden"
      animate="visible"
      whileHover={{ y: -2, transition: { duration: 0.15, ease: easings.easeOut } }}
      style={{ cursor: 'default' }}
    >
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
          <motion.div
            whileHover={{ scale: 1.15, rotate: 5 }}
            transition={iconSpring}
          >
            {icon}
          </motion.div>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {isNumeric ? <motion.span>{display}</motion.span> : value}
          </div>
          {description && (
            <p className="text-xs text-muted-foreground mt-1">{description}</p>
          )}
          {trend && (
            <motion.div
              className="flex items-center mt-1"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
            >
              <TrendingUp className={`h-4 w-4 ${trend.isPositive ? 'text-green-500' : 'text-red-500'}`} />
              <span className={`text-xs ml-1 ${trend.isPositive ? 'text-green-500' : 'text-red-500'}`}>
                {trend.isPositive ? '+' : ''}{trend.value}%
              </span>
            </motion.div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
