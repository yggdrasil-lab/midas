import React, { useEffect, useMemo, useState } from 'react';
import {
  Building2,
  Landmark,
  Wallet,
  TrendingUp,
  Lock,
  ArrowRightLeft,
  SlidersHorizontal,
  Check,
  RefreshCw,
  Search,
  Receipt as ReceiptIcon,
  PlusCircle,
} from 'lucide-react';
import {
  Modal,
  Button,
  AlertBanner,
  StatusBadge,
  SegmentedControl,
  SegmentedControlOption,
} from '@yggdrasil-lab/ui';
import {
  Account,
  CategorizationRuleCreate,
  Transaction,
  PeriodType,
} from '../types';
import {
  fetchAccountTransactions,
  updateTransactionCategory,
} from '../services/api';
import { RulesManagerModal } from './RulesManagerModal';

interface AccountInspectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  account: Account | null;
  period: PeriodType;
  onPeriodChange?: (period: PeriodType) => void;
  onTransactionCategoryChanged: () => void;
  onRecordSnapshotClick?: () => void;
  latestBalance?: number;
  latestBalanceNzd?: number;
}

const CATEGORY_CHOICES = [
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
];

const PERIOD_OPTIONS: SegmentedControlOption<PeriodType>[] = [
  { id: 'month', label: 'This Month' },
  { id: 'week', label: 'This Week' },
  { id: 'last_month', label: 'Last Month' },
  { id: 'all', label: 'All Time' },
];

export const AccountInspectionModal: React.FC<AccountInspectionModalProps> = ({
  isOpen,
  onClose,
  account,
  period,
  onPeriodChange,
  onTransactionCategoryChanged,
  onRecordSnapshotClick,
  latestBalance,
  latestBalanceNzd,
}) => {
  const currentBalance = latestBalance !== undefined ? latestBalance : latestBalanceNzd;
  const displayCurrency = account?.currency || 'NZD';
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [successNote, setSuccessNote] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);

  // Rules Manager Modal state
  const [isRulesModalOpen, setIsRulesModalOpen] = useState(false);
  const [rulePrefill, setRulePrefill] = useState<Partial<CategorizationRuleCreate> | null>(null);

  const loadTransactions = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchAccountTransactions({
        accountId: account ? account.id : undefined,
        period,
        limit: 500,
      });
      setTransactions(res);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to load account transactions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setSuccessNote(null);
      loadTransactions();
    }
  }, [isOpen, account?.id, period]);

  const handleCategoryChange = async (txId: number, newCategory: string) => {
    if (!newCategory) return;
    setUpdatingId(txId);
    setError(null);
    try {
      await updateTransactionCategory(txId, newCategory);
      setSuccessNote(`Moved transaction to "${newCategory}"`);
      setTransactions((prev) =>
        prev.map((t) => (t.id === txId ? { ...t, category: newCategory } : t))
      );
      onTransactionCategoryChanged();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to update transaction category');
    } finally {
      setUpdatingId(null);
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

  const isTransferCategory = (cat: string, tx?: Transaction) => {
    const lower = (cat || '').toLowerCase();
    return lower === 'transfer' || lower === 'transfers' || Boolean(tx?.linked_transaction_id);
  };

  const analytics = useMemo(() => {
    let totalSpend = 0;
    let totalIncome = 0;
    let totalTransfers = 0;
    let spendTxCount = 0;

    for (const tx of transactions) {
      const isTransfer = isTransferCategory(tx.category, tx);
      if (isTransfer) {
        totalTransfers += Math.abs(tx.amount);
      } else if (tx.amount < 0) {
        totalSpend += Math.abs(tx.amount);
        spendTxCount += 1;
      } else if (tx.amount > 0) {
        totalIncome += tx.amount;
      }
    }

    return {
      totalSpend,
      totalIncome,
      totalTransfers,
      netCashflow: totalIncome - totalSpend,
      spendTxCount,
    };
  }, [transactions]);

  const availableCategories = useMemo(() => {
    const set = new Set<string>(CATEGORY_CHOICES);
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
        return matchMerchant || matchCat || matchDesc;
      }
      return true;
    });
  }, [transactions, categoryFilter, searchQuery]);

  const getTierBadge = (tier?: Account['tier']) => {
    switch (tier) {
      case 'cash':
        return { label: 'Cash Floor', variant: 'success' as const, icon: <Wallet className="w-3 h-3" /> };
      case 'growth':
        return { label: 'Growth', variant: 'warning' as const, icon: <TrendingUp className="w-3 h-3" /> };
      case 'locked':
        return { label: 'Locked', variant: 'info' as const, icon: <Lock className="w-3 h-3" /> };
      default:
        return { label: 'Active', variant: 'idle' as const };
    }
  };

  const titleText = account ? `Inspect Account: ${account.name}` : 'Inspect: All Accounts';
  const tierInfo = account ? getTierBadge(account.tier) : null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={titleText}
    >
      <div className="space-y-4" data-testid="account-inspection-modal">
        {/* Account Header Banner */}
        <div className="p-3 rounded-xl bg-card/60 border border-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 shrink-0">
              {account ? <Landmark className="w-4 h-4" /> : <Building2 className="w-4 h-4" />}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-bold text-slate-100">
                  {account ? account.name : 'All Portfolio Accounts'}
                </span>
                {tierInfo && (
                  <StatusBadge
                    label={tierInfo.label}
                    variant={tierInfo.variant}
                    icon={tierInfo.icon}
                  />
                )}
              </div>
              <p className="text-xs text-slate-400">
                {account
                  ? `${account.institution} • ${account.account_type.replace('_', ' ')}`
                  : 'Aggregated view across all connected institutions'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {onPeriodChange && (
              <SegmentedControl
                options={PERIOD_OPTIONS}
                value={period}
                onChange={onPeriodChange}
                variant="amber"
                size="xs"
              />
            )}
            {account && onRecordSnapshotClick && (
              <Button
                variant="amber"
                size="xs"
                icon={<PlusCircle className="w-3 h-3" />}
                onClick={onRecordSnapshotClick}
                data-testid="modal-record-snapshot-btn"
              >
                Record Valuation
              </Button>
            )}
          </div>
        </div>

        {/* Balance & Analytics Chips */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
          {currentBalance !== undefined && (
            <div className="p-2.5 rounded-xl bg-card/40 border border-border">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Balance</span>
              <span className="text-xs font-semibold font-mono text-slate-100">
                ${Math.round(currentBalance).toLocaleString('en-NZ')} {displayCurrency}
              </span>
            </div>
          )}
          <div className="p-2.5 rounded-xl bg-card/40 border border-border">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Outflow</span>
            <span className="text-xs font-semibold font-mono text-slate-200">
              ${Math.round(analytics.totalSpend).toLocaleString('en-NZ')}
            </span>
          </div>
          <div className="p-2.5 rounded-xl bg-card/40 border border-border">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Inflow</span>
            <span className="text-xs font-semibold font-mono text-emerald-400">
              ${Math.round(analytics.totalIncome).toLocaleString('en-NZ')}
            </span>
          </div>
          <div className="p-2.5 rounded-xl bg-card/40 border border-border">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Transfers</span>
            <span className="text-xs font-semibold font-mono text-sky-300">
              ${Math.round(analytics.totalTransfers).toLocaleString('en-NZ')}
            </span>
          </div>
        </div>

        {error && <AlertBanner variant="error">{error}</AlertBanner>}
        {successNote && (
          <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-xs text-emerald-300 flex items-center space-x-2 animate-in fade-in">
            <Check className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
            <span>{successNote}</span>
          </div>
        )}

        {/* Search & Transaction Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search merchant or category..."
              data-testid="modal-tx-search"
              className="w-full bg-background border border-border rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <select
              value={categoryFilter || ''}
              onChange={(e) => setCategoryFilter(e.target.value || null)}
              className="bg-background border border-border rounded-xl px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
              aria-label="Filter transactions by category"
              data-testid="modal-tx-category-filter"
            >
              <option value="">All Categories</option>
              {availableCategories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <div className="text-[11px] text-slate-400 shrink-0">
              {filteredTransactions.length} of {transactions.length}
            </div>
          </div>
        </div>

        {/* Transactions List with direct category changer */}
        {loading ? (
          <div className="py-8 flex flex-col items-center justify-center space-y-2 text-slate-400 text-xs">
            <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
            <span>Loading account transactions...</span>
          </div>
        ) : filteredTransactions.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400 bg-card/30 rounded-xl border border-border/50">
            No transactions found for this account and period.
          </div>
        ) : (
          <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1" data-testid="modal-tx-list">
            {filteredTransactions.map((tx) => {
              const isTransfer = isTransferCategory(tx.category, tx);
              const amt = Number(tx.amount);
              const isDebit = amt < 0;
              const txCur = tx.currency || account?.currency;
              const formattedAmt = `${isDebit ? '-' : '+'}$${Math.abs(amt).toFixed(2)}${txCur && txCur !== 'NZD' ? ` ${txCur}` : ''}`;

              return (
                <div
                  key={tx.id}
                  data-testid={`account-modal-tx-row-${tx.id}`}
                  className="p-3 bg-card/60 hover:bg-card/80 border border-border rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors"
                >
                  {/* Left: Date, merchant, tags */}
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center space-x-2 flex-wrap">
                      <span className="text-[11px] font-mono text-slate-400">
                        {tx.transaction_date}
                      </span>
                      {account === null && tx.account_name && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 font-medium">
                          {tx.account_name}
                        </span>
                      )}
                      {Boolean(tx.has_receipt) && (
                        <span
                          className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 font-medium flex items-center space-x-1"
                          title="Matched Receipt"
                        >
                          <ReceiptIcon className="w-2.5 h-2.5" />
                          <span>Receipt</span>
                        </span>
                      )}
                      {isTransfer && (
                        <span
                          className="text-[10px] px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30 font-medium flex items-center space-x-1"
                          title="Inter-Account Transfer"
                        >
                          <ArrowRightLeft className="w-2.5 h-2.5" />
                          <span>Transfer</span>
                        </span>
                      )}
                    </div>
                    <div
                      className="text-xs font-semibold text-slate-200 truncate"
                      title={tx.raw_description || tx.merchant}
                    >
                      {tx.merchant}
                    </div>
                    {tx.raw_description && tx.raw_description !== tx.merchant && (
                      <div className="text-[11px] text-slate-500 truncate max-w-sm">
                        {tx.raw_description}
                      </div>
                    )}
                  </div>

                  {/* Right: Amount & Category selector */}
                  <div className="flex items-center justify-between sm:justify-end space-x-3 shrink-0">
                    <span
                      className={`text-xs font-semibold font-mono ${
                        isTransfer
                          ? 'text-sky-300'
                          : isDebit
                          ? 'text-rose-400'
                          : 'text-emerald-400'
                      }`}
                    >
                      {formattedAmt}
                    </span>

                    {/* Category quick changer & rule builder */}
                    <div className="flex items-center space-x-1.5">
                      <select
                        value={tx.category}
                        onChange={(e) => handleCategoryChange(tx.id, e.target.value)}
                        disabled={updatingId === tx.id}
                        aria-label={`Category for ${tx.merchant}`}
                        data-testid={`modal-select-category-${tx.id}`}
                        className="text-[11px] px-2 py-1 bg-background border border-border hover:border-amber-500/50 rounded-lg text-slate-200 focus:outline-none focus:border-amber-500 transition-colors disabled:opacity-50"
                      >
                        {availableCategories.map((choice) => (
                          <option key={choice} value={choice}>
                            {choice}
                          </option>
                        ))}
                      </select>
                      {updatingId === tx.id ? (
                        <RefreshCw className="w-3 h-3 animate-spin text-amber-400 shrink-0" />
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleCreateRuleFromTx(tx)}
                          className="p-1 rounded text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 transition-colors"
                          title="Create categorization rule from this transaction"
                          aria-label={`Create rule for ${tx.merchant}`}
                          data-testid={`modal-rule-btn-${tx.id}`}
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

        <div className="pt-2 flex justify-end">
          <Button variant="outline" size="sm" onClick={onClose} data-testid="modal-close-done-btn">
            Done
          </Button>
        </div>
      </div>

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
          onTransactionCategoryChanged();
        }}
      />
    </Modal>
  );
};
