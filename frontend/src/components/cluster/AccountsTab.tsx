import { useState, useCallback } from 'react';
import { Users, ChevronDown, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { fetchAccountDetail } from '../../services/api-client';
import { toast } from 'sonner';
import { EmptyState } from './EmptyState';
import { formatBytes } from '../../lib/format';

interface AccountsTabProps {
  accounts: string[];
}

interface AccountDetailData {
  [key: string]: unknown;
}

function isNumericByteField(key: string): boolean {
  const byteFields = ['memory', 'storage', 'store_bytes', 'mem_bytes', 'data_size'];
  return byteFields.some((f) => key.toLowerCase().includes(f));
}

function formatDetailValue(key: string, val: unknown): string {
  if (val === null || val === undefined) return '-';
  if (typeof val === 'object') return JSON.stringify(val, null, 2);
  if (typeof val === 'number' && isNumericByteField(key)) return formatBytes(val);
  return String(val);
}

export function AccountsTab({ accounts }: AccountsTabProps) {
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [detail, setDetail] = useState<AccountDetailData | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  const handleClick = useCallback(async (name: string) => {
    if (selectedName === name) {
      setSelectedName(null);
      setDetail(null);
      return;
    }
    setLoading(true);
    try {
      const data = await fetchAccountDetail(name);
      setDetail(data);
      setSelectedName(name);
      setExpandedSections(new Set());
    } catch (err) {
      toast.error(`Failed to load account: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  }, [selectedName]);

  const toggleSection = useCallback((key: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Users className="h-4 w-4" /> Accounts ({accounts.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {accounts.length === 0 ? (
            <EmptyState icon={Users} message="No accounts found." />
          ) : (
            <div className="space-y-1">
              {accounts.map((acct) => (
                <button
                  key={acct}
                  onClick={() => handleClick(acct)}
                  className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors hover:bg-accent ${
                    selectedName === acct ? 'bg-accent font-medium' : ''
                  }`}
                >
                  {acct}
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">
            {selectedName ? `Account: ${selectedName}` : 'Account Detail'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : !detail ? (
            <p className="text-sm text-muted-foreground">Select an account to view details.</p>
          ) : (
            <div className="space-y-2 text-sm max-h-96 overflow-y-auto">
              {Object.entries(detail).map(([key, val]) => {
                const isObject = typeof val === 'object' && val !== null;
                const expanded = expandedSections.has(key);

                if (isObject) {
                  return (
                    <div key={key} className="border rounded-md">
                      <button
                        onClick={() => toggleSection(key)}
                        className="w-full flex items-center justify-between px-3 py-2 hover:bg-muted/50 transition-colors"
                      >
                        <span className="text-muted-foreground font-medium">{key}</span>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[10px]">
                            {Array.isArray(val) ? `${val.length} items` : 'object'}
                          </Badge>
                          {expanded
                            ? <ChevronDown className="h-3 w-3" />
                            : <ChevronRight className="h-3 w-3" />}
                        </div>
                      </button>
                      {expanded && (
                        <div className="px-3 pb-2 border-t">
                          <pre className="text-xs font-mono bg-muted p-2 rounded mt-2 overflow-x-auto whitespace-pre-wrap">
                            {JSON.stringify(val, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  );
                }

                return (
                  <div key={key} className="flex justify-between gap-4 px-3 py-1">
                    <span className="text-muted-foreground shrink-0">{key}</span>
                    <span className="font-mono text-xs text-right truncate">
                      {formatDetailValue(key, val)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
