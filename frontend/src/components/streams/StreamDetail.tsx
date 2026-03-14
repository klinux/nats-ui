import { GitBranch } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Label } from '../ui/label';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '../ui/dialog';
import { formatBytes } from '../../lib/format';
import { formatDuration, type StreamInfo } from './types';

interface StreamDetailProps {
  stream: StreamInfo | null;
  onClose: () => void;
}

export function StreamDetail({ stream, onClose }: StreamDetailProps) {
  if (!stream) return null;

  return (
    <Dialog open={!!stream} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitBranch className="h-5 w-5" />
            Stream: {stream.name}
          </DialogTitle>
          <DialogDescription>
            Detailed information and configuration for this stream
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Storage Info</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <InfoRow label="Messages" value={stream.messages.toLocaleString()} />
                <InfoRow label="Size" value={formatBytes(stream.bytes)} />
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Storage:</span>
                  <Badge variant={stream.storage === 'file' ? 'default' : 'secondary'}>
                    {stream.storage}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Limits</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <InfoRow label="Max Messages" value={stream.maxMsgs.toLocaleString()} />
                <InfoRow label="Max Size" value={formatBytes(stream.maxBytes)} />
                <InfoRow label="Max Age" value={formatDuration(stream.maxAge)} />
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium">Subjects</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {stream.subjects.map((subject) => (
                  <Badge key={subject} variant="outline">{subject}</Badge>
                ))}
              </div>
            </div>

            {stream.description && (
              <div>
                <Label className="text-sm font-medium">Description</Label>
                <p className="text-sm text-muted-foreground mt-1">{stream.description}</p>
              </div>
            )}

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label className="text-sm font-medium">Retention</Label>
                <p className="text-sm text-muted-foreground">{stream.retention}</p>
              </div>
              <div>
                <Label className="text-sm font-medium">Replicas</Label>
                <p className="text-sm text-muted-foreground">{stream.replicas}</p>
              </div>
              <div>
                <Label className="text-sm font-medium">Consumers</Label>
                <p className="text-sm text-muted-foreground">{stream.consumers}</p>
              </div>
            </div>

            {stream.mirror && (
              <div>
                <Label className="text-sm font-medium">Mirror</Label>
                <Badge variant="outline" className="ml-2">{stream.mirror}</Badge>
              </div>
            )}

            {stream.sources && stream.sources.length > 0 && (
              <div>
                <Label className="text-sm font-medium">Sources</Label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {stream.sources.map((s) => (
                    <Badge key={s} variant="outline">{s}</Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-sm text-muted-foreground">{label}:</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}
