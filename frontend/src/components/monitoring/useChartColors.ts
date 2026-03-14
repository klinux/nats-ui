import { useMemo } from 'react';
import { useTheme } from 'next-themes';

export interface ChartColors {
  grid: string;
  text: string;
  messages: string;
  bytesIn: string;
  bytesOut: string;
  connections: string;
  cpu: string;
  memory: string;
  bar: string;
  tooltip: { bg: string; border: string };
}

export function useChartColors(): ChartColors {
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
