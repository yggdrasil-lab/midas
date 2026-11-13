import React, { useEffect, useMemo, useState } from 'react';
import {
  Landmark,
  Building2,
  TrendingUp,
  Lock,
  ShieldCheck,
  History,
  Calendar,
  PlusCircle,
  Check,
  ChevronRight,
  PieChart,
} from 'lucide-react';
import {
  GlassCard,
  Button,
  AlertBanner,
  Modal,
  SegmentedControl,
  SegmentedControlOption,
  SelectableCard,
  StatusBadge,
} from '@yggdrasil-lab/ui';
import {
  Account,
  AssetSnapshot,
  PeriodType,
} from '../types';
import {
  fetchAccounts,
  fetchAccountSnapshots,
  recordAccountSnapshot,
} from '../services/api';
import { AccountInspectionModal } from './AccountInspectionModal';

interface AccountViewProps {
  onRefreshRunway?: () => void;
  initialAccountId?: number | null;
}

const PERIOD_OPTIONS: SegmentedControlOption<PeriodType>[] = [
  { id: 'month', label: 'This Month' },
  { id: 'week', label: 'This Week' },
  { id: 'last_month', label: 'Last Month' },
  { id: 'all', label: 'All Time' },
];

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

  // Account Inspection Popup Modal
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [inspectingAccount, setInspectingAccount] = useState<Account | null>(null);

  // Snapshot recording modal state
  const [isSnapshotModalOpen, setIsSnapshotModalOpen] = useState(false);
  const [snapshotAccountId, setSnapshotAccountId] = useState<number | null>(null);
  const [snapshotBalance, setSnapshotBalance] = useState('');
  const [snapshotDate, setSnapshotDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [snapshotNotes, setSnapshotNotes] = useState('');
  const [savingSnapshot, setSavingSnapshot] = useState(false);

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

  const getAccountLatestBalance = (accountId: number): number => {
    const snaps = snapshotsByAccount[accountId];
    if (!snaps || snaps.length === 0) return 0;
    return snaps[0].balance_nzd;
  };

  const getAccountLatestNativeBalance = (accountId: number): number => {
    const snaps = snapshotsByAccount[accountId];
    if (!snaps || snaps.length === 0) return 0;
    return Number(snaps[0].balance ?? snaps[0].balance_nzd);
  };

  const getAccountBalanceDelta = (accountId: number): number | null => {
    const snaps = snapshotsByAccount[accountId];
    if (!snaps || snaps.length < 2) return null;
    return snaps[0].balance_nzd - snaps[1].balance_nzd;
  };

  // Group accounts by tier
  const cashAccounts = useMemo(() => accounts.filter((a) => a.tier === 'cash'), [accounts]);
  const growthAccounts = useMemo(() => accounts.filter((a) => a.tier === 'growth'), [accounts]);
  const lockedAccounts = useMemo(() => accounts.filter((a) => a.tier === 'locked'), [accounts]);

  const cashTotal = useMemo(
    () => cashAccounts.reduce((sum, a) => sum + getAccountLatestBalance(a.id), 0),
    [cashAccounts, snapshotsByAccount]
  );
  const growthTotal = useMemo(
    () => growthAccounts.reduce((sum, a) => sum + getAccountLatestBalance(a.id), 0),
    [growthAccounts, snapshotsByAccount]
  );
  const lockedTotal = useMemo(
    () => lockedAccounts.reduce((sum, a) => sum + getAccountLatestBalance(a.id), 0),
    [lockedAccounts, snapshotsByAccount]
  );

  const totalPortfolioBalance = cashTotal + growthTotal + lockedTotal;

  const cashPct = totalPortfolioBalance > 0 ? Math.round((cashTotal / totalPortfolioBalance) * 100) : 0;
  const growthPct = totalPortfolioBalance > 0 ? Math.round((growthTotal / totalPortfolioBalance) * 100) : 0;
  const lockedPct = totalPortfolioBalance > 0 ? Math.max(0, 100 - cashPct - growthPct) : 0;

  const handleInspectAccount = (account: Account | null) => {
    setInspectingAccount(account);
    setIsAccountModalOpen(true);
  };

  const handleOpenRecordSnapshot = (account?: Account) => {
    const targetAccount = account || accounts[0];
    if (targetAccount) {
      setSnapshotAccountId(targetAccount.id);
      setSnapshotBalance(String(getAccountLatestBalance(targetAccount.id) || ''));
    }
    setSnapshotDate(new Date().toISOString().split('T')[0]);
    setSnapshotNotes('');
    setIsSnapshotModalOpen(true);
  };

  const handleSaveSnapshot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!snapshotAccountId) return;
    const balanceNum = parseFloat(snapshotBalance);
    if (isNaN(balanceNum)) {
      setError('Please enter a valid numeric balance amount');
      return;
    }

    setSavingSnapshot(true);
    setError(null);
    try {
      const targetAcc = accounts.find((a) => a.id === snapshotAccountId);
      await recordAccountSnapshot(snapshotAccountId, {
        account_id: snapshotAccountId,
        balance: balanceNum,
        snapshot_date: snapshotDate,
        currency: targetAcc?.currency || 'NZD',
        exchange_rate: targetAcc?.currency === 'NZD' ? 1.0 : undefined,
        source: 'manual',
        notes: snapshotNotes.trim() || undefined,
      });

      const updatedSnaps = await fetchAccountSnapshots(snapshotAccountId, 12);
      setSnapshotsByAccount((prev) => ({
        ...prev,
        [snapshotAccountId]: updatedSnaps,
      }));

      setSuccessNote(`Saved valuation snapshot for ${targetAcc?.name || 'account'}`);
      setTimeout(() => setSuccessNote(null), 4000);
      setIsSnapshotModalOpen(false);

      if (onRefreshRunway) {
        onRefreshRunway();
      }
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to record balance snapshot');
    } finally {
      setSavingSnapshot(false);
    }
  };

  const getTierBadgeProps = (tier: string) => {
    switch (tier) {
      case 'cash':
        return { label: 'Cash Floor', variant: 'info' as const, icon: <ShieldCheck className="w-3 h-3 mr-1" /> };
      case 'growth':
        return { label: 'Growth', variant: 'success' as const, icon: <TrendingUp className="w-3 h-3 mr-1" /> };
      case 'locked':
        return { label: 'Locked', variant: 'warning' as const, icon: <Lock className="w-3 h-3 mr-1" /> };
      default:
        return { label: tier, variant: 'idle' as const };
    }
  };

  return (
    <div className="space-y-6" data-testid="per-account-view">
      {/* 1. Portfolio Net Worth & Asset Allocation Hero */}
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

        {/* Total Net Worth + Allocation Visual Bar */}
        <div className="p-4 rounded-xl bg-background/50 border border-border/70 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
            <div>
              <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                Total Portfolio Net Worth
              </div>
              <div className="text-2xl sm:text-3xl font-extrabold text-slate-100 font-mono tracking-tight">
                ${Math.round(totalPortfolioBalance).toLocaleString('en-NZ')}
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

          {/* 3-Tier Allocation Bar */}
          <div className="w-full h-3 bg-slate-900 rounded-full overflow-hidden flex border border-border/80">
            <div
              style={{ width: `${cashPct}%` }}
              className="h-full bg-sky-500 transition-all duration-300"
              title={`Cash Floor: ${cashPct}%`}
            />
            <div
              style={{ width: `${growthPct}%` }}
              className="h-full bg-emerald-500 transition-all duration-300"
              title={`Growth Assets: ${growthPct}%`}
            />
            <div
              style={{ width: `${lockedPct}%` }}
              className="h-full bg-amber-500 transition-all duration-300"
              title={`Locked Reserve: ${lockedPct}%`}
            />
          </div>

          {/* Allocation Legend */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-xs">
            <div className="flex items-center justify-between p-2 rounded-lg bg-sky-500/5 border border-sky-500/20">
              <span className="flex items-center gap-2 text-slate-300">
                <span className="w-2 h-2 rounded-full bg-sky-400" />
                <span>Tier 1 (Cash Floor)</span>
              </span>
              <span className="font-mono font-semibold text-sky-300">
                ${Math.round(cashTotal).toLocaleString('en-NZ')} ({cashPct}%)
              </span>
            </div>
            <div className="flex items-center justify-between p-2 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
              <span className="flex items-center gap-2 text-slate-300">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span>Tier 2 (Growth)</span>
              </span>
              <span className="font-mono font-semibold text-emerald-300">
                ${Math.round(growthTotal).toLocaleString('en-NZ')} ({growthPct}%)
              </span>
            </div>
            <div className="flex items-center justify-between p-2 rounded-lg bg-amber-500/5 border border-amber-500/20">
              <span className="flex items-center gap-2 text-slate-300">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                <span>Tier 3 (Locked)</span>
              </span>
              <span className="font-mono font-semibold text-amber-300">
                ${Math.round(lockedTotal).toLocaleString('en-NZ')} ({lockedPct}%)
              </span>
            </div>
          </div>
        </div>

        {/* 2. All Accounts Combined Ledger Inspection Card */}
        <div className="pt-1">
          <SelectableCard
            data-testid="account-card-all"
            onClick={() => handleInspectAccount(null)}
            isSelected={false}
            title="All Accounts Combined Ledger"
            icon={<Building2 className="w-4 h-4 text-amber-400" />}
            badge={<StatusBadge label={`${accounts.length} active`} variant="idle" />}
            value={`$${Math.round(totalPortfolioBalance).toLocaleString('en-NZ')}`}
            valueSuffix="NZD"
            subtitle="Combined ledger across all institutions • Tap to search, inspect transactions, and configure rules"
            subvalue="Inspect Combined Ledger →"
            subvalueTrend="positive"
            variant="amber"
          />
        </div>
      </GlassCard>

      {/* 3. Tier-Grouped Account Sections */}
      {loading ? (
        <div className="flex items-center justify-center py-12 text-slate-400 text-xs">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-amber-400 mr-2" />
          Loading accounts and valuation checkpoints...
        </div>
      ) : (
        <div className="space-y-6" data-testid="account-selector-grid">
          {/* Group 1: Tier 1 - Cash Floor */}
          {cashAccounts.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center space-x-2">
                  <div className="p-1 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20">
                    <ShieldCheck className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                      Tier 1: Cash Floor (Liquid Reserves)
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Checking accounts and emergency cash covering immediate living expenses
                    </p>
                  </div>
                </div>
                <div className="font-mono font-semibold text-xs text-sky-300">
                  ${Math.round(cashTotal).toLocaleString('en-NZ')} NZD
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {cashAccounts.map((acc) => {
                  const balance = getAccountLatestNativeBalance(acc.id);
                  const delta = getAccountBalanceDelta(acc.id);
                  const tierBadge = getTierBadgeProps(acc.tier);
                  const latestSnap = snapshotsByAccount[acc.id]?.[0];

                  return (
                    <SelectableCard
                      key={acc.id}
                      data-testid={`account-card-${acc.id}`}
                      onClick={() => handleInspectAccount(acc)}
                      isSelected={false}
                      title={acc.name}
                      badge={
                        <StatusBadge
                          label={tierBadge.label}
                          variant={tierBadge.variant}
                          icon={tierBadge.icon}
                        />
                      }
                      value={`$${Math.round(balance).toLocaleString('en-NZ')}`}
                      valueSuffix={acc.currency || 'NZD'}
                      subtitle={`${acc.institution} • ${acc.account_type.replace('_', ' ')}`}
                      subvalue={
                        delta !== null && delta !== 0
                          ? `${delta > 0 ? '+' : '-'}$${Math.abs(Math.round(delta)).toLocaleString('en-NZ')}`
                          : latestSnap
                          ? latestSnap.snapshot_date
                          : 'Inspect Ledger →'
                      }
                      subvalueTrend={
                        delta !== null && delta !== 0
                          ? delta > 0
                            ? 'positive'
                            : 'negative'
                          : 'neutral'
                      }
                      variant="blue"
                    />
                  );
                })}
              </div>
            </div>
          )}

          {/* Group 2: Tier 2 - Growth Assets */}
          {growthAccounts.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center space-x-2">
                  <div className="p-1 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <TrendingUp className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                      Tier 2: Growth Assets (Compounding Investments)
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Brokerage, index funds, stocks, and crypto generating compounding returns
                    </p>
                  </div>
                </div>
                <div className="font-mono font-semibold text-xs text-emerald-300">
                  ${Math.round(growthTotal).toLocaleString('en-NZ')} NZD
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {growthAccounts.map((acc) => {
                  const balance = getAccountLatestNativeBalance(acc.id);
                  const delta = getAccountBalanceDelta(acc.id);
                  const tierBadge = getTierBadgeProps(acc.tier);
                  const latestSnap = snapshotsByAccount[acc.id]?.[0];

                  return (
                    <SelectableCard
                      key={acc.id}
                      data-testid={`account-card-${acc.id}`}
                      onClick={() => handleInspectAccount(acc)}
                      isSelected={false}
                      title={acc.name}
                      badge={
                        <StatusBadge
                          label={tierBadge.label}
                          variant={tierBadge.variant}
                          icon={tierBadge.icon}
                        />
                      }
                      value={`$${Math.round(balance).toLocaleString('en-NZ')}`}
                      valueSuffix={acc.currency || 'NZD'}
                      subtitle={`${acc.institution} • ${acc.account_type.replace('_', ' ')}${
                        acc.expected_annual_return > 0
                          ? ` • ${(acc.expected_annual_return * 100).toFixed(1)}% p.a.`
                          : ''
                      }`}
                      subvalue={
                        delta !== null && delta !== 0
                          ? `${delta > 0 ? '+' : '-'}$${Math.abs(Math.round(delta)).toLocaleString('en-NZ')}`
                          : latestSnap
                          ? latestSnap.snapshot_date
                          : 'Inspect Ledger →'
                      }
                      subvalueTrend={
                        delta !== null && delta !== 0
                          ? delta > 0
                            ? 'positive'
                            : 'negative'
                          : 'neutral'
                      }
                      variant="emerald"
                    />
                  );
                })}
              </div>
            </div>
          )}

          {/* Group 3: Tier 3 - Locked Reserve */}
          {lockedAccounts.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center space-x-2">
                  <div className="p-1 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    <Lock className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                      Tier 3: Locked Reserve (Preserved Capital)
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      KiwiSaver and restricted retirement funds preserved until maturity
                    </p>
                  </div>
                </div>
                <div className="font-mono font-semibold text-xs text-amber-300">
                  ${Math.round(lockedTotal).toLocaleString('en-NZ')} NZD
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {lockedAccounts.map((acc) => {
                  const balance = getAccountLatestNativeBalance(acc.id);
                  const delta = getAccountBalanceDelta(acc.id);
                  const tierBadge = getTierBadgeProps(acc.tier);
                  const latestSnap = snapshotsByAccount[acc.id]?.[0];

                  return (
                    <SelectableCard
                      key={acc.id}
                      data-testid={`account-card-${acc.id}`}
                      onClick={() => handleInspectAccount(acc)}
                      isSelected={false}
                      title={acc.name}
                      badge={
                        <StatusBadge
                          label={tierBadge.label}
                          variant={tierBadge.variant}
                          icon={tierBadge.icon}
                        />
                      }
                      value={`$${Math.round(balance).toLocaleString('en-NZ')}`}
                      valueSuffix={acc.currency || 'NZD'}
                      subtitle={`${acc.institution} • ${acc.account_type.replace('_', ' ')}`}
                      subvalue={
                        delta !== null && delta !== 0
                          ? `${delta > 0 ? '+' : '-'}$${Math.abs(Math.round(delta)).toLocaleString('en-NZ')}`
                          : latestSnap
                          ? latestSnap.snapshot_date
                          : 'Inspect Ledger →'
                      }
                      subvalueTrend={
                        delta !== null && delta !== 0
                          ? delta > 0
                            ? 'positive'
                            : 'negative'
                          : 'neutral'
                      }
                      variant="amber"
                    />
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 4. Compact Balance Valuation Checkpoints */}
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
                    ${Math.round(latest?.balance ?? latest?.balance_nzd ?? 0).toLocaleString('en-NZ')} {acc.currency || 'NZD'}
                  </span>
                </div>
                {delta !== null && delta !== 0 && (
                  <div
                    className={`text-[10px] font-mono ${
                      delta > 0 ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {delta > 0 ? '+' : '-'}${Math.abs(Math.round(delta)).toLocaleString('en-NZ')} vs prior snapshot
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </GlassCard>

      {/* 5. Account Inspection Modal (Budgets-style consistency) */}
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

      {/* 6. Record Valuation Snapshot Modal */}
      <Modal
        isOpen={isSnapshotModalOpen}
        onClose={() => setIsSnapshotModalOpen(false)}
        title={
          snapshotAccountId
            ? `Record Balance Valuation Snapshot: ${
                accounts.find((a) => a.id === snapshotAccountId)?.name || 'Account'
              }`
            : 'Record Balance Valuation Snapshot'
        }
      >
        <form onSubmit={handleSaveSnapshot} className="space-y-4 pt-2">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Select Account
            </label>
            <select
              value={snapshotAccountId || ''}
              onChange={(e) => {
                const accId = parseInt(e.target.value, 10);
                setSnapshotAccountId(accId);
                setSnapshotBalance(String(getAccountLatestBalance(accId) || ''));
              }}
              className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
            >
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.name} ({acc.institution} • {acc.currency})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Snapshot Date
            </label>
            <input
              type="date"
              value={snapshotDate}
              onChange={(e) => setSnapshotDate(e.target.value)}
              className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Closing Balance ({accounts.find((a) => a.id === snapshotAccountId)?.currency || 'NZD'})
            </label>
            <input
              type="number"
              step="any"
              value={snapshotBalance}
              onChange={(e) => setSnapshotBalance(e.target.value)}
              placeholder="0.00"
              className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500 font-mono"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Notes (Optional)
            </label>
            <input
              type="text"
              value={snapshotNotes}
              onChange={(e) => setSnapshotNotes(e.target.value)}
              placeholder="e.g. Monthly statement reconciliation"
              className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="flex items-center justify-end space-x-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsSnapshotModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="amber"
              size="sm"
              loading={savingSnapshot}
            >
              Confirm & Save Valuation
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
