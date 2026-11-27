import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { EmptyState, getDefaultCustomRange, LoadingState } from '@yggdrasil-lab/ui';
import { TIER_ORDER, isRevolvingCreditAccount } from '../taxonomy';
import {
  fetchAccounts,
  fetchAccountSnapshots,
  fetchLoans,
  syncAllIntegrations,
} from '../transport';
import { Account, AssetSnapshot, LoansSummaryResponse, PeriodType, SyncResult } from '../types';
import { buildCreditBackstopSummary } from '../utils/creditBackstop';
import { AccountInspectionModal } from './AccountInspectionModal';
import { AccountTierSection } from './AccountTierSection';
import { BalanceValuationHistoryCard } from './accounts/BalanceValuationHistoryCard';
import { CreditBackstopSection } from './accounts/CreditBackstopSection';
import { EditAccountModal } from './accounts/EditAccountModal';
import { PortfolioNetWorthHero } from './accounts/PortfolioNetWorthHero';
import { LoansTracker } from './LoansTracker';
import { RecordSnapshotModal } from './RecordSnapshotModal';

interface AccountViewProps {
  onRefreshRunway?: () => void;
  initialAccountId?: number | null;
}

async function fetchSnapshotMap(accs: Account[]): Promise<Record<number, AssetSnapshot[]>> {
  const entries = await Promise.all(
    accs.map(async (acc) => {
      try {
        const snaps = await fetchAccountSnapshots(acc.id, 12);
        return [acc.id, snaps] as const;
      } catch {
        return [acc.id, [] as AssetSnapshot[]] as const;
      }
    })
  );
  const map: Record<number, AssetSnapshot[]> = {};
  for (const [accId, snaps] of entries) map[accId] = snaps;
  return map;
}

function useAccountPortfolioData(initialAccountId: number | null) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [snapshotsByAccount, setSnapshotsByAccount] = useState<Record<number, AssetSnapshot[]>>({});
  const [loansSummary, setLoansSummary] = useState<LoansSummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [initialMatch, setInitialMatch] = useState<Account | null>(null);
  const hasLoadedRef = useRef(false);

  const reload = useCallback(async () => {
    if (!hasLoadedRef.current) setLoading(true);
    setError(null);
    try {
      const [accs, loans] = await Promise.all([fetchAccounts(), fetchLoans().catch(() => null)]);
      setAccounts(accs);
      setLoansSummary(loans);
      setSnapshotsByAccount(await fetchSnapshotMap(accs));
      hasLoadedRef.current = true;
      if (initialAccountId !== null) {
        const found = accs.find((a) => a.id === initialAccountId);
        if (found) setInitialMatch(found);
      }
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to load accounts');
    } finally {
      setLoading(false);
    }
  }, [initialAccountId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { accounts, snapshotsByAccount, setSnapshotsByAccount, loansSummary, loading, error, setError, initialMatch, reload };
}

function computeTierBalances(accounts: Account[], snapshotsByAccount: Record<number, AssetSnapshot[]>) {
  const byTier = {
    cash: accounts.filter((a) => a.tier === 'cash'),
    growth: accounts.filter((a) => a.tier === 'growth'),
    locked: accounts.filter((a) => a.tier === 'locked'),
  };
  const nzdOf = (id: number) => {
    const snaps = snapshotsByAccount[id];
    return snaps && snaps.length > 0 ? snaps[0].balance_nzd : 0;
  };
  const tierTotals = {
    cash: byTier.cash.reduce((sum, a) => sum + nzdOf(a.id), 0),
    growth: byTier.growth.reduce((sum, a) => sum + nzdOf(a.id), 0),
    locked: byTier.locked.reduce((sum, a) => sum + nzdOf(a.id), 0),
  };
  return { byTier, tierTotals, totalPortfolioBalance: tierTotals.cash + tierTotals.growth + tierTotals.locked };
}

function useAccountSyncAction(opts: {
  setError: (msg: string | null) => void;
  setSuccessNote: (msg: string | null) => void;
  setSyncSummary: (res: SyncResult | null) => void;
  reload: () => Promise<void>;
  onRefreshRunway?: () => void;
}) {
  const { setError, setSuccessNote, setSyncSummary, reload, onRefreshRunway } = opts;
  const [syncing, setSyncing] = useState(false);

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
      await reload();
      onRefreshRunway?.();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to sync connected accounts');
    } finally {
      setSyncing(false);
    }
  };

  return { syncing, handleSyncNow };
}

function useAccountModalSelection(opts: {
  accounts: Account[];
  snapshotsByAccount: Record<number, AssetSnapshot[]>;
  initialMatch: Account | null;
  setPeriod: (p: PeriodType) => void;
  setSnapshotsByAccount: React.Dispatch<React.SetStateAction<Record<number, AssetSnapshot[]>>>;
  setError: (msg: string | null) => void;
  onRefreshRunway?: () => void;
}) {
  const { accounts, snapshotsByAccount, initialMatch, setPeriod, setSnapshotsByAccount, setError, onRefreshRunway } = opts;
  const [successNote, setSuccessNote] = useState<string | null>(null);
  const [syncSummary, setSyncSummary] = useState<SyncResult | null>(null);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [inspectingAccount, setInspectingAccount] = useState<Account | null>(null);
  const [isSnapshotModalOpen, setIsSnapshotModalOpen] = useState(false);
  const [snapshotInitialAccountId, setSnapshotInitialAccountId] = useState<number | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);

  useEffect(() => {
    if (initialMatch) {
      setInspectingAccount(initialMatch);
      setIsAccountModalOpen(true);
    }
  }, [initialMatch]);

  const resolvedInspectingAccount = inspectingAccount
    ? accounts.find((a) => a.id === inspectingAccount.id) ?? inspectingAccount
    : null;
  const resolvedEditingAccount = editingAccount
    ? accounts.find((a) => a.id === editingAccount.id) ?? editingAccount
    : null;

  const getNativeBalance = useCallback(
    (accountId: number) => {
      const snaps = snapshotsByAccount[accountId];
      return snaps && snaps.length > 0 ? Number(snaps[0].balance ?? snaps[0].balance_nzd) : 0;
    },
    [snapshotsByAccount]
  );

  const handleInspectAccount = (account: Account | null) => {
    if (account && (account.account_type === 'crypto' || account.currency.toUpperCase() === 'BTC')) setPeriod('all');
    setInspectingAccount(account);
    setIsAccountModalOpen(true);
  };

  const handleOpenRecordSnapshot = (account?: Account) => {
    setError(null);
    setSnapshotInitialAccountId((account || accounts[0])?.id ?? null);
    setIsSnapshotModalOpen(true);
  };

  const handleOpenEditAccount = (account: Account) => {
    setError(null);
    setEditingAccount(account);
    setIsEditModalOpen(true);
  };

  const handleSnapshotSaved = (accountId: number, updatedSnaps: AssetSnapshot[], accountName: string) => {
    setSnapshotsByAccount((prev) => ({ ...prev, [accountId]: updatedSnaps }));
    setSyncSummary(null);
    setSuccessNote(`Saved valuation snapshot for ${accountName}`);
    setTimeout(() => setSuccessNote(null), 4000);
    onRefreshRunway?.();
  };

  return {
    successNote, setSuccessNote, syncSummary, setSyncSummary,
    isAccountModalOpen, setIsAccountModalOpen, resolvedInspectingAccount,
    isSnapshotModalOpen, setIsSnapshotModalOpen, snapshotInitialAccountId,
    isEditModalOpen, setIsEditModalOpen, resolvedEditingAccount,
    getNativeBalance, handleInspectAccount, handleOpenRecordSnapshot, handleOpenEditAccount, handleSnapshotSaved,
  };
}

interface AccountViewModalsProps {
  accounts: Account[];
  totalPortfolioBalance: number;
  period: PeriodType;
  setPeriod: (p: PeriodType) => void;
  startDate: string;
  setStartDate: (d: string) => void;
  endDate: string;
  setEndDate: (d: string) => void;
  sel: ReturnType<typeof useAccountModalSelection>;
  onReload: () => Promise<void>;
  onError: (msg: string | null) => void;
  onRefreshRunway?: () => void;
}

const AccountViewModals: React.FC<AccountViewModalsProps> = ({
  accounts, totalPortfolioBalance, period, setPeriod, startDate, setStartDate, endDate, setEndDate,
  sel, onReload, onError, onRefreshRunway,
}) => (
  <>
    <AccountInspectionModal
      isOpen={sel.isAccountModalOpen} onClose={() => sel.setIsAccountModalOpen(false)}
      account={sel.resolvedInspectingAccount} accounts={accounts}
      period={period} onPeriodChange={setPeriod} startDate={startDate} endDate={endDate}
      onStartDateChange={setStartDate} onEndDateChange={setEndDate} onTransactionCategoryChanged={onReload}
      onRecordSnapshotClick={() => {
        sel.setIsAccountModalOpen(false);
        if (sel.resolvedInspectingAccount) sel.handleOpenRecordSnapshot(sel.resolvedInspectingAccount);
      }}
      onEditAccountClick={() => {
        sel.setIsAccountModalOpen(false);
        if (sel.resolvedInspectingAccount) sel.handleOpenEditAccount(sel.resolvedInspectingAccount);
      }}
      latestBalance={sel.resolvedInspectingAccount ? sel.getNativeBalance(sel.resolvedInspectingAccount.id) : totalPortfolioBalance}
    />
    <RecordSnapshotModal
      isOpen={sel.isSnapshotModalOpen} onClose={() => sel.setIsSnapshotModalOpen(false)}
      accounts={accounts} initialAccountId={sel.snapshotInitialAccountId}
      getAccountLatestBalance={sel.getNativeBalance} onSnapshotSaved={sel.handleSnapshotSaved} onError={onError}
    />
    <EditAccountModal
      isOpen={sel.isEditModalOpen} onClose={() => sel.setIsEditModalOpen(false)}
      account={sel.resolvedEditingAccount}
      onSaved={async (updated) => {
        await onReload();
        sel.setSuccessNote(`Updated account settings for ${updated.name}`);
        setTimeout(() => sel.setSuccessNote(null), 4000);
        onRefreshRunway?.();
      }}
    />
  </>
);

/**
 * Portfolio allocation overview, tier-grouped account cards, valuation
 * history checkpoints, and per-account ledger inspection.
 */
export const AccountView: React.FC<AccountViewProps> = ({
  onRefreshRunway,
  initialAccountId = null,
}) => {
  const defaultRange = useMemo(() => getDefaultCustomRange(), []);
  const [period, setPeriod] = useState<PeriodType>('month');
  const [startDate, setStartDate] = useState(defaultRange.startDate);
  const [endDate, setEndDate] = useState(defaultRange.endDate);
  const data = useAccountPortfolioData(initialAccountId);
  const { byTier, tierTotals, totalPortfolioBalance } = useMemo(
    () => computeTierBalances(data.accounts, data.snapshotsByAccount),
    [data.accounts, data.snapshotsByAccount]
  );
  const creditBackstopSummary = useMemo(
    () => buildCreditBackstopSummary(data.accounts, data.snapshotsByAccount),
    [data.accounts, data.snapshotsByAccount]
  );
  const sel = useAccountModalSelection({
    accounts: data.accounts, snapshotsByAccount: data.snapshotsByAccount, initialMatch: data.initialMatch,
    setPeriod, setSnapshotsByAccount: data.setSnapshotsByAccount, setError: data.setError, onRefreshRunway,
  });
  const { syncing, handleSyncNow } = useAccountSyncAction({
    setError: data.setError, setSuccessNote: sel.setSuccessNote,
    setSyncSummary: sel.setSyncSummary, reload: data.reload, onRefreshRunway,
  });

  return (
    <div className="space-y-6" data-testid="per-account-view">
      <PortfolioNetWorthHero
        accountCount={data.accounts.length} tierTotals={tierTotals} totalPortfolioBalance={totalPortfolioBalance}
        totalLiabilities={data.loansSummary?.total_liabilities ?? 0} period={period} onPeriodChange={setPeriod}
        startDate={startDate} endDate={endDate} onStartDateChange={setStartDate} onEndDateChange={setEndDate}
        syncing={syncing} error={data.error} successNote={sel.successNote} syncSummary={sel.syncSummary}
        onSyncNow={handleSyncNow} onRecordSnapshot={() => sel.handleOpenRecordSnapshot()}
        onInspectAllAccounts={() => sel.handleInspectAccount(null)}
      />
      {data.loading ? (
        <LoadingState label="Loading accounts and valuation checkpoints..." variant="brand" />
      ) : data.accounts.length === 0 ? (
        <EmptyState title="No accounts configured yet" description="Ingest bank statements or seed test data to populate your freedom tier portfolio." variant="dashed" />
      ) : (
        <div className="space-y-6" data-testid="account-selector-grid">
          {TIER_ORDER.map((tier) => (
            <AccountTierSection
              key={tier} tier={tier} accounts={byTier[tier].filter((a) => !isRevolvingCreditAccount(a.account_type))}
              totalNzd={tierTotals[tier]} creditOwedNzd={tier === 'cash' ? creditBackstopSummary.totalOwedNzd : 0}
              snapshotsByAccount={data.snapshotsByAccount} onInspectAccount={sel.handleInspectAccount}
            />
          ))}
          <CreditBackstopSection summary={creditBackstopSummary} onInspectAccount={sel.handleInspectAccount} onEditAccount={sel.handleOpenEditAccount} />
        </div>
      )}
      <LoansTracker summary={data.loansSummary} onChanged={() => { void data.reload(); onRefreshRunway?.(); }} />
      <BalanceValuationHistoryCard accounts={data.accounts} snapshotsByAccount={data.snapshotsByAccount} onInspectAccount={sel.handleInspectAccount} onRecordSnapshot={() => sel.handleOpenRecordSnapshot()} />
      <AccountViewModals
        accounts={data.accounts} totalPortfolioBalance={totalPortfolioBalance}
        period={period} setPeriod={setPeriod} startDate={startDate} setStartDate={setStartDate}
        endDate={endDate} setEndDate={setEndDate} sel={sel}
        onReload={data.reload} onError={data.setError} onRefreshRunway={onRefreshRunway}
      />
    </div>
  );
};
