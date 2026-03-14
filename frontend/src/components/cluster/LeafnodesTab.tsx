import { Leaf } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { formatBytes } from '../../lib/format';
import { EmptyState } from './EmptyState';

export interface LeafConnection {
  name: string;
  ip: string;
  port: number;
  account: string;
  in_msgs: number;
  out_msgs: number;
  in_bytes: number;
  out_bytes: number;
  subscriptions: number;
}

interface LeafnodesTabProps {
  leafs: LeafConnection[];
}

export function LeafnodesTab({ leafs }: LeafnodesTabProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <Leaf className="h-4 w-4" /> Leaf Connections ({leafs.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {leafs.length === 0 ? (
          <EmptyState icon={Leaf} message="No leaf node connections. Leaf nodes extend a NATS cluster without full mesh routing." />
        ) : (
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>IP</TableHead>
                  <TableHead>Port</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead>In Msgs</TableHead>
                  <TableHead>Out Msgs</TableHead>
                  <TableHead>In Bytes</TableHead>
                  <TableHead>Out Bytes</TableHead>
                  <TableHead>Subs</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leafs.map((l, i) => (
                  <TableRow key={`${l.ip}-${l.port}-${i}`}>
                    <TableCell className="font-medium text-sm">{l.name || '-'}</TableCell>
                    <TableCell>{l.ip}</TableCell>
                    <TableCell>{l.port}</TableCell>
                    <TableCell className="font-mono text-xs">{l.account || '-'}</TableCell>
                    <TableCell>{l.in_msgs?.toLocaleString()}</TableCell>
                    <TableCell>{l.out_msgs?.toLocaleString()}</TableCell>
                    <TableCell>{formatBytes(l.in_bytes || 0)}</TableCell>
                    <TableCell>{formatBytes(l.out_bytes || 0)}</TableCell>
                    <TableCell>{l.subscriptions?.toLocaleString()}</TableCell>
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
