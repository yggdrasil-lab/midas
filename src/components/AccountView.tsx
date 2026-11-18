import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { EmptyState, LoadingState } from '@yggdrasil-lab/ui';
import {
  fetchAccounts,
  fetchAccountSnapshots,
  fetchLoans,
  syncAllIntegrations,
} from '../services/api';
import { Account, AssetSnapshot, LoansSummaryResponse, PeriodType, SyncResult } from '../types';
import { AccountInspectionModal } from './AccountInspectionModal';
import { AccountTierSection } from './AccountTierSection';
import { BalanceValuationHistoryCard } from './accounts/BalanceValuationHistoryCard';
import { PortfolioNetWorthHero } from './accounts/PortfolioNetWorthHero';
import { LoansTracker } from './LoansTracker';
import { getDefaultCustomRange } from './PeriodFilterBar';
import { RecordSnapshotModal } from './RecordSnapshotModal';

interface AccountViewProps {
  onRefreshRunway?: () => void;
  initialAccountId?: number | null;
}

const TIER_ORDER: Account['tier'][] = ['cash', 'growth', 'locked'];

/**
 * Portfolio allocation overview, tier-grouped account cards, valuation
 * history checkpoints, and per-account ledger inspection.
 */
export const AccountView: React.FC<AccountViewProps> = ({
  onRefreshRunway,
  initialAccountId = null,
}) => {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [snapshotsByAccount, setSnapshotsByAccount] = useState<Record<number, AssetSnapshot[]>>({});
  const [loansSummary, setLoansSummary] = useState<LoansSummaryResponse | null>(null);
  const defaultRange = useMemo(() => getDefaultCustomRange(), []);
  const [period, setPeriod] = useState<PeriodType>('month');
  const [startDate, setStartDate] = useState(defaultRange.startDate);
  const [endDate, setEndDate] = useState(defaultRange.endDate);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successNote, setSuccessNote] = useState<string | null>(null);
  const [syncSummary, setSyncSummary] = useState<SyncResult | null>(null);

  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [inspectingAccount, setInspectingAccount] = useState<Account | null>(null);
  const [isSnapshotModalOpen, setIsSnapshotModalOpen] = useState(false);
  const [snapshotInitialAccountId, setSnapshotInitialAccountId] = useState<number | null>(null);

  const loadAccountsAndSnapshots = async () => {
    setLoading(true);
    setError(null);
    try {
      const [accs, loans] = await Promise.all([
        fetchAccounts(),
        fetchLoans().catch(() => null),
      ]);
      setAccounts(accs);
      setLoansSummary(loans);

      const snapEntries = await Promise.all(
        accs.map(async (acc) => {
          try {
            const snaps = await fetchAccountSnapshots(acc.id, 12);
            return [acc.id, snaps] as const;
          } catch {
            return [acc.id, [] as AssetSnapshot[]] as const;
          }
        })
      );
      const snapMap: Record<number, AssetSnapshot[]> = {};
      for (const [accId, snaps] of snapEntries) {
        snapMap[accId] = snaps;
      }
      setSnapshotsByAccount(snapMap);

      if (initialAccountId !== null) {
        const found = accs.find((a) => a.id === initialAccountId);
        if (found) {
          setInspectingAccount(found);
          setIsAccountModalOpen(true);
        }
      }
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to load accounts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAccountsAndSnapshots();
  }, []);

  const getAccountLatestBalance = useCallback(
    (accountId: number): number => {
      const snaps = snapshotsByAccount[accountId];
      return snaps && snaps.length > 0 ? snaps[0].balance_nzd : 0;
    },
    [snapshotsByAccount]
  );

  const getAccountLatestNativeBalance = useCallback(
    (accountId: number): number => {
      const snaps = snapshotsByAccount[accountId];
      return snaps && snaps.length > 0 ? Number(snaps[0].balance ?? snaps[0].balance_nzd) : 0;
    },
    [snapshotsByAccount]
  );

  const accountsByTier = useMemo(
    () => ({
      cash: accounts.filter((a) => a.tier === 'cash'),
      growth: accounts.filter((a) => a.tier === 'growth'),
      locked: accounts.filter((a) => a.tier === 'locked'),
    }),
    [accounts]
  );

  const tierTotals = useMemo(
    () => ({
      cash: accountsByTier.cash.reduce((sum, a) => sum + getAccountLatestBalance(a.id), 0),
      growth: accountsByTier.growth.reduce((sum, a) => sum + getAccountLatestBalance(a.id), 0),
      locked: accountsByTier.locked.reduce((sum, a) => sum + getAccountLatestBalance(a.id), 0),
    }),
    [accountsByTier, getAccountLatestBalance]
  );

  const totalPortfolioBalance = tierTotals.cash + tierTotals.growth + tierTotals.locked;

  const handleInspectAccount = (account: Account | null) => {
    if (
      account &&
      (account.account_type === 'crypto' || account.currency.toUpperCase() === 'BTC')
    ) {
      setPeriod('all');
    }
    setInspectingAccount(account);
    setIsAccountModalOpen(true);
  };

  const handleOpenRecordSnapshot = (account?: Account) => {
    setError(null);
    setSnapshotInitialAccountId((account || accounts[0])?.id ?? null);
    setIsSnapshotModalOpen(true);
  };

  const handleSnapshotSaved = (
    accountId: number,
    updatedSnaps: AssetSnapshot[],
    accountName: string
  ) => {
    setSnapshotsByAccount((prev) => ({ ...prev, [accountId]: updatedSnaps }));
    setSyncSummary(null);
    setSuccessNote(`Saved valuation snapshot for ${accountName}`);
    setTimeout(() => setSuccessNote(null), 4000);
    onRefreshRunway?.();
  };

  const handleSyncNow = async () => {
    setSyncing(true);
    setError(null);
    setSuccessNote(null);
    setSyncSummary(null);
    try {
      const result = await syncAllIntegrations();
      setSyncSummary(result);
      setSuccessNote(
        `Synced ${result.accounts_synced} accounts: ${result.transactions_created} new transactions, ${result.transactions_skipped} skipped, ${result.snapshots_updated} snapshots updated.`
      );
      await loadAccountsAndSnapshots();
      onRefreshRunway?.();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to sync connected accounts');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="space-y-6" data-testid="per-account-view">
      <PortfolioNetWorthHero
        accountCount={accounts.length}
        tierTotals={tierTotals}
        totalPortfolioBalance={totalPortfolioBalance}
        totalLiabilities={loansSummary?.total_liabilities ?? 0}
        period={period}
        onPeriodChange={setPeriod}
        startDate={startDate}
        endDate={endDate}
        onStartDateChange={setStartDate}
        onEndDateChange={setEndDate}
        syncing={syncing}
        error={error}
        successNote={successNote}
        syncSummary={syncSummary}
        onSyncNow={handleSyncNow}
        onRecordSnapshot={() => handleOpenRecordSnapshot()}
        onInspectAllAccounts={() => handleInspectAccount(null)}
      />

      {loading ? (
        <LoadingState label="Loading accounts and valuation checkpoints..." variant="amber" />
      ) : accounts.length === 0 ? (
        <EmptyState
          title="No accounts configured yet"
          description="Ingest bank statements or seed test data to populate your freedom tier portfolio."
          variant="dashed"
        />
      ) : (
        <div className="space-y-6" data-testid="account-selector-grid">
          {TIER_ORDER.map((tier) => (
            <AccountTierSection
              key={tier}
              tier={tier}
              accounts={accountsByTier[tier]}
              totalNzd={tierTotals[tier]}
              snapshotsByAccount={snapshotsByAccount}
              onInspectAccount={handleInspectAccount}
            />
          ))}
        </div>
      )}

      <LoansTracker
        summary={loansSummary}
        onChanged={() => {
          void loadAccountsAndSnapshots();
          onRefreshRunway?.();
        }}
      />

      <BalanceValuationHistoryCard
        accounts={accounts}
        snapshotsByAccount={snapshotsByAccount}
        onInspectAccount={handleInspectAccount}
        onRecordSnapshot={() => handleOpenRecordSnapshot()}
      />

      <AccountInspectionModal
        isOpen={isAccountModalOpen}
        onClose={() => setIsAccountModalOpen(false)}
        account={inspectingAccount}
        period={period}
        onPeriodChange={setPeriod}
        startDate={startDate}
        endDate={endDate}
        onStartDateChange={setStartDate}
        onEndDateChange={setEndDate}
        onTransactionCategoryChanged={loadAccountsAndSnapshots}
        onRecordSnapshotClick={() => {
          setIsAccountModalOpen(false);
          if (inspectingAccount) {
            handleOpenRecordSnapshot(inspectingAccount);
          }
        }}
        latestBalance={
          inspectingAccount ? getAccountLatestNativeBalance(inspectingAccount.id) : totalPortfolioBalance
        }
      />

      <RecordSnapshotModal
        isOpen={isSnapshotModalOpen}
        onClose={() => setIsSnapshotModalOpen(false)}
        accounts={accounts}
        initialAccountId={snapshotInitialAccountId}
        getAccountLatestBalance={getAccountLatestBalance}
        onSnapshotSaved={handleSnapshotSaved}
        onError={setError}
      />
    </div>
  );
};
