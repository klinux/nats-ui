import { Database, Trash2 } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../ui/dialog';

interface BucketListProps {
  buckets: string[];
  onDeleteBucket: (bucket: string) => Promise<void>;
}

export function BucketList({ buckets, onDeleteBucket }: BucketListProps) {
  if (buckets.length === 0) {
    return null;
  }

  return (
    <Card className="mb-6 flex-shrink-0">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          Buckets ({buckets.length})
        </CardTitle>
        <CardDescription>
          Manage your KV buckets
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          {buckets.map(bucket => (
            <div key={bucket} className="flex items-center gap-2 px-3 py-2 bg-muted rounded-lg">
              <span className="text-sm font-medium">{bucket}</span>
              <Dialog>
                <DialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Delete Bucket</DialogTitle>
                    <DialogDescription>
                      Are you sure you want to delete bucket &quot;{bucket}&quot;? This will permanently delete all keys in this bucket and cannot be undone.
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <Button variant="outline">Cancel</Button>
                    <Button
                      onClick={() => onDeleteBucket(bucket)}
                      className="bg-red-600 text-white hover:bg-red-700"
                    >
                      Delete
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
