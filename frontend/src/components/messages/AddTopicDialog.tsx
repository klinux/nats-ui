import { useState } from 'react';

import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';

interface AddTopicDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (topic: string) => void;
}

export function AddTopicDialog({ open, onOpenChange, onAdd }: AddTopicDialogProps) {
  const [name, setName] = useState('');

  const handleAdd = () => {
    if (name.trim()) {
      onAdd(name.trim());
      setName('');
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) setName(''); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Custom Topic</DialogTitle>
          <DialogDescription>
            Enter a NATS subject name to add it to the topic list.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="topic-name">Topic Name</Label>
          <Input
            id="topic-name"
            placeholder="e.g., orders.created, events.>"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); }}
          />
          <p className="text-[10px] text-muted-foreground">
            Supports NATS wildcards: * (single token), &gt; (multi-token)
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { onOpenChange(false); setName(''); }}>
            Cancel
          </Button>
          <Button onClick={handleAdd} disabled={!name.trim()}>
            Add Topic
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
