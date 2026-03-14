import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';

const bucketSchema = z.object({
  name: z
    .string()
    .min(1, 'Bucket name is required')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Only letters, numbers, hyphens and underscores'),
  description: z.string().optional(),
  max_bytes: z.coerce.number().optional(),
  ttl: z.coerce.number().optional(),
});

export type CreateBucketFormData = z.infer<typeof bucketSchema>;

interface CreateBucketDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: CreateBucketFormData) => Promise<void>;
}

export function CreateBucketDialog({
  open,
  onOpenChange,
  onSubmit,
}: CreateBucketDialogProps) {
  const form = useForm<CreateBucketFormData>({
    resolver: zodResolver(bucketSchema),
    defaultValues: { name: '', description: '', max_bytes: undefined, ttl: undefined },
  });

  const handleSubmit = async (data: CreateBucketFormData) => {
    await onSubmit(data);
    form.reset();
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) form.reset();
    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Object Store Bucket</DialogTitle>
          <DialogDescription>
            Create a new object storage bucket
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="os-bucket-name">Bucket Name</Label>
            <Input
              id="os-bucket-name"
              placeholder="e.g., my-objects"
              {...form.register('name')}
            />
            {form.formState.errors.name && (
              <p className="text-sm text-red-600">
                {form.formState.errors.name.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="os-bucket-desc">Description (optional)</Label>
            <Input
              id="os-bucket-desc"
              placeholder="e.g., Static assets for the frontend"
              {...form.register('description')}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="os-bucket-max-bytes">Max Bytes (optional)</Label>
              <Input
                id="os-bucket-max-bytes"
                type="number"
                placeholder="No limit"
                {...form.register('max_bytes')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="os-bucket-ttl">TTL in seconds (optional)</Label>
              <Input
                id="os-bucket-ttl"
                type="number"
                placeholder="No expiration"
                {...form.register('ttl')}
              />
            </div>
          </div>

          <div className="flex justify-end space-x-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? 'Creating...' : 'Create Bucket'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
