import { useState, useCallback } from 'react';
import { Gauge, Play, Clock, Zap, HardDrive } from 'lucide-react';
import { toast } from 'sonner';

import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { runBenchmark, type BenchRequest, type BenchResult } from '../services/api-client-extended';
import { formatBytes } from '../lib/format';

interface HistoryEntry {
  id: number;
  request: BenchRequest;
  result: BenchResult;
  timestamp: Date;
}

export function Benchmark() {
  const [subject, setSubject] = useState('bench.test');
  const [msgSize, setMsgSize] = useState(128);
  const [numMsgs, setNumMsgs] = useState(10000);
  const [numPubs, setNumPubs] = useState(1);
  const [numSubs, setNumSubs] = useState(0);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<BenchResult | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  const handleRun = useCallback(async () => {
    if (!subject.trim()) {
      toast.error('Subject is required');
      return;
    }
    setRunning(true);
    setResult(null);
    try {
      const req: BenchRequest = {
        subject: subject.trim(),
        msg_size: msgSize,
        num_msgs: numMsgs,
        num_pubs: numPubs,
        num_subs: numSubs,
      };
      const res = await runBenchmark(req);
      setResult(res);
      setHistory((prev) => [
        { id: Date.now(), request: req, result: res, timestamp: new Date() },
        ...prev.slice(0, 19),
      ]);
      toast.success('Benchmark completed');
    } catch (err) {
      toast.error(`Benchmark failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setRunning(false);
    }
  }, [subject, msgSize, numMsgs, numPubs, numSubs]);

  return (
    <div className="h-full flex flex-col p-4 overflow-auto">
      <div className="flex items-center justify-between mb-6 flex-shrink-0">
        <div>
          <h1 className="text-3xl font-bold">Benchmark</h1>
          <p className="text-muted-foreground">
            Run performance benchmarks against your NATS server
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2 mb-6">
        <BenchmarkForm
          subject={subject}
          msgSize={msgSize}
          numMsgs={numMsgs}
          numPubs={numPubs}
          numSubs={numSubs}
          running={running}
          onSubjectChange={setSubject}
          onMsgSizeChange={setMsgSize}
          onNumMsgsChange={setNumMsgs}
          onNumPubsChange={setNumPubs}
          onNumSubsChange={setNumSubs}
          onRun={handleRun}
        />

        {result && <BenchmarkResults result={result} />}
      </div>

      {history.length > 0 && <BenchmarkHistory history={history} />}
    </div>
  );
}

function BenchmarkForm({
  subject, msgSize, numMsgs, numPubs, numSubs, running,
  onSubjectChange, onMsgSizeChange, onNumMsgsChange, onNumPubsChange, onNumSubsChange, onRun,
}: {
  subject: string; msgSize: number; numMsgs: number; numPubs: number; numSubs: number; running: boolean;
  onSubjectChange: (v: string) => void; onMsgSizeChange: (v: number) => void;
  onNumMsgsChange: (v: number) => void; onNumPubsChange: (v: number) => void;
  onNumSubsChange: (v: number) => void; onRun: () => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <Gauge className="h-4 w-4" /> Configuration
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1">
          <Label htmlFor="bench-subject" className="text-xs">Subject (required)</Label>
          <Input
            id="bench-subject"
            value={subject}
            onChange={(e) => onSubjectChange(e.target.value)}
            placeholder="bench.test"
            className="h-8"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="bench-msg-size" className="text-xs">Message Size (bytes)</Label>
            <Input
              id="bench-msg-size"
              type="number"
              min={1}
              value={msgSize}
              onChange={(e) => onMsgSizeChange(Number(e.target.value) || 128)}
              className="h-8"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="bench-num-msgs" className="text-xs">Number of Messages</Label>
            <Input
              id="bench-num-msgs"
              type="number"
              min={1}
              value={numMsgs}
              onChange={(e) => onNumMsgsChange(Number(e.target.value) || 10000)}
              className="h-8"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="bench-pubs" className="text-xs">Publishers</Label>
            <Input
              id="bench-pubs"
              type="number"
              min={1}
              value={numPubs}
              onChange={(e) => onNumPubsChange(Number(e.target.value) || 1)}
              className="h-8"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="bench-subs" className="text-xs">Subscribers</Label>
            <Input
              id="bench-subs"
              type="number"
              min={0}
              value={numSubs}
              onChange={(e) => onNumSubsChange(Number(e.target.value) || 0)}
              className="h-8"
            />
          </div>
        </div>
        <Button onClick={onRun} disabled={running} className="w-full">
          <Play className="mr-2 h-4 w-4" />
          {running ? 'Running...' : 'Run Benchmark'}
        </Button>
      </CardContent>
    </Card>
  );
}

function BenchmarkResults({ result }: { result: BenchResult }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <ResultCard icon={Zap} label="Messages/sec" value={result.msgs_per_sec.toLocaleString()} />
      <ResultCard icon={HardDrive} label="Bytes/sec" value={formatBytes(result.bytes_per_sec) + '/s'} />
      <ResultCard icon={Clock} label="Duration" value={`${result.duration_ms.toLocaleString()} ms`} />
      <ResultCard icon={Gauge} label="Total Messages" value={result.total_msgs.toLocaleString()} />
      <ResultCard icon={HardDrive} label="Total Bytes" value={formatBytes(result.total_bytes)} />
      <ResultCard icon={Gauge} label="Message Size" value={formatBytes(result.msg_size)} />
    </div>
  );
}

function ResultCard({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-lg font-bold">{value}</p>
          </div>
          <Icon className="h-5 w-5 text-muted-foreground" />
        </div>
      </CardContent>
    </Card>
  );
}

function BenchmarkHistory({ history }: { history: HistoryEntry[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <Clock className="h-4 w-4" /> History ({history.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-auto max-h-64">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Msgs</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Msgs/sec</TableHead>
                <TableHead>Bytes/sec</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="text-xs">{entry.timestamp.toLocaleTimeString()}</TableCell>
                  <TableCell className="font-mono text-xs">{entry.request.subject}</TableCell>
                  <TableCell>{entry.result.total_msgs.toLocaleString()}</TableCell>
                  <TableCell>{formatBytes(entry.result.msg_size)}</TableCell>
                  <TableCell>{entry.result.duration_ms} ms</TableCell>
                  <TableCell className="font-bold">{entry.result.msgs_per_sec.toLocaleString()}</TableCell>
                  <TableCell>{formatBytes(entry.result.bytes_per_sec)}/s</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
