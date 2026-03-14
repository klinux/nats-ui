import { Database, Server } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { formatBytes } from '../../lib/format';

interface ServerInfoProps {
  serverInfo: Record<string, unknown> | null;
  jetStreamInfo: Record<string, unknown> | null;
}

export function ServerInfo({ serverInfo, jetStreamInfo }: ServerInfoProps) {
  return (
    <>
      {/* Server Information */}
      {serverInfo && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Server className="h-5 w-5" />
              Server Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <div>
                <p className="text-sm text-muted-foreground">Server ID</p>
                <p className="font-mono text-sm truncate" title={String(serverInfo.server_id || '')}>
                  {String(serverInfo.server_id || 'Unknown')}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Version</p>
                <p className="font-mono text-sm">{String(serverInfo.version || 'Unknown')}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Go Version</p>
                <p className="font-mono text-sm">{String(serverInfo.go || 'Unknown')}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">JetStream</p>
                <Badge variant={serverInfo.jetstream !== undefined ? 'default' : 'secondary'}>
                  {serverInfo.jetstream !== undefined ? 'Enabled' : 'Disabled'}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* JetStream Information */}
      {jetStreamInfo && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              JetStream
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <p className="text-sm text-muted-foreground">Memory Usage</p>
                <p className="text-lg font-semibold">{formatBytes(typeof jetStreamInfo.memory === 'number' ? jetStreamInfo.memory : 0)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Storage Usage</p>
                <p className="text-lg font-semibold">{formatBytes(typeof jetStreamInfo.storage === 'number' ? jetStreamInfo.storage : 0)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">API Requests</p>
                <p className="text-lg font-semibold">{(() => {
                  if (jetStreamInfo.api && typeof jetStreamInfo.api === 'object' && jetStreamInfo.api !== null) {
                    const apiObj = jetStreamInfo.api as Record<string, unknown>;
                    return typeof apiObj.total === 'number' ? apiObj.total : 0;
                  }
                  return 0;
                })()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}
