import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Database } from 'lucide-react';

import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../ui/dialog';

import { bucketSchema, type BucketFormData } from './types';

interface CreateBucketDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: BucketFormData) => Promise<void>;
}

export function CreateBucketDialog({ open, onOpenChange, onSubmit }: CreateBucketDialogProps) {
  const bucketForm = useForm<BucketFormData>({
    resolver: zodResolver(bucketSchema),
    defaultValues: {
      name: '',
      ttl: undefined,
    },
  });

  const handleSubmit = async (data: BucketFormData) => {
    await onSubmit(data);
    bucketForm.reset();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Database className="mr-2 h-4 w-4" />
          Create Bucket
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create KV Bucket</DialogTitle>
          <DialogDescription>
            Create a new key-value storage bucket
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={bucketForm.handleSubmit(handleSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="bucket-name">Bucket Name</Label>
            <Input
              id="bucket-name"
              placeholder="e.g., CONFIG"
              {...bucketForm.register('name')}
            />
            {bucketForm.formState.errors.name && (
              <p className="text-sm text-red-600">
                {bucketForm.formState.errors.name.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="bucket-ttl">TTL (seconds, optional)</Label>
            <Input
              id="bucket-ttl"
              type="number"
              placeholder="Leave empty for no expiration"
              {...bucketForm.register('ttl', { valueAsNumber: true })}
            />
          </div>

          <div className="flex justify-end space-x-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={bucketForm.formState.isSubmitting}>
              Create Bucket
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
