import { useState, useEffect, useCallback } from 'react';
import { Network, Globe, Leaf } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { useNats } from '../hooks/useNats';
import { fetchRoutes, fetchGateways, fetchLeafnodes, fetchAccounts } from '../services/api-client';
import { toast } from 'sonner';

import { RoutesTab, type RouteInfo } from '../components/cluster/RoutesTab';
import { GatewaysTab, type GatewayConnection } from '../components/cluster/GatewaysTab';
import { LeafnodesTab, type LeafConnection } from '../components/cluster/LeafnodesTab';
import { AccountsTab } from '../components/cluster/AccountsTab';

const TAB_KEY = 'nats-ui-cluster-tab';

export function Cluster() {
  const { isConnected } = useNats();
  const [routes, setRoutes] = useState<{ num_routes: number; routes: RouteInfo[] }>({ num_routes: 0, routes: [] });
  const [gateways, setGateways] = useState<{ outbound: GatewayConnection[]; inbound: GatewayConnection[] }>({ outbound: [], inbound: [] });
  const [leafnodes, setLeafnodes] = useState<{ count: number; leafs: LeafConnection[] }>({ count: 0, leafs: [] });
  const [accounts, setAccounts] = useState<string[]>([]);

  const loadData = useCallback(async () => {
    if (!isConnected) return;
    try {
      const [routeData, gwData, leafData, acctData] = await Promise.all([
        fetchRoutes(), fetchGateways(), fetchLeafnodes(), fetchAccounts(),
      ]);

      const r = routeData as Record<string, unknown>;
      setRoutes({
        num_routes: (r.num_routes as number) || 0,
        routes: (r.routes as RouteInfo[]) || [],
      });

      const g = gwData as Record<string, unknown>;
      const outGw = g.outbound_gateways as Record<string, unknown> || {};
      const inGw = g.inbound_gateways as Record<string, unknown> || {};
      setGateways({
        outbound: Object.entries(outGw).map(([name, val]) => ({
          name,
          connection: val as GatewayConnection['connection'],
        })),
        inbound: Object.entries(inGw).map(([name, val]) => ({
          name,
          connection: val as GatewayConnection['connection'],
        })),
      });

      const l = leafData as Record<string, unknown>;
      setLeafnodes({
        count: (l.leafnodes as number) || 0,
        leafs: (l.leafs as LeafConnection[]) || [],
      });

      const a = acctData as Record<string, unknown>;
      setAccounts((a.accounts as string[]) || []);
    } catch (err) {
      console.error('Failed to fetch cluster data:', err);
      toast.error('Failed to fetch cluster data');
    }
  }, [isConnected]);

  useEffect(() => {
    loadData();
    if (!isConnected) return;
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, [isConnected, loadData]);

  if (!isConnected) {
    return (
      <div className="space-y-4 p-4">
        <div>
          <h1 className="text-3xl font-bold">Cluster</h1>
          <p className="text-muted-foreground">Connect to NATS server to view cluster topology</p>
        </div>
      </div>
    );
  }

  const totalGateways = gateways.outbound.length + gateways.inbound.length;

  return (
    <div className="space-y-4 p-4">
      <div>
        <h1 className="text-3xl font-bold">Cluster</h1>
        <p className="text-muted-foreground">NATS cluster topology and status</p>
      </div>

      {/* Overview cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="gap-2 py-3">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 px-4 pb-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">Routes</CardTitle>
            <Network className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="px-4">
            <div className="text-xl font-bold">{routes.num_routes}</div>
          </CardContent>
        </Card>
        <Card className="gap-2 py-3">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 px-4 pb-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">Gateways</CardTitle>
            <Globe className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="px-4">
            <div className="text-xl font-bold">{totalGateways}</div>
          </CardContent>
        </Card>
        <Card className="gap-2 py-3">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 px-4 pb-0">
            <CardTitle className="text-xs font-medium text-muted-foreground">Leaf Nodes</CardTitle>
            <Leaf className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="px-4">
            <div className="text-xl font-bold">{leafnodes.count}</div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs
        defaultValue={localStorage.getItem(TAB_KEY) || 'routes'}
        onValueChange={(v) => localStorage.setItem(TAB_KEY, v)}
        className="space-y-4"
      >
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="routes"><Network className="h-3.5 w-3.5 mr-1.5" />Routes</TabsTrigger>
          <TabsTrigger value="gateways"><Globe className="h-3.5 w-3.5 mr-1.5" />Gateways</TabsTrigger>
          <TabsTrigger value="leafnodes"><Leaf className="h-3.5 w-3.5 mr-1.5" />Leaf Nodes</TabsTrigger>
          <TabsTrigger value="accounts">Accounts</TabsTrigger>
        </TabsList>

        <TabsContent value="routes">
          <RoutesTab routes={routes.routes} />
        </TabsContent>
        <TabsContent value="gateways">
          <GatewaysTab outbound={gateways.outbound} inbound={gateways.inbound} />
        </TabsContent>
        <TabsContent value="leafnodes">
          <LeafnodesTab leafs={leafnodes.leafs} />
        </TabsContent>
        <TabsContent value="accounts">
          <AccountsTab accounts={accounts} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
