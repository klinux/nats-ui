import { useState, useCallback } from 'react';
import { Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { fetchAccountDetail } from '../../services/api-client';
import { toast } from 'sonner';
import { EmptyState } from './EmptyState';

interface AccountsTabProps {
  accounts: string[];
}

export function AccountsTab({ accounts }: AccountsTabProps) {
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null);

  const handleClick = useCallback(async (name: string) => {
    try {
      const data = await fetchAccountDetail(name);
      setDetail(data);
      setSelectedName(name);
    } catch (err) {
      toast.error(`Failed to load account: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
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
          {!detail ? (
            <p className="text-sm text-muted-foreground">Select an account to view details.</p>
          ) : (
            <div className="space-y-2 text-sm">
              {Object.entries(detail).map(([key, val]) => (
                <div key={key} className="flex justify-between gap-4">
                  <span className="text-muted-foreground shrink-0">{key}</span>
                  <span className="font-mono text-xs text-right truncate">
                    {typeof val === 'object' ? JSON.stringify(val) : String(val ?? '-')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
