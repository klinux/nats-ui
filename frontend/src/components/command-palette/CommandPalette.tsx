import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Command } from 'cmdk';
import {
  Database,
  GitBranch,
  Globe,
  Home,
  MessageSquare,
  Monitor,
  Moon,
  Package,
  Settings,
  Sun,
  Users,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { Dialog, DialogContent } from '../ui/dialog';

interface CommandItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  action: () => void;
  group: string;
  keywords?: string;
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { setTheme, resolvedTheme } = useTheme();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const go = (path: string) => {
    navigate(path);
    setOpen(false);
  };

  const items: CommandItem[] = [
    { id: 'dashboard', label: 'Dashboard', icon: <Home className="h-4 w-4" />, action: () => go('/'), group: 'Navigation', keywords: 'home overview' },
    { id: 'messages', label: 'Messages', icon: <MessageSquare className="h-4 w-4" />, action: () => go('/messages'), group: 'Navigation', keywords: 'pub sub topics publish subscribe' },
    { id: 'streams', label: 'Streams', icon: <GitBranch className="h-4 w-4" />, action: () => go('/streams'), group: 'Navigation', keywords: 'jetstream' },
    { id: 'consumers', label: 'Consumers', icon: <Users className="h-4 w-4" />, action: () => go('/consumers'), group: 'Navigation', keywords: 'jetstream consumer' },
    { id: 'kv', label: 'KV Store', icon: <Database className="h-4 w-4" />, action: () => go('/kv-store'), group: 'Navigation', keywords: 'key value store' },
    { id: 'objstore', label: 'Object Store', icon: <Package className="h-4 w-4" />, action: () => go('/object-store'), group: 'Navigation', keywords: 'files objects blobs' },
    { id: 'monitoring', label: 'Monitoring', icon: <Monitor className="h-4 w-4" />, action: () => go('/monitoring'), group: 'Navigation', keywords: 'metrics performance cpu memory' },
    { id: 'cluster', label: 'Cluster', icon: <Globe className="h-4 w-4" />, action: () => go('/cluster'), group: 'Navigation', keywords: 'routes gateways leafnodes' },
    { id: 'settings', label: 'Settings', icon: <Settings className="h-4 w-4" />, action: () => go('/settings'), group: 'Navigation' },
    {
      id: 'toggle-theme',
      label: resolvedTheme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode',
      icon: resolvedTheme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />,
      action: () => { setTheme(resolvedTheme === 'dark' ? 'light' : 'dark'); setOpen(false); },
      group: 'Actions',
      keywords: 'theme dark light mode',
    },
  ];

  const groups = [...new Set(items.map((i) => i.group))];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="p-0 gap-0 max-w-lg overflow-hidden">
        <Command className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground">
          <Command.Input
            placeholder="Type a command or search..."
            className="h-11 w-full border-b bg-transparent px-4 py-3 text-sm outline-none placeholder:text-muted-foreground"
          />
          <Command.List className="max-h-[300px] overflow-y-auto p-1">
            <Command.Empty className="py-6 text-center text-sm text-muted-foreground">
              No results found.
            </Command.Empty>
            {groups.map((group) => (
              <Command.Group key={group} heading={group}>
                {items
                  .filter((i) => i.group === group)
                  .map((item) => (
                    <Command.Item
                      key={item.id}
                      value={`${item.label} ${item.keywords || ''}`}
                      onSelect={item.action}
                      className="flex items-center gap-2 rounded-md px-2 py-2 text-sm cursor-pointer aria-selected:bg-accent aria-selected:text-accent-foreground"
                    >
                      {item.icon}
                      <span>{item.label}</span>
                    </Command.Item>
                  ))}
              </Command.Group>
            ))}
          </Command.List>
          <div className="border-t px-3 py-2 text-xs text-muted-foreground flex items-center gap-4">
            <span><kbd className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium">↑↓</kbd> Navigate</span>
            <span><kbd className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium">↵</kbd> Select</span>
            <span><kbd className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium">Esc</kbd> Close</span>
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
