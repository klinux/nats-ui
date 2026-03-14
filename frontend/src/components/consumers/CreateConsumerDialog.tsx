import { useState, useCallback, useEffect } from 'react';
import { Plus } from 'lucide-react';

import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '../ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { toast } from 'sonner';
import { createConsumer, listStreams } from '../../services/api-client';

interface CreateConsumerDialogProps {
  onCreated: () => void;
}

const defaultForm = { stream: '', name: '', filterSubject: '', deliverPolicy: 'all', ackPolicy: 'explicit', durable: true };

export function CreateConsumerDialog({ onCreated }: CreateConsumerDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [availableStreams, setAvailableStreams] = useState<string[]>([]);
  const [form, setForm] = useState(defaultForm);

  useEffect(() => {
    if (isOpen) {
      listStreams().then((streams) => {
        setAvailableStreams(streams.map(s => (s.config as Record<string, unknown>)?.name as string).filter(Boolean));
      }).catch(() => {});
    }
  }, [isOpen]);

  const handleCreate = useCallback(async () => {
    if (!form.stream || !form.name) {
      toast.error('Stream and consumer name are required');
      return;
    }
    try {
      await createConsumer(form.stream, {
        name: form.name,
        filterSubject: form.filterSubject || undefined,
        deliverPolicy: form.deliverPolicy,
        ackPolicy: form.ackPolicy,
        durable: form.durable,
      });
      toast.success(`Consumer ${form.name} created`);
      setIsOpen(false);
      setForm(defaultForm);
      onCreated();
    } catch (err) {
      toast.error(`Failed to create consumer: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }, [form, onCreated]);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Create Consumer
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create Consumer</DialogTitle>
          <DialogDescription>Create a new JetStream consumer on a stream</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Stream</Label>
            <Select value={form.stream} onValueChange={(v) => setForm(prev => ({ ...prev, stream: v }))}>
              <SelectTrigger><SelectValue placeholder="Select stream" /></SelectTrigger>
              <SelectContent>
                {availableStreams.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Consumer Name</Label>
            <Input value={form.name} onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))} placeholder="e.g., my-consumer" />
          </div>
          <div className="space-y-2">
            <Label>Filter Subject (optional)</Label>
            <Input value={form.filterSubject} onChange={e => setForm(prev => ({ ...prev, filterSubject: e.target.value }))} placeholder="e.g., orders.created" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Deliver Policy</Label>
              <Select value={form.deliverPolicy} onValueChange={(v) => setForm(prev => ({ ...prev, deliverPolicy: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="last">Last</SelectItem>
                  <SelectItem value="new">New</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Ack Policy</Label>
              <Select value={form.ackPolicy} onValueChange={(v) => setForm(prev => ({ ...prev, ackPolicy: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="explicit">Explicit</SelectItem>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="all">All</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
          <Button onClick={handleCreate}>Create Consumer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
