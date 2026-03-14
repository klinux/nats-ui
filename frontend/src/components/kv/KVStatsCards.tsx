import { Database, Key, Calendar, Edit3 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import type { KVEntry } from './types';

interface KVStatsCardsProps {
  entries: KVEntry[];
  buckets: string[];
}

export function KVStatsCards({ entries, buckets }: KVStatsCardsProps) {
  const lastUpdated = entries.length > 0
    ? new Date(Math.max(...entries.map(e => e.updated.getTime()))).toLocaleDateString()
    : 'Never';
  const totalRevisions = entries.reduce((sum, entry) => sum + entry.revision, 0);

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6 flex-shrink-0">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Keys</CardTitle>
          <Key className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{entries.length}</div>
          <p className="text-xs text-muted-foreground">Across {buckets.length} buckets</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Buckets</CardTitle>
          <Database className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{buckets.length}</div>
          <p className="text-xs text-muted-foreground">Active storage buckets</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Last Updated</CardTitle>
          <Calendar className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{lastUpdated}</div>
          <p className="text-xs text-muted-foreground">Most recent update</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Revisions</CardTitle>
          <Edit3 className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{totalRevisions}</div>
          <p className="text-xs text-muted-foreground">Cumulative revisions</p>
        </CardContent>
      </Card>
    </div>
  );
}
