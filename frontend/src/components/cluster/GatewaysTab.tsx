import { Globe, Server } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { EmptyState } from './EmptyState';

export interface GatewayConnection {
  name: string;
  connection?: { ip?: string; port?: number; in_msgs?: number; out_msgs?: number };
}

interface GatewaysTabProps {
  outbound: GatewayConnection[];
  inbound: GatewayConnection[];
}

function GatewayList({ items, direction }: { items: GatewayConnection[]; direction: 'outbound' | 'inbound' }) {
  const emptyMsg = direction === 'outbound'
    ? 'No outbound gateways configured. Gateways connect separate NATS clusters.'
    : 'No inbound gateways connected.';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <Globe className="h-4 w-4" /> {direction === 'outbound' ? 'Outbound' : 'Inbound'} Gateways ({items.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <EmptyState icon={Globe} message={emptyMsg} />
        ) : (
          <div className="space-y-2">
            {items.map((gw) => (
              <div key={gw.name} className="flex items-center justify-between p-3 rounded-md border">
                <div className="flex items-center gap-2">
                  <Server className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium text-sm">{gw.name}</span>
                </div>
                <Badge variant={direction === 'outbound' ? 'secondary' : 'outline'}>{direction}</Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function GatewaysTab({ outbound, inbound }: GatewaysTabProps) {
  return (
    <div className="space-y-4">
      <GatewayList items={outbound} direction="outbound" />
      <GatewayList items={inbound} direction="inbound" />
    </div>
  );
}
