import { AlertCircle, Server } from 'lucide-react';

import { ConnectionStatus } from '../connection/ConnectionManager';

interface DisconnectedViewProps {
  status: string;
  error: string | null;
}

export function DisconnectedView({ status, error }: DisconnectedViewProps) {
  return (
    <div className="h-full flex items-center justify-center">
      <div className="text-center space-y-6 max-w-2xl mx-auto px-4">
        {status === 'error' ? (
          <AlertCircle className="h-16 w-16 mx-auto text-destructive" />
        ) : (
          <Server className="h-16 w-16 mx-auto text-muted-foreground" />
        )}

        <div>
          <h2 className="text-2xl font-semibold mb-3">
            {status === 'error' ? 'Connection Failed' : 'Not Connected'}
          </h2>

          {status === 'error' && error ? (
            <div className="space-y-4">
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 text-left">
                <p className="text-sm text-destructive/80 font-mono break-words">{error}</p>
              </div>

              <TroubleshootingHints />
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-muted-foreground">
                Connect to a NATS server to view the dashboard
              </p>
              <TroubleshootingHints />
            </div>
          )}
        </div>

        <div className="w-full max-w-sm mx-auto">
          <ConnectionStatus />
        </div>

        {status === 'error' && (
          <div className="text-xs text-muted-foreground">
            You can update the connection settings in the Settings page
          </div>
        )}
      </div>
    </div>
  );
}

function TroubleshootingHints() {
  return (
    <div className="text-sm text-muted-foreground space-y-2">
      <p>Common issues and solutions:</p>
      <ul className="text-left space-y-1 max-w-md mx-auto">
        <li>• Check if NATS server is running</li>
        <li>• Verify WebSocket support is enabled on the server</li>
        <li>• Ensure the server port is accessible and not blocked by firewall</li>
        <li>• Check if the server URL and port are correct in settings</li>
      </ul>
    </div>
  );
}
