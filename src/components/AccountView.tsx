import React, { useEffect, useMemo, useState } from 'react';
import {
  Landmark,
  Wallet,
  TrendingUp,
  Lock,
  ArrowUpRight,
  ArrowDownRight,
  ArrowRightLeft,
  Search,
  Check,
  PlusCircle,
  History,
  PieChart,
  Receipt as ReceiptIcon,
  Building2,
  Calendar,
  SlidersHorizontal,
  Layers,
} from 'lucide-react';
import {
  GlassCard,
  StatCard,
  StatusBadge,
  Button,
  AlertBanner,
  Modal,
  SegmentedControl,
  SegmentedControlOption,
  SelectableCard,
} from '@yggdrasil-lab/ui';
import {
  Account,
  AssetSnapshot,
  CategorizationRuleCreate,
  Transaction,
} from '../types';
import {
  fetchAccounts,
  fetchAccountSnapshots,
  fetchAccountTransactions,
  recordAccountSnapshot,
  updateTransactionCategory,
} from '../services/api';
import { AccountInspectionModal } from './AccountInspectionModal';
import { CategoryTransactionInspectionModal } from './CategoryTransactionInspectionModal';
import { RulesManagerModal } from './RulesManagerModal';

interface AccountViewProps {
  onRefreshRunway?: () => void;
  initialAccountId?: number | null;
}

const DEFAULT_CATEGORIES = [
  'Groceries',
  'Food',
  'Transport',
  'Utilities',
  'Health',
  'Leisure',
  'Insurance',
  'Travel',
  'Transfers',
  'Income',
  'General',
  'Housing',
  'Dining & Cafes',
  'Health & Fitness',
  'Entertainment',
  'Shopping',
  'Subscriptions',
  'Other',
];

const PERIOD_OPTIONS: SegmentedControlOption<'month' | 'week' | 'all'>[] = [
  { id: 'month', label: 'This Month' },
  { id: 'week', label: 'This Week' },
  { id: 'all', label: 'All Time' },
];

export const AccountView: React.FC<AccountViewProps> = ({
  onRefreshRunway,
  initialAccountId = null,
}) => {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(initialAccountId);
  const [snapshotsByAccount, setSnapshotsByAccount] = useState<Record<number, AssetSnapshot[]>>({});
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [period, setPeriod] = useState<'month' | 'week' | 'all'>('month');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [txLoading, setTxLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successNote, setSuccessNote] = useState<string | null>(null);
  const [savingTxId, setSavingTxId] = useState<number | null>(null);

  // Account Inspection Popup Modal (Budgets-style consistency)
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [inspectingAccount, setInspectingAccount] = useState<Account | null>(null);

  // Category Transaction Inspection Modal
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [inspectingCategory, setInspectingCategory] = useState<string | null>(null);

  // Rules Manager Modal state
  const [isRulesModalOpen, setIsRulesModalOpen] = useState(false);
  const [rulePrefill, setRulePrefill] = useState<Partial<CategorizationRuleCreate> | null>(null);

  // Snapshot recording modal state
  const [isSnapshotModalOpen, setIsSnapshotModalOpen] = useState(false);
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

      // Default to first account if none selected and accounts exist
      if (selectedAccountId === null && accs.length > 0 && initialAccountId === null) {
        setSelectedAccountId(accs[0].id);
      }

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
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to load accounts');
    } finally {
      setLoading(false);
    }
  };

  const loadTransactions = async () => {
    setTxLoading(true);
    try {
      const txs = await fetchAccountTransactions({
        accountId: selectedAccountId ?? undefined,
        period,
        limit: 500,
      });
      setTransactions(txs);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to load account transactions');
    } finally {
      setTxLoading(false);
    }
  };

  useEffect(() => {
    loadAccountsAndSnapshots();
  }, []);

  useEffect(() => {
    loadTransactions();
  }, [selectedAccountId, period]);

  const selectedAccount = useMemo(
    () => accounts.find((a) => a.id === selectedAccountId) || null,
    [accounts, selectedAccountId]
  );

  const getAccountLatestBalance = (accountId: number): number => {
    const snaps = snapshotsByAccount[accountId];
    if (!snaps || snaps.length === 0) return 0;
    return snaps[0].balance_nzd;
  };

  const getAccountBalanceDelta = (accountId: number): number | null => {
    const snaps = snapshotsByAccount[accountId];
    if (!snaps || snaps.length < 2) return null;
    return snaps[0].balance_nzd - snaps[1].balance_nzd;
  };

  const totalPortfolioBalance = useMemo(() => {
    return accounts.reduce((sum, acc) => sum + getAccountLatestBalance(acc.id), 0);
  }, [accounts, snapshotsByAccount]);

  const displayedBalance = useMemo(() => {
    if (selectedAccountId === null) return totalPortfolioBalance;
    return getAccountLatestBalance(selectedAccountId);
  }, [selectedAccountId, totalPortfolioBalance, snapshotsByAccount]);

  const isTransferCategory = (cat: string, tx?: Transaction) => {
    const lower = (cat || '').toLowerCase();
    return lower === 'transfer' || lower === 'transfers' || Boolean(tx?.linked_transaction_id);
  };

  // Compute per-account period analytics & category breakdown
  const analytics = useMemo(() => {
    let totalSpend = 0;
    let totalIncome = 0;
    let totalTransfers = 0;
    let spendTxCount = 0;
    const catTotals: Record<string, { spend: number; count: number; isTransfer: boolean }> = {};

    for (const tx of transactions) {
      const isTransfer = isTransferCategory(tx.category, tx);
      const catName = tx.category || 'Uncategorized';

      if (isTransfer) {
        totalTransfers += Math.abs(tx.amount);
        if (!catTotals[catName]) {
          catTotals[catName] = { spend: 0, count: 0, isTransfer: true };
        }
        catTotals[catName].spend += Math.abs(tx.amount);
        catTotals[catName].count += 1;
      } else if (tx.amount < 0) {
        const absAmt = Math.abs(tx.amount);
        totalSpend += absAmt;
        spendTxCount += 1;
        if (!catTotals[catName]) {
          catTotals[catName] = { spend: 0, count: 0, isTransfer: false };
        }
        catTotals[catName].spend += absAmt;
        catTotals[catName].count += 1;
      } else if (tx.amount > 0) {
        totalIncome += tx.amount;
      }
    }

    const categoryBreakdown = Object.entries(catTotals)
      .filter(([, info]) => !info.isTransfer && info.spend > 0)
      .map(([category, info]) => ({
        category,
        total_spend: info.spend,
        transaction_count: info.count,
        percentage: totalSpend > 0 ? Math.round((info.spend / totalSpend) * 100) : 0,
      }))
      .sort((a, b) => b.total_spend - a.total_spend);

    return {
      totalSpend,
      totalIncome,
      totalTransfers,
      netCashflow: totalIncome - totalSpend,
      spendTxCount,
      categoryBreakdown,
    };
  }, [transactions]);

  const availableCategories = useMemo(() => {
    const set = new Set<string>(DEFAULT_CATEGORIES);
    transactions.forEach((tx) => {
      if (tx.category) set.add(tx.category);
    });
    return Array.from(set).sort();
  }, [transactions]);

  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      if (categoryFilter && tx.category.toLowerCase() !== categoryFilter.toLowerCase()) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchMerchant = tx.merchant.toLowerCase().includes(q);
        const matchCat = tx.category.toLowerCase().includes(q);
        const matchDesc = (tx.raw_description || '').toLowerCase().includes(q);
        const matchAcc = (tx.account_name || '').toLowerCase().includes(q);
        return matchMerchant || matchCat || matchDesc || matchAcc;
      }
      return true;
    });
  }, [transactions, categoryFilter, searchQuery]);

  const getTierBadgeProps = (tier: Account['tier']) => {
    switch (tier) {
      case 'cash':
        return { label: 'Cash Floor', variant: 'success' as const, icon: <Wallet className="w-3 h-3" /> };
      case 'growth':
        return { label: 'Growth', variant: 'warning' as const, icon: <TrendingUp className="w-3 h-3" /> };
      case 'locked':
        return { label: 'Locked', variant: 'info' as const, icon: <Lock className="w-3 h-3" /> };
      default:
        return { label: tier, variant: 'idle' as const };
    }
  };

  const handleInspectAccount = (acc: Account | null) => {
    setInspectingAccount(acc);
    setSelectedAccountId(acc ? acc.id : null);
    setIsAccountModalOpen(true);
  };

  const handleInspectCategory = (catName: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setInspectingCategory(catName);
    setIsCategoryModalOpen(true);
  };

  const handleDirectCategoryChange = async (txId: number, newCategory: string) => {
    if (!newCategory) return;
    setSavingTxId(txId);
    setError(null);
    try {
      const updated = await updateTransactionCategory(txId, newCategory);
      setTransactions((prev) =>
        prev.map((tx) => (tx.id === txId ? { ...tx, category: updated.category } : tx))
      );
      setSuccessNote(`Moved transaction to "${newCategory}"`);
      if (onRefreshRunway) onRefreshRunway();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to update transaction category');
    } finally {
      setSavingTxId(null);
    }
  };

  const handleCreateRuleFromTx = (tx: Transaction) => {
    setRulePrefill({
      name: `Rule for ${tx.merchant}`,
      description_pattern: tx.raw_description || tx.merchant,
      match_type: 'contains',
      amount_equals: null,
      target_category: tx.category,
      rename_merchant: tx.merchant,
      priority: 10,
      apply_retroactively: true,
    });
    setIsRulesModalOpen(true);
  };

  const handleRecordSnapshot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAccount) return;
    const parsedBalance = parseFloat(snapshotBalance);
    if (isNaN(parsedBalance)) return;

    setSavingSnapshot(true);
    try {
      await recordAccountSnapshot(selectedAccount.id, {
        account_id: selectedAccount.id,
        snapshot_date: snapshotDate,
        balance: parsedBalance,
        currency: selectedAccount.currency || 'NZD',
        exchange_rate: 1.0,
        source: 'manual',
        notes: snapshotNotes.trim() || null,
      });
      setIsSnapshotModalOpen(false);
      setSnapshotBalance('');
      setSnapshotNotes('');
      await loadAccountsAndSnapshots();
      if (onRefreshRunway) onRefreshRunway();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to record snapshot');
    } finally {
      setSavingSnapshot(false);
    }
  };

  const selectedSnapshots = selectedAccountId ? snapshotsByAccount[selectedAccountId] || [] : [];

  return (
    <div className="space-y-6" data-testid="account-view">
      {/* Top Header & Period / Snapshot Controls */}
      <GlassCard className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 shrink-0">
              <Landmark className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">Accounts & Per-Account Ledger</h2>
              <p className="text-xs text-slate-400">
                Click any account to inspect transactions and re-categorize in a popup
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <SegmentedControl
              options={PERIOD_OPTIONS}
              value={period}
              onChange={setPeriod}
              variant="amber"
              size="xs"
              idPrefix="account-period"
            />

            {selectedAccount && (
              <Button
                variant="amber"
                size="xs"
                icon={<PlusCircle className="w-3.5 h-3.5" />}
                onClick={() => {
                  setSnapshotBalance(String(getAccountLatestBalance(selectedAccount.id) || ''));
                  setIsSnapshotModalOpen(true);
                }}
                data-testid="record-snapshot-btn"
              >
                Record Valuation Snapshot
              </Button>
            )}
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

        {/* Account Selector Grid (Clicking opens Account Inspection Popup) */}
        {loading ? (
          <div className="flex items-center justify-center py-8 text-slate-400 text-xs">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-amber-400 mr-2" />
            Loading accounts...
          </div>
        ) : (
          <div
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1"
            data-testid="account-selector-grid"
          >
            {/* All Accounts aggregate selector card */}
            <SelectableCard
              data-testid="account-card-all"
              onClick={() => handleInspectAccount(null)}
              isSelected={selectedAccountId === null}
              title="All Accounts"
              icon={<Building2 className="w-3.5 h-3.5 text-amber-400" />}
              badge={<StatusBadge label={`${accounts.length} active`} variant="idle" />}
              value={`$${Math.round(totalPortfolioBalance).toLocaleString('en-NZ')}`}
              valueSuffix="NZD"
              subtitle="Combined ledger across all institutions"
              variant="amber"
            />

            {accounts.map((acc) => {
              const isSelected = selectedAccountId === acc.id;
              const balance = getAccountLatestBalance(acc.id);
              const delta = getAccountBalanceDelta(acc.id);
              const tierBadge = getTierBadgeProps(acc.tier);
              const latestSnap = snapshotsByAccount[acc.id]?.[0];

              return (
                <SelectableCard
                  key={acc.id}
                  data-testid={`account-card-${acc.id}`}
                  onClick={() => handleInspectAccount(acc)}
                  isSelected={isSelected}
                  title={acc.name}
                  badge={
                    <StatusBadge
                      label={tierBadge.label}
                      variant={tierBadge.variant}
                      icon={tierBadge.icon}
                    />
                  }
                  value={`$${Math.round(balance).toLocaleString('en-NZ')}`}
                  valueSuffix="NZD"
                  subtitle={`${acc.institution} • ${acc.account_type.replace('_', ' ')}`}
                  subvalue={
                    delta !== null && delta !== 0
                      ? `${delta > 0 ? '+' : '-'}$${Math.abs(Math.round(delta)).toLocaleString('en-NZ')}`
                      : latestSnap
                      ? latestSnap.snapshot_date
                      : undefined
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
        )}
      </GlassCard>

      {/* Per-Account Summary Metrics */}
      <div
        className="grid grid-cols-2 sm:grid-cols-4 gap-3"
        data-testid="account-analytics-panel"
      >
        <StatCard
          title={selectedAccount ? `${selectedAccount.name} Balance` : 'Total Portfolio Balance'}
          value={`$${Math.round(displayedBalance).toLocaleString('en-NZ')} NZD`}
          subtitle={
            selectedAccount
              ? `${selectedAccount.institution} (${selectedAccount.tier.toUpperCase()} tier${
                  selectedAccount.expected_annual_return > 0
                    ? ` • ${(selectedAccount.expected_annual_return * 100).toFixed(1)}% p.a.`
                    : ''
                })`
              : `Across ${accounts.length} active accounts`
          }
          icon={<Wallet className="w-3.5 h-3.5" />}
          variant="amber"
        />
        <StatCard
          title="Period Outflow"
          value={`$${Math.round(analytics.totalSpend).toLocaleString('en-NZ')}`}
          subtitle={`${analytics.spendTxCount} expense transaction${analytics.spendTxCount === 1 ? '' : 's'}`}
          icon={<ArrowDownRight className="w-3.5 h-3.5" />}
          variant="card"
        />
        <StatCard
          title="Period Inflow"
          value={`$${Math.round(analytics.totalIncome).toLocaleString('en-NZ')}`}
          subtitle={
            analytics.netCashflow >= 0
              ? `Net +$${Math.round(analytics.netCashflow).toLocaleString('en-NZ')} saved`
              : `Net -$${Math.abs(Math.round(analytics.netCashflow)).toLocaleString('en-NZ')} drawdown`
          }
          icon={<ArrowUpRight className="w-3.5 h-3.5" />}
          variant="emerald"
        />
        <StatCard
          title="Internal Transfers"
          value={`$${Math.round(analytics.totalTransfers).toLocaleString('en-NZ')}`}
          subtitle="Excluded from burn rate"
          icon={<ArrowRightLeft className="w-3.5 h-3.5" />}
          variant="sky"
        />
      </div>

      {/* Middle Row: Per-Account Category Breakdown & Valuation History */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Per-Account Category Breakdown */}
        <div className="lg:col-span-7" data-testid="account-category-breakdown">
          <GlassCard className="h-full space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400">
                  <PieChart className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-200">
                    {selectedAccount ? `${selectedAccount.name} Spending by Category` : 'All Accounts Spending by Category'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Click a category to filter or inspect transactions
                  </p>
                </div>
              </div>
              {categoryFilter && (
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() => setCategoryFilter(null)}
                  data-testid="clear-category-filter-btn"
                >
                  Clear Filter ({categoryFilter})
                </Button>
              )}
            </div>

            {analytics.categoryBreakdown.length === 0 ? (
              <div className="text-center py-6 text-xs text-slate-500 border border-dashed border-border rounded-xl">
                No expense transactions recorded for this account in the selected period.
              </div>
            ) : (
              <div className="space-y-2 pt-1">
                {analytics.categoryBreakdown.map((cat) => {
                  const isSelected = categoryFilter?.toLowerCase() === cat.category.toLowerCase();
                  return (
                    <div
                      key={cat.category}
                      data-testid={`account-cat-row-${cat.category.toLowerCase()}`}
                      className={`w-full text-left p-2.5 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                        isSelected
                          ? 'bg-amber-500/15 border-amber-500/40'
                          : 'bg-background/40 border-border/60 hover:border-slate-700'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() =>
                          setCategoryFilter((prev) =>
                            prev?.toLowerCase() === cat.category.toLowerCase() ? null : cat.category
                          )
                        }
                        className="flex-1 text-left"
                      >
                        <div className="flex items-center justify-between text-xs mb-1.5">
                          <span className="font-medium text-slate-200 flex items-center gap-2">
                            <span>{cat.category}</span>
                            <span className="text-[11px] text-slate-400">
                              ({cat.transaction_count} tx{cat.transaction_count === 1 ? '' : 's'})
                            </span>
                          </span>
                          <span className="font-mono font-semibold text-slate-200">
                            ${cat.total_spend.toLocaleString('en-NZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            <span className="text-slate-400 font-normal ml-1.5">({cat.percentage}%)</span>
                          </span>
                        </div>
                        <div className="w-full h-1.5 bg-background rounded-full overflow-hidden">
                          <div
                            className="h-full bg-amber-400 rounded-full transition-all duration-300"
                            style={{ width: `${Math.max(3, cat.percentage)}%` }}
                          />
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={(e) => handleInspectCategory(cat.category, e)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-amber-300 hover:bg-slate-800/60 transition-colors shrink-0"
                        title={`Inspect transactions in ${cat.category}`}
                        data-testid={`inspect-cat-${cat.category.toLowerCase()}`}
                      >
                        <Layers className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </GlassCard>
        </div>

        {/* Balance Valuation Snapshots */}
        <div className="lg:col-span-5" data-testid="account-snapshots-panel">
          <GlassCard className="h-full space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
                  <History className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-200">Balance Valuation History</h3>
                  <p className="text-xs text-slate-400">
                    {selectedAccount
                      ? `Point-in-time snapshots for ${selectedAccount.name}`
                      : 'Select an individual account to inspect its snapshot timeline'}
                  </p>
                </div>
              </div>
            </div>

            {selectedAccount === null ? (
              <div className="space-y-2 pt-1">
                {accounts.map((acc) => {
                  const latest = snapshotsByAccount[acc.id]?.[0];
                  return (
                    <div
                      key={acc.id}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-background/40 border border-border/60 text-xs"
                    >
                      <div>
                        <div className="font-medium text-slate-200">{acc.name}</div>
                        <div className="text-[11px] text-slate-400">
                          {latest ? `As of ${latest.snapshot_date} (${latest.source})` : 'No snapshots yet'}
                        </div>
                      </div>
                      <div className="font-mono font-semibold text-slate-100">
                        ${Math.round(latest?.balance_nzd || 0).toLocaleString('en-NZ')} NZD
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : selectedSnapshots.length === 0 ? (
              <div className="text-center py-6 text-xs text-slate-500 border border-dashed border-border rounded-xl">
                No balance snapshots recorded for {selectedAccount.name}.
              </div>
            ) : (
              <div className="space-y-2 pt-1 max-h-64 overflow-y-auto pr-1">
                {selectedSnapshots.map((snap, idx) => {
                  const prevSnap = selectedSnapshots[idx + 1];
                  const diff = prevSnap ? snap.balance_nzd - prevSnap.balance_nzd : null;
                  return (
                    <div
                      key={snap.id}
                      data-testid={`snapshot-row-${snap.id}`}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-background/40 border border-border/60 text-xs"
                    >
                      <div>
                        <div className="font-medium text-slate-200 flex items-center gap-1.5">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          <span>{snap.snapshot_date}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 uppercase">
                            {snap.source}
                          </span>
                        </div>
                        {snap.notes && (
                          <div className="text-[11px] text-slate-400 mt-0.5 truncate max-w-xs">
                            {snap.notes}
                          </div>
                        )}
                      </div>
                      <div className="text-right font-mono">
                        <div className="font-semibold text-slate-100">
                          ${snap.balance_nzd.toLocaleString('en-NZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        {diff !== null && diff !== 0 && (
                          <div className={`text-[10px] ${diff > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {diff > 0 ? '+' : '-'}${Math.abs(diff).toLocaleString('en-NZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </GlassCard>
        </div>
      </div>

      {/* Per-Account Transactions List with direct category changer */}
      <div data-testid="account-transactions-list">
        <GlassCard className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-200">
                {selectedAccount ? `${selectedAccount.name} Transactions` : 'All Account Transactions'}
                <span className="ml-2 text-xs font-normal text-slate-400">
                  ({filteredTransactions.length})
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Directly change categories and create categorization rules from this account ledger
              </p>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search merchant or category..."
                data-testid="account-tx-search"
                className="w-full bg-background border border-border rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          {txLoading ? (
            <div className="flex items-center justify-center py-10 text-slate-400 text-xs">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-amber-400 mr-2" />
              Loading transactions...
            </div>
          ) : filteredTransactions.length === 0 ? (
            <div className="text-center py-10 text-xs text-slate-400 border border-dashed border-border rounded-xl">
              No matching transactions found for this account filter.
            </div>
          ) : (
            <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
              {filteredTransactions.map((tx) => {
                const isTransfer = isTransferCategory(tx.category, tx);
                const amt = Number(tx.amount);
                const isDebit = amt < 0;
                const formattedAmt = `${isDebit ? '-' : '+'}$${Math.abs(amt).toFixed(2)}`;

                return (
                  <div
                    key={tx.id}
                    data-testid={`account-tx-row-${tx.id}`}
                    className="p-3 bg-background/50 hover:bg-background/80 border border-border/70 rounded-xl transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-semibold text-slate-200 truncate">
                          {tx.merchant}
                        </span>
                        {selectedAccountId === null && tx.account_name && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                            {tx.account_name}
                          </span>
                        )}
                        {isTransfer && (
                          <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-300 border border-sky-500/20">
                            <ArrowRightLeft className="w-2.5 h-2.5" />
                            Transfer
                          </span>
                        )}
                        {tx.has_receipt && (
                          <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                            <ReceiptIcon className="w-2.5 h-2.5" />
                            Receipt
                          </span>
                        )}
                      </div>

                      <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-2 flex-wrap">
                        <span>{tx.transaction_date}</span>
                        {tx.raw_description && tx.raw_description !== tx.merchant && (
                          <span className="text-slate-500 truncate max-w-md">
                            • {tx.raw_description}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                      <span
                        className={`text-xs font-mono font-semibold ${
                          isTransfer
                            ? 'text-sky-300'
                            : isDebit
                            ? 'text-rose-400'
                            : 'text-emerald-400'
                        }`}
                      >
                        {formattedAmt}
                      </span>

                      {/* Direct category quick-changer & rule creator */}
                      <div className="flex items-center space-x-1.5">
                        <select
                          value={tx.category}
                          onChange={(e) => handleDirectCategoryChange(tx.id, e.target.value)}
                          disabled={savingTxId === tx.id}
                          aria-label={`Category for ${tx.merchant}`}
                          data-testid={`account-select-category-${tx.id}`}
                          className="text-[11px] px-2 py-1 bg-background border border-border hover:border-amber-500/50 rounded-lg text-slate-200 focus:outline-none focus:border-amber-500 transition-colors disabled:opacity-50"
                        >
                          {availableCategories.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>

                        {savingTxId === tx.id ? (
                          <div className="w-3.5 h-3.5 animate-spin rounded-full border border-amber-400 border-t-transparent shrink-0" />
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleCreateRuleFromTx(tx)}
                            className="p-1 rounded text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 transition-colors shrink-0"
                            title="Create categorization rule from this transaction"
                            aria-label={`Create rule for ${tx.merchant}`}
                            data-testid={`account-rule-btn-${tx.id}`}
                          >
                            <SlidersHorizontal className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </GlassCard>
      </div>

      {/* Account Inspection Popup Modal (Consistent with Budgets Category Inspection) */}
      <AccountInspectionModal
        isOpen={isAccountModalOpen}
        onClose={() => setIsAccountModalOpen(false)}
        account={inspectingAccount}
        period={period}
        onPeriodChange={setPeriod}
        onTransactionCategoryChanged={() => {
          loadTransactions();
          if (onRefreshRunway) onRefreshRunway();
        }}
        onRecordSnapshotClick={() => {
          if (inspectingAccount) {
            setSnapshotBalance(String(getAccountLatestBalance(inspectingAccount.id) || ''));
            setIsSnapshotModalOpen(true);
          }
        }}
        latestBalanceNzd={inspectingAccount ? getAccountLatestBalance(inspectingAccount.id) : totalPortfolioBalance}
      />

      {/* Category Inspection Modal */}
      <CategoryTransactionInspectionModal
        isOpen={isCategoryModalOpen}
        onClose={() => {
          setIsCategoryModalOpen(false);
          setInspectingCategory(null);
        }}
        category={inspectingCategory || undefined}
        period={period}
        onCategoryChanged={() => {
          loadTransactions();
          if (onRefreshRunway) onRefreshRunway();
        }}
      />

      {/* Rules Manager Modal spawned from transaction */}
      <RulesManagerModal
        isOpen={isRulesModalOpen}
        onClose={() => {
          setIsRulesModalOpen(false);
          setRulePrefill(null);
        }}
        prefillRule={rulePrefill}
        onRulesApplied={() => {
          loadTransactions();
          if (onRefreshRunway) onRefreshRunway();
        }}
      />

      {/* Record Balance Snapshot Modal */}
      {selectedAccount && (
        <Modal
          isOpen={isSnapshotModalOpen}
          onClose={() => setIsSnapshotModalOpen(false)}
          title={`Record Balance Valuation Snapshot - ${selectedAccount.name}`}
        >
          <form onSubmit={handleRecordSnapshot} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Snapshot Date
              </label>
              <input
                type="date"
                value={snapshotDate}
                onChange={(e) => setSnapshotDate(e.target.value)}
                required
                className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Closing Balance ({selectedAccount.currency || 'NZD'})
              </label>
              <input
                type="number"
                step="0.01"
                value={snapshotBalance}
                onChange={(e) => setSnapshotBalance(e.target.value)}
                placeholder="0.00"
                required
                data-testid="snapshot-balance-input"
                className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm text-slate-200 font-mono focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Notes (Optional)
              </label>
              <input
                type="text"
                value={snapshotNotes}
                onChange={(e) => setSnapshotNotes(e.target.value)}
                placeholder="e.g. Monthly statement reconciliation"
                data-testid="snapshot-notes-input"
                className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
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
                disabled={savingSnapshot}
                data-testid="submit-snapshot-btn"
              >
                {savingSnapshot ? 'Saving...' : 'Confirm & Save Valuation'}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
