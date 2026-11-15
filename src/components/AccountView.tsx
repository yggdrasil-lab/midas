import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Building2,
  Calendar,
  Check,
  ChevronRight,
  History,
  Landmark,
  PieChart,
  PlusCircle,
} from 'lucide-react';
import {
  AlertBanner,
  Button,
  EmptyState,
  GlassCard,
  LoadingState,
  MultiSegmentBar,
  SegmentedControl,
  SelectableCard,
  StatusBadge,
} from '@yggdrasil-lab/ui';
import { PERIOD_OPTIONS } from '../constants/categories';
import { fetchAccounts, fetchAccountSnapshots } from '../services/api';
import { Account, AssetSnapshot, PeriodType } from '../types';
import { formatMoney } from '../utils/format';
import { AccountInspectionModal } from './AccountInspectionModal';
import { AccountTierSection } from './AccountTierSection';
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
  const [period, setPeriod] = useState<PeriodType>('month');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successNote, setSuccessNote] = useState<string | null>(null);

  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [inspectingAccount, setInspectingAccount] = useState<Account | null>(null);
  const [isSnapshotModalOpen, setIsSnapshotModalOpen] = useState(false);
  const [snapshotInitialAccountId, setSnapshotInitialAccountId] = useState<number | null>(null);

  const loadAccountsAndSnapshots = async () => {
    setLoading(true);
    setError(null);
    try {
      const accs = await fetchAccounts();
      setAccounts(accs);

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

  const getAccountBalanceDelta = (accountId: number): number | null => {
    const snaps = snapshotsByAccount[accountId];
    if (!snaps || snaps.length < 2) return null;
    return snaps[0].balance_nzd - snaps[1].balance_nzd;
  };

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
  const pctOfPortfolio = (val: number) =>
    totalPortfolioBalance > 0 ? Math.round((val / totalPortfolioBalance) * 100) : 0;

  const cashPct = pctOfPortfolio(tierTotals.cash);
  const growthPct = pctOfPortfolio(tierTotals.growth);
  const lockedPct = totalPortfolioBalance > 0 ? Math.max(0, 100 - cashPct - growthPct) : 0;

  const handleInspectAccount = (account: Account | null) => {
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
    setSuccessNote(`Saved valuation snapshot for ${accountName}`);
    setTimeout(() => setSuccessNote(null), 4000);
    onRefreshRunway?.();
  };

  return (
    <div className="space-y-6" data-testid="per-account-view">
      {/* Portfolio Net Worth & Asset Allocation Hero */}
      <GlassCard className="space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Landmark className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100 tracking-wide uppercase">
                Accounts & Per-Account Ledger
              </h2>
              <p className="text-xs text-slate-400">
                Portfolio Allocation across 3 Freedom Tiers • Tap any account to inspect its ledger
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <SegmentedControl
              options={PERIOD_OPTIONS}
              value={period}
              onChange={setPeriod}
              variant="amber"
              size="xs"
              idPrefix="account-period"
            />
            <Button
              variant="amber"
              size="xs"
              icon={<PlusCircle className="w-3.5 h-3.5" />}
              onClick={() => handleOpenRecordSnapshot()}
              data-testid="record-snapshot-btn"
            >
              Record Valuation Snapshot
            </Button>
          </div>
        </div>

        {error && (
          <AlertBanner variant="error" title="Account Error">
            {error}
          </AlertBanner>
        )}

        {successNote && (
          <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-xs text-emerald-300 flex items-center space-x-2 animate-in fade-in">
            <Check className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
            <span>{successNote}</span>
          </div>
        )}

        <div className="p-4 rounded-xl bg-background/50 border border-border/70 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
            <div>
              <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                Total Portfolio Net Worth
              </div>
              <div className="text-2xl sm:text-3xl font-extrabold text-slate-100 font-mono tracking-tight">
                {formatMoney(totalPortfolioBalance)}
                <span className="text-sm font-sans font-medium text-slate-400 ml-2">NZD</span>
              </div>
            </div>
            <div className="text-xs text-slate-400 flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800/80 border border-border">
                <PieChart className="w-3 h-3 text-amber-400" />
                {accounts.length} Active Accounts
              </span>
            </div>
          </div>

          <MultiSegmentBar
            heightClass="h-3"
            segments={[
              {
                id: 'cash',
                label: 'Tier 1 (Cash Floor)',
                value: tierTotals.cash,
                barColor: 'bg-sky-500',
                dotColor: 'bg-sky-400',
                textColor: 'text-sky-300',
                valueLabel: `${formatMoney(tierTotals.cash)} (${cashPct}%)`,
                minVisiblePct: 0,
              },
              {
                id: 'growth',
                label: 'Tier 2 (Growth)',
                value: tierTotals.growth,
                barColor: 'bg-emerald-500',
                dotColor: 'bg-emerald-400',
                textColor: 'text-emerald-300',
                valueLabel: `${formatMoney(tierTotals.growth)} (${growthPct}%)`,
                minVisiblePct: 0,
              },
              {
                id: 'locked',
                label: 'Tier 3 (Locked)',
                value: tierTotals.locked,
                barColor: 'bg-amber-500',
                dotColor: 'bg-amber-400',
                textColor: 'text-amber-300',
                valueLabel: `${formatMoney(tierTotals.locked)} (${lockedPct}%)`,
                minVisiblePct: 0,
              },
            ]}
          />
        </div>

        <div className="pt-1">
          <SelectableCard
            data-testid="account-card-all"
            onClick={() => handleInspectAccount(null)}
            isSelected={false}
            title="All Accounts Combined Ledger"
            icon={<Building2 className="w-4 h-4 text-amber-400" />}
            badge={<StatusBadge label={`${accounts.length} active`} variant="idle" />}
            value={formatMoney(totalPortfolioBalance)}
            valueSuffix="NZD"
            subtitle="Combined ledger across all institutions • Tap to search, inspect transactions, and configure rules"
            subvalue="Inspect Combined Ledger ->"
            subvalueTrend="positive"
            variant="amber"
          />
        </div>
      </GlassCard>

      {/* Tier-Grouped Account Sections */}
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

      {/* Balance Valuation Checkpoints */}
      <GlassCard className="space-y-4" data-testid="account-snapshots-panel">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <History className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-200">Balance Valuation History</h3>
              <p className="text-xs text-slate-400">
                Latest recorded valuation snapshots and net worth checkpoints across accounts
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="xs"
            icon={<PlusCircle className="w-3.5 h-3.5" />}
            onClick={() => handleOpenRecordSnapshot()}
          >
            Record Snapshot
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-1">
          {accounts.map((acc) => {
            const latest = snapshotsByAccount[acc.id]?.[0];
            const delta = getAccountBalanceDelta(acc.id);
            return (
              <div
                key={acc.id}
                onClick={() => handleInspectAccount(acc)}
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
                    {formatMoney(delta, { showPlusSign: true })} vs prior snapshot
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </GlassCard>

      <AccountInspectionModal
        isOpen={isAccountModalOpen}
        onClose={() => setIsAccountModalOpen(false)}
        account={inspectingAccount}
        period={period}
        onPeriodChange={setPeriod}
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
