import { Network } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { formatBytes } from '../../lib/format';
import { EmptyState } from './EmptyState';

export interface RouteInfo {
  rid: number;
  remote_id: string;
  ip: string;
  port: number;
  in_msgs: number;
  out_msgs: number;
  in_bytes: number;
  out_bytes: number;
  subscriptions: number;
}

interface RoutesTabProps {
  routes: RouteInfo[];
}

export function RoutesTab({ routes }: RoutesTabProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <Network className="h-4 w-4" /> Cluster Routes ({routes.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {routes.length === 0 ? (
          <EmptyState icon={Network} message="No cluster routes configured. This server is running in standalone mode." />
        ) : (
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Route ID</TableHead>
                  <TableHead>Remote ID</TableHead>
                  <TableHead>IP</TableHead>
                  <TableHead>Port</TableHead>
                  <TableHead>In Msgs</TableHead>
                  <TableHead>Out Msgs</TableHead>
                  <TableHead>In Bytes</TableHead>
                  <TableHead>Out Bytes</TableHead>
                  <TableHead>Subs</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {routes.map((r) => (
                  <TableRow key={r.rid}>
                    <TableCell className="font-mono text-xs">{r.rid}</TableCell>
                    <TableCell className="font-mono text-xs">{r.remote_id}</TableCell>
                    <TableCell>{r.ip}</TableCell>
                    <TableCell>{r.port}</TableCell>
                    <TableCell>{r.in_msgs?.toLocaleString()}</TableCell>
                    <TableCell>{r.out_msgs?.toLocaleString()}</TableCell>
                    <TableCell>{formatBytes(r.in_bytes || 0)}</TableCell>
                    <TableCell>{formatBytes(r.out_bytes || 0)}</TableCell>
                    <TableCell>{r.subscriptions?.toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
