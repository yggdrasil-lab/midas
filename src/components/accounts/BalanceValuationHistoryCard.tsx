import React from 'react';
import { Calendar, ChevronRight, History, PlusCircle } from 'lucide-react';
import { Button, GlassCard, SectionHeader } from '@yggdrasil-lab/ui';
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
          return (
            <div
              key={acc.id}
              onClick={() => onInspectAccount(acc)}
              className="p-3 rounded-xl bg-background/50 hover:bg-background/80 border border-border/70 text-xs transition-all cursor-pointer space-y-1.5 group"
              title={`Click to inspect transactions for ${acc.name}`}
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-200 group-hover:text-amber-300 transition-colors truncate">
                  {acc.name}
                </span>
                <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-amber-400 group-hover:translate-x-0.5 transition-all shrink-0" />
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-[11px] text-slate-400 flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {latest ? latest.snapshot_date : 'No snapshots'}
                </span>
                <span className="font-mono font-bold text-slate-100">
                  {formatMoney(latest?.balance ?? latest?.balance_nzd ?? 0)} {acc.currency || 'NZD'}
                </span>
              </div>
              {delta !== null && delta !== 0 && (
                <div
                  className={`text-[10px] font-mono ${
                    delta > 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {formatMoney(delta, { showPlusSign: true })} {acc.currency || 'NZD'} vs prior snapshot
                </div>
              )}
            </div>
          );
        })}
      </div>
    </GlassCard>
  );
};
