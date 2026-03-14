import { useState } from 'react';
import {
  Download,
  Trash2,
  Info,
  FileBox,
  Upload,
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { TableRowSkeleton } from '../ui/skeletons';
import { formatBytes } from '../../lib/format';
import type { ObjectInfo } from '../../services/api-client';

interface ObjectListProps {
  bucketName: string;
  objects: ObjectInfo[];
  isLoading: boolean;
  onUpload: () => void;
  onDownload: (name: string) => void;
  onDelete: (name: string) => void;
  onInfo: (obj: ObjectInfo) => void;
}

export function ObjectList({
  bucketName,
  objects,
  isLoading,
  onUpload,
  onDownload,
  onDelete,
  onInfo,
}: ObjectListProps) {
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  return (
    <Card className="flex-1 flex flex-col overflow-hidden">
      <CardHeader className="flex-shrink-0 pb-3">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            <FileBox className="h-4 w-4" />
            Objects in{' '}
            <Badge variant="outline" className="font-mono">
              {bucketName}
            </Badge>
            <span className="text-muted-foreground font-normal">
              ({objects.length})
            </span>
          </div>
          <Button size="sm" className="h-8" onClick={onUpload}>
            <Upload className="h-3.5 w-3.5 mr-1.5" />
            Upload
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden flex flex-col relative px-4">
        {isLoading && objects.length === 0 ? (
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Modified</TableHead>
                  <TableHead className="w-28">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.from({ length: 4 }).map((_, i) => (
                  <TableRowSkeleton key={i} columns={4} />
                ))}
              </TableBody>
            </Table>
          </div>
        ) : objects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <FileBox className="h-12 w-12 text-muted-foreground/50" />
            <div className="text-center space-y-2">
              <h3 className="font-semibold">No objects</h3>
              <p className="text-sm text-muted-foreground">
                Upload your first object to this bucket
              </p>
            </div>
          </div>
        ) : (
          <div className="h-full overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Chunks</TableHead>
                  <TableHead>Modified</TableHead>
                  <TableHead className="w-32">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {objects.map((obj) => (
                  <TableRow key={obj.name}>
                    <TableCell className="font-medium font-mono text-sm">
                      {obj.name}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{formatBytes(obj.size)}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {obj.chunks}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(obj.modified).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onInfo(obj)}
                          title="Object info"
                        >
                          <Info className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onDownload(obj.name)}
                          title="Download"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-600 hover:text-red-700"
                          onClick={() => setDeleteTarget(obj.name)}
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        {objects.length > 6 && (
          <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-background to-transparent pointer-events-none" />
        )}
      </CardContent>

      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Object</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{deleteTarget}&quot; from
              bucket &quot;{bucketName}&quot;? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              className="bg-red-600 text-white hover:bg-red-700"
              onClick={() => {
                if (deleteTarget) onDelete(deleteTarget);
                setDeleteTarget(null);
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
