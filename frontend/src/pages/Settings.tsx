import { useState, useEffect } from 'react';
import {
  Server,
  Shield,
  Wifi,
  WifiOff,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { useNats } from '../hooks/useNats';
import { getOAuth2Providers, getMe } from '../services/api-client';

interface OAuth2Provider {
  name: string;
  clientId: string;
}

export function Settings() {
  const { status, error } = useNats();
  const [providers, setProviders] = useState<OAuth2Provider[]>([]);
  const [currentUser, setCurrentUser] = useState<string | null>(null);

  useEffect(() => {
    getOAuth2Providers()
      .then(setProviders)
      .catch(() => setProviders([]));
    getMe()
      .then((me) => setCurrentUser(me.username))
      .catch(() => setCurrentUser(null));
  }, []);

  return (
    <div className="space-y-6 p-4">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">
          Backend connection status and authentication configuration
        </p>
      </div>

      {/* Current User */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Current Session
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <span className="text-sm font-medium">Logged in as</span>
            <Badge variant="outline">{currentUser || '...'}</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Backend Connection Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            Backend Connection
          </CardTitle>
          <CardDescription>
            Status of the Go backend connection to NATS server
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-3">
              {status === 'connected' ? (
                <Wifi className="h-4 w-4 text-green-600" />
              ) : status === 'connecting' ? (
                <div className="animate-spin h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full" />
              ) : status === 'error' ? (
                <AlertCircle className="h-4 w-4 text-red-600" />
              ) : (
                <WifiOff className="h-4 w-4 text-gray-400" />
              )}
              <span className="text-sm font-medium">NATS Connection</span>
            </div>
            <Badge
              variant={status === 'connected' ? 'default' : status === 'error' ? 'destructive' : 'secondary'}
              className={status === 'connected' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' : ''}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </Badge>
          </div>

          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <AlertCircle className="h-4 w-4 text-red-600" />
                <span className="text-sm font-medium text-red-800 dark:text-red-200">Connection Error</span>
              </div>
              <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
            </div>
          )}

          <div className="pt-2 border-t">
            <p className="text-xs text-muted-foreground">
              The backend connects to NATS via TCP. All operations are proxied through the Go API server.
              Connection settings (NATS URL, credentials) are configured via environment variables on the backend.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* OAuth2 Providers */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            OAuth2 Providers
          </CardTitle>
          <CardDescription>
            External authentication providers configured on the backend
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {providers.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground text-sm">
              No OAuth2 providers configured. Set <code className="bg-muted px-1 rounded">GOOGLE_CLIENT_ID</code> / <code className="bg-muted px-1 rounded">GITHUB_CLIENT_ID</code> environment variables on the backend to enable them.
            </div>
          ) : (
            <div className="grid gap-3">
              {providers.map((provider) => (
                <div key={provider.name} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    {provider.name === 'google' ? (
                      <svg className="h-5 w-5" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                      </svg>
                    ) : provider.name === 'github' ? (
                      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                      </svg>
                    ) : (
                      <ExternalLink className="h-5 w-5" />
                    )}
                    <div>
                      <span className="text-sm font-medium capitalize">{provider.name}</span>
                      <p className="text-xs text-muted-foreground">Client ID: {provider.clientId.substring(0, 20)}...</p>
                    </div>
                  </div>
                  <Badge variant="default" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">
                    Enabled
                  </Badge>
                </div>
              ))}
            </div>
          )}

          <div className="pt-2 border-t">
            <h4 className="text-sm font-semibold mb-2">Configuration Reference</h4>
            <div className="grid gap-2 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Google OAuth2:</span>
                <code className="bg-muted px-1 rounded">GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET</code>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">GitHub OAuth2:</span>
                <code className="bg-muted px-1 rounded">GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET</code>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Allowed Users:</span>
                <code className="bg-muted px-1 rounded">ALLOWED_OAUTH2_USERS</code>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
