import { Outlet, useLocation } from 'react-router-dom';
import {
  Database,
  Home,
  MessageSquare,
  Network,
  Package,
  Settings,
  GitBranch,
  Users,
  Monitor,
} from 'lucide-react';

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from '../ui/breadcrumb';
import { Separator } from '../ui/separator';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from '../ui/sidebar';
import { Badge } from '../ui/badge';
import { NavMain, type NavItem } from './nav-main';
import { NavUser } from './nav-user';
import { useNats } from '../../hooks/useNats';

const navItems: NavItem[] = [
  { title: 'Dashboard', path: '/', icon: Home },
  { title: 'Messages', path: '/messages', icon: MessageSquare },
  { title: 'Streams', path: '/streams', icon: GitBranch },
  { title: 'Consumers', path: '/consumers', icon: Users },
  { title: 'KV Store', path: '/kv-store', icon: Database },
  { title: 'Object Store', path: '/object-store', icon: Package },
];

const systemItems: NavItem[] = [
  { title: 'Monitoring', path: '/monitoring', icon: Monitor },
  { title: 'Cluster', path: '/cluster', icon: Network },
  { title: 'Settings', path: '/settings', icon: Settings },
];

const getStatusColor = (status: string) => {
  switch (status) {
    case 'connected':
      return 'bg-green-500';
    case 'connecting':
      return 'bg-yellow-500';
    case 'error':
      return 'bg-red-500';
    default:
      return 'bg-gray-500';
  }
};

const getStatusText = (status: string) => {
  switch (status) {
    case 'connected':
      return 'Connected';
    case 'connecting':
      return 'Connecting...';
    case 'error':
      return 'Error';
    default:
      return 'Disconnected';
  }
};

const allItems = [...navItems, ...systemItems];

export function MainLayout() {
  const location = useLocation();
  const { status, username } = useNats();

  const currentPage =
    allItems.find((item) => item.path === location.pathname)?.title || 'NATS UI';

  return (
    <SidebarProvider defaultOpen={document.cookie.includes('sidebar_state=true')}>
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" asChild>
                <div className="cursor-default">
                  <img src="/favicon.svg" alt="NATS UI" className="size-8 shrink-0 rounded-lg" />
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold">NATS UI</span>
                    <span className="truncate text-xs flex items-center gap-1.5">
                      <span
                        className={`inline-block h-1.5 w-1.5 rounded-full ${getStatusColor(status)}`}
                      />
                      {getStatusText(status)}
                    </span>
                  </div>
                </div>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>

        <SidebarContent>
          <NavMain items={navItems} label="JetStream" />
          <NavMain items={systemItems} label="System" />
        </SidebarContent>

        <SidebarFooter>
          <NavUser username={username || 'admin'} />
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>

      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator
              orientation="vertical"
              className="mr-2 data-[orientation=vertical]:h-4"
            />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbPage>{currentPage}</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
          <div className="ml-auto pr-4">
            <Badge
              variant={
                status === 'connected'
                  ? 'default'
                  : status === 'error'
                    ? 'destructive'
                    : 'outline'
              }
              className={
                status === 'connected'
                  ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
                  : ''
              }
            >
              NATS: {getStatusText(status)}
            </Badge>
          </div>
        </header>

        <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
