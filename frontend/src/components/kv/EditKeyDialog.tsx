import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus } from 'lucide-react';

import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../ui/dialog';

import { kvSchema, type KVFormData, type KVEntry } from './types';

interface EditKeyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isEditMode: boolean;
  selectedEntry: KVEntry | null;
  buckets: string[];
  currentBucket: string;
  onCurrentBucketChange: (bucket: string) => void;
  onSubmit: (data: KVFormData) => Promise<void>;
  onClose: () => void;
}

export function EditKeyDialog({
  open,
  onOpenChange,
  isEditMode,
  selectedEntry,
  buckets,
  currentBucket,
  onCurrentBucketChange,
  onSubmit,
  onClose,
}: EditKeyDialogProps) {
  const form = useForm<KVFormData>({
    resolver: zodResolver(kvSchema),
    defaultValues: {
      key: '',
      value: '',
    },
  });

  // Sync form values when editing an entry
  useEffect(() => {
    if (isEditMode && selectedEntry) {
      form.reset({
        key: selectedEntry.key,
        value: selectedEntry.value,
      });
    } else if (!open) {
      form.reset({ key: '', value: '' });
    }
  }, [isEditMode, selectedEntry, open, form]);

  const handleOpenChange = (nextOpen: boolean) => {
    onOpenChange(nextOpen);
    if (!nextOpen) {
      onClose();
      form.reset();
    }
  };

  const handleSubmit = async (data: KVFormData) => {
    await onSubmit(data);
    form.reset();
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button disabled={buckets.length === 0}>
          <Plus className="mr-2 h-4 w-4" />
          Add Key-Value
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEditMode ? 'Edit Key-Value Pair' : 'Create Key-Value Pair'}
          </DialogTitle>
          <DialogDescription>
            {isEditMode
              ? 'Update the value for this key'
              : buckets.length === 0
                ? 'Please create a bucket first'
                : 'Add a new key-value pair to the store'
            }
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
          {!isEditMode && buckets.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="bucket-select">Bucket</Label>
              <select
                id="bucket-select"
                value={currentBucket || buckets[0]}
                onChange={(e) => onCurrentBucketChange(e.target.value)}
                className="w-full px-3 py-2 border border-input bg-background rounded-md text-sm"
              >
                {buckets.map(bucket => (
                  <option key={bucket} value={bucket}>{bucket}</option>
                ))}
              </select>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="key">Key</Label>
            <Input
              id="key"
              placeholder="e.g., config.database.host"
              {...form.register('key')}
              disabled={isEditMode}
            />
            {form.formState.errors.key && (
              <p className="text-sm text-red-600">
                {form.formState.errors.key.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="value">Value</Label>
            <Textarea
              id="value"
              placeholder="Enter the value..."
              rows={4}
              {...form.register('value')}
            />
            {form.formState.errors.value && (
              <p className="text-sm text-red-600">
                {form.formState.errors.value.message}
              </p>
            )}
          </div>

          <div className="flex justify-end space-x-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting || buckets.length === 0}>
              {isEditMode ? 'Update' : 'Create'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
