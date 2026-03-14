import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '../ui/dialog';

const createStreamSchema = z.object({
  name: z.string().min(1, 'Stream name is required').regex(/^[a-zA-Z0-9_-]+$/, 'Invalid stream name'),
  subjects: z.string().min(1, 'At least one subject is required'),
  description: z.string().optional(),
  retention: z.enum(['limits', 'interest', 'workqueue']),
  storage: z.enum(['file', 'memory']),
  maxMsgs: z.number().min(0),
  maxBytes: z.number().min(0),
  maxAge: z.number().min(0),
  replicas: z.number().min(1).max(5),
  mirror: z.string().optional(),
  sources: z.string().optional(),
});

export type CreateStreamFormData = z.infer<typeof createStreamSchema>;

interface CreateStreamDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: CreateStreamFormData) => Promise<void>;
}

export function CreateStreamDialog({ open, onOpenChange, onSubmit }: CreateStreamDialogProps) {
  const form = useForm<CreateStreamFormData>({
    resolver: zodResolver(createStreamSchema),
    defaultValues: {
      name: '', subjects: '', description: '', retention: 'limits',
      storage: 'file', maxMsgs: 1000000, maxBytes: 1073741824,
      maxAge: 0, replicas: 1, mirror: '', sources: '',
    },
  });

  const handleSubmit = async (data: CreateStreamFormData) => {
    await onSubmit(data);
    form.reset();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create New Stream</DialogTitle>
          <DialogDescription>
            Configure a new JetStream stream to store and replay messages.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
          <Tabs defaultValue="basic" className="space-y-4">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="basic">Basic</TabsTrigger>
              <TabsTrigger value="limits">Limits & Storage</TabsTrigger>
              <TabsTrigger value="replication">Mirror & Sources</TabsTrigger>
            </TabsList>

            <TabsContent value="basic" className="space-y-4">
              <div className="grid gap-4">
                <FormField label="Stream Name" error={form.formState.errors.name?.message}>
                  <Input placeholder="e.g., ORDERS" {...form.register('name')} />
                </FormField>
                <FormField label="Subjects (comma-separated)" error={form.formState.errors.subjects?.message}>
                  <Input placeholder="e.g., orders.*, order.created" {...form.register('subjects')} />
                </FormField>
                <div className="space-y-2">
                  <Label>Description (optional)</Label>
                  <Textarea placeholder="Stream description..." {...form.register('description')} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Retention Policy</Label>
                    <Select {...form.register('retention')}>
                      <SelectTrigger><SelectValue placeholder="Select retention" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="limits">Limits</SelectItem>
                        <SelectItem value="interest">Interest</SelectItem>
                        <SelectItem value="workqueue">Work Queue</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Storage Type</Label>
                    <Select {...form.register('storage')}>
                      <SelectTrigger><SelectValue placeholder="Select storage" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="file">File</SelectItem>
                        <SelectItem value="memory">Memory</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="limits" className="space-y-4">
              <div className="grid gap-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField label="Max Messages">
                    <Input type="number" min="0" {...form.register('maxMsgs', { valueAsNumber: true })} />
                  </FormField>
                  <FormField label="Max Bytes">
                    <Input type="number" min="0" {...form.register('maxBytes', { valueAsNumber: true })} />
                  </FormField>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField label="Max Age (seconds, 0 = forever)">
                    <Input type="number" min="0" {...form.register('maxAge', { valueAsNumber: true })} />
                  </FormField>
                  <FormField label="Replicas">
                    <Input type="number" min="1" max="5" {...form.register('replicas', { valueAsNumber: true })} />
                  </FormField>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="replication" className="space-y-4">
              <div className="grid gap-4">
                <FormField label="Mirror (optional)" hint="Name of a stream to mirror. A mirror stream cannot have subjects.">
                  <Input placeholder="e.g., ORDERS" {...form.register('mirror')} />
                </FormField>
                <FormField label="Sources (optional)" hint="Comma-separated list of source stream names to aggregate.">
                  <Input placeholder="e.g., ORDERS, EVENTS" {...form.register('sources')} />
                </FormField>
              </div>
            </TabsContent>
          </Tabs>

          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              Create Stream
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function FormField({ label, error, hint, children }: {
  label: string; error?: string; hint?: string; children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
