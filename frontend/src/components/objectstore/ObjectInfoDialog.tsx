import { FileBox } from 'lucide-react';

import { Badge } from '../ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { formatBytes } from '../../lib/format';
import type { ObjectInfo } from '../../services/api-client';

interface ObjectInfoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  object: ObjectInfo | null;
}

export function ObjectInfoDialog({
  open,
  onOpenChange,
  object,
}: ObjectInfoDialogProps) {
  if (!object) return null;

  const rows: { label: string; value: React.ReactNode }[] = [
    { label: 'Name', value: <span className="font-mono">{object.name}</span> },
    {
      label: 'Description',
      value: object.description || <span className="text-muted-foreground italic">None</span>,
    },
    {
      label: 'Size',
      value: <Badge variant="secondary">{formatBytes(object.size)}</Badge>,
    },
    { label: 'Chunks', value: object.chunks },
    {
      label: 'Digest',
      value: (
        <span className="font-mono text-xs break-all">{object.digest}</span>
      ),
    },
    {
      label: 'Modified',
      value: new Date(object.modified).toLocaleString(),
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileBox className="h-5 w-5" />
            Object Info
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {rows.map((row) => (
            <div
              key={row.label}
              className="flex items-start justify-between gap-4 py-2 border-b last:border-0"
            >
              <span className="text-sm font-medium text-muted-foreground min-w-[100px]">
                {row.label}
              </span>
              <span className="text-sm text-right">{row.value}</span>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
