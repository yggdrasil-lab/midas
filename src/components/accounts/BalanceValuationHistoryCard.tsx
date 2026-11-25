import React from 'react';
import { Calendar, History, PlusCircle } from 'lucide-react';
import { Button, GlassCard, SectionHeader, SelectableCard } from '@yggdrasil-lab/ui';
import { Account, AssetSnapshot } from '../../types';
import { formatMoney } from '../../utils/format';

interface BalanceValuationHistoryCardProps {
  accounts: Account[];
  snapshotsByAccount: Record<number, AssetSnapshot[]>;
  onInspectAccount: (account: Account) => void;
  onRecordSnapshot: () => void;
}

/**
 * Displays the latest recorded balance valuation checkpoint for each active account.
 */
export const BalanceValuationHistoryCard: React.FC<BalanceValuationHistoryCardProps> = ({
  accounts,
  snapshotsByAccount,
  onInspectAccount,
  onRecordSnapshot,
}) => {
  const getAccountBalanceDelta = (accountId: number): number | null => {
    const snaps = snapshotsByAccount[accountId];
    if (!snaps || snaps.length < 2) return null;
    return snaps[0].balance_nzd - snaps[1].balance_nzd;
  };

  return (
    <GlassCard className="space-y-4" data-testid="account-snapshots-panel">
      <SectionHeader
        title="Balance Valuation History"
        subtitle="Latest recorded valuation snapshots and net worth checkpoints across accounts"
        icon={<History className="w-4 h-4" />}
        variant="emerald"
        actions={
          <Button
            variant="outline"
            size="xs"
            icon={<PlusCircle className="w-3.5 h-3.5" />}
            onClick={onRecordSnapshot}
          >
            Record Snapshot
          </Button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-1">
        {accounts.map((acc) => {
          const latest = snapshotsByAccount[acc.id]?.[0];
          const delta = getAccountBalanceDelta(acc.id);
          const currency = acc.currency || 'NZD';
          const hasDelta = delta !== null && delta !== 0;

          return (
            <SelectableCard
              key={acc.id}
              onClick={() => onInspectAccount(acc)}
              variant="emerald"
              icon={<Calendar className="w-3 h-3 text-slate-400" />}
              title={acc.name}
              value={formatMoney(latest?.balance ?? latest?.balance_nzd ?? 0)}
              valueSuffix={currency}
              subtitle={latest ? latest.snapshot_date : 'No snapshots'}
              subvalue={hasDelta ? `${formatMoney(delta, { showPlusSign: true })} ${currency} vs prior` : undefined}
              subvalueTrend={hasDelta ? (delta > 0 ? 'positive' : 'negative') : 'neutral'}
            />
          );
        })}
      </div>
    </GlassCard>
  );
};
