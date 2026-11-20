import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Building2,
  Check,
  Landmark,
  Lock,
  PlusCircle,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import {
  AlertBanner,
  Button,
  Modal,
  SearchInput,
  StatusBadge,
  SummaryMetricGrid,
  SummaryMetricItem,
} from '@yggdrasil-lab/ui';
import {
  isTransferCategory,
} from '../constants/categories';
import { useCategories } from '../hooks/useCategories';
import { useTransactionCategoryMutation } from '../hooks/useTransactionCategoryMutation';
import { fetchAccountTransactions, fetchLoans } from '../services/api';
import { Account, LoanItem, PeriodType, Transaction } from '../types';
import { formatMoney } from '../utils/format';
import { collapsePairedTransfers } from '../utils/transfers';
import { getDefaultCustomRange, PeriodFilterBar } from './PeriodFilterBar';
import { RulesManagerModal } from './RulesManagerModal';
import { TransactionList } from './TransactionList';

interface AccountInspectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  account: Account | null;
  period: PeriodType;
  onPeriodChange?: (period: PeriodType) => void;
  startDate?: string;
  endDate?: string;
  onStartDateChange?: (date: string) => void;
  onEndDateChange?: (date: string) => void;
  onTransactionCategoryChanged: () => void;
  onRecordSnapshotClick?: () => void;
  latestBalance?: number;
  latestBalanceNzd?: number;
}

function getTierBadge(tier?: Account['tier']) {
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
}

/**
 * Modal for inspecting transactions, cashflow summary, and recategorization rules
 * for either a single account or the aggregated portfolio ledger.
 */
export const AccountInspectionModal: React.FC<AccountInspectionModalProps> = ({
  isOpen,
  onClose,
  account,
  period,
  onPeriodChange,
  startDate: controlledStartDate,
  endDate: controlledEndDate,
  onStartDateChange,
  onEndDateChange,
  onTransactionCategoryChanged,
  onRecordSnapshotClick,
  latestBalance,
  latestBalanceNzd,
}) => {
  const { categoryNames } = useCategories();
  const defaultRange = useMemo(() => getDefaultCustomRange(), []);
  const [localStartDate, setLocalStartDate] = useState(defaultRange.startDate);
  const [localEndDate, setLocalEndDate] = useState(defaultRange.endDate);
  const startDate = controlledStartDate ?? localStartDate;
  const endDate = controlledEndDate ?? localEndDate;
  const handleStartDateChange = onStartDateChange ?? setLocalStartDate;
  const handleEndDateChange = onEndDateChange ?? setLocalEndDate;

  const currentBalance = latestBalance !== undefined ? latestBalance : latestBalanceNzd;
  const displayCurrency = account?.currency || 'NZD';
  const isCrypto =
    account?.account_type === 'crypto' || displayCurrency.toUpperCase() === 'BTC';
  const amountFormatOpts = isCrypto
    ? { minimumFractionDigits: 2, maximumFractionDigits: 8 }
    : { minimumFractionDigits: 2, maximumFractionDigits: 2 };
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loans, setLoans] = useState<LoanItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);

  const handleTransactionUpdated = useCallback((txId: number, patch: Partial<Transaction>) => {
    setTransactions((prev) =>
      prev.map((t) => (t.id === txId ? { ...t, ...patch } : t))
    );
  }, []);

  const {
    updatingId,
    successNote,
    setSuccessNote,
    isRulesModalOpen,
    rulePrefill,
    handleCategoryChange,
    handleTagsChange,
    handleRecurrenceChange,
    handleLoanChange,
    handleCreateRuleFromTx,
    closeRulesModal,
  } = useTransactionCategoryMutation({
    onTransactionUpdated: handleTransactionUpdated,
    onChanged: onTransactionCategoryChanged,
    onError: (msg) => setError(msg || null),
  });

  const loadTransactions = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchAccountTransactions({
        accountId: account ? account.id : undefined,
        period,
        startDate: period === 'custom' ? startDate : undefined,
        endDate: period === 'custom' ? endDate : undefined,
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
      fetchLoans()
        .then((res) => setLoans(res.loans || []))
        .catch(() => setLoans([]));
    }
  }, [isOpen, account?.id, period, startDate, endDate]);

  const collapsedTransactions = useMemo(
    () => collapsePairedTransfers(transactions),
    [transactions]
  );

  const analytics = useMemo(() => {
    let totalSpend = 0;
    let totalIncome = 0;
    let totalTransfers = 0;
    for (const tx of collapsedTransactions) {
      if (account && tx.account_id !== account.id) {
        continue;
      }
      if (isTransferCategory(tx.category, tx)) {
        totalTransfers += Math.abs(tx.amount);
      } else if (tx.amount < 0) {
        totalSpend += Math.abs(tx.amount);
      } else if (tx.amount > 0) {
        totalIncome += tx.amount;
      }
    }
    return { totalSpend, totalIncome, totalTransfers };
  }, [collapsedTransactions, account]);

  const availableCategories = useMemo(() => {
    const set = new Set<string>(categoryNames);
    collapsedTransactions.forEach((tx) => {
      if (tx.category) set.add(tx.category);
    });
    return Array.from(set).sort();
  }, [collapsedTransactions, categoryNames]);

  const filteredTransactions = useMemo(() => {
    return collapsedTransactions.filter((tx) => {
      if (categoryFilter && tx.category.toLowerCase() !== categoryFilter.toLowerCase()) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().replace(/^#+/, '');
        return (
          tx.merchant.toLowerCase().includes(q) ||
          tx.category.toLowerCase().includes(q) ||
          (tx.account_name || '').toLowerCase().includes(q) ||
          (tx.linked_account_name || '').toLowerCase().includes(q) ||
          (tx.counterpart_account_name || '').toLowerCase().includes(q) ||
          (tx.loan_name || '').toLowerCase().includes(q) ||
          (tx.raw_description || '').toLowerCase().includes(q) ||
          (tx.tags || []).some((tag) => tag.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [collapsedTransactions, categoryFilter, searchQuery]);

  const summaryItems: SummaryMetricItem[] = [
    ...(currentBalance !== undefined
      ? [
          {
            id: 'balance',
            label: 'Balance',
            value: (
              <span className="text-xs tracking-tight">
                {`${formatMoney(currentBalance, amountFormatOpts)} ${displayCurrency}`}
              </span>
            ),
            valueClassName: 'text-slate-100 font-mono text-xs',
          },
        ]
      : []),
    {
      id: 'outflow',
      label: 'Outflow',
      value: (
        <span className="text-xs tracking-tight">{`${formatMoney(analytics.totalSpend, amountFormatOpts)} ${displayCurrency}`}</span>
      ),
      valueClassName: 'text-slate-200 font-mono text-xs',
    },
    {
      id: 'inflow',
      label: 'Inflow',
      value: (
        <span className="text-xs tracking-tight">{`${formatMoney(analytics.totalIncome, amountFormatOpts)} ${displayCurrency}`}</span>
      ),
      valueClassName: 'text-emerald-400 font-mono text-xs',
    },
    {
      id: 'transfers',
      label: 'Transfers',
      value: (
        <span className="text-xs tracking-tight">{`${formatMoney(analytics.totalTransfers, amountFormatOpts)} ${displayCurrency}`}</span>
      ),
      valueClassName: 'text-sky-300 font-mono text-xs',
    },
  ];

  const titleText = account ? `Inspect Account: ${account.name}` : 'Inspect: All Accounts';
  const tierInfo = account ? getTierBadge(account.tier) : null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={titleText}
      className="sm:max-w-2xl"
    >
      <div className="space-y-4" data-testid="account-inspection-modal">
        {/* Account Header Banner */}
        <div className="p-3 rounded-xl bg-card/60 border border-border flex flex-col gap-3">
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
              <PeriodFilterBar
                period={period}
                onPeriodChange={onPeriodChange}
                startDate={startDate}
                endDate={endDate}
                onStartDateChange={handleStartDateChange}
                onEndDateChange={handleEndDateChange}
                idPrefix="modal-period"
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
        <SummaryMetricGrid
          items={summaryItems}
          columns={currentBalance !== undefined ? 4 : 3}
        />

        {error && <AlertBanner variant="error">{error}</AlertBanner>}
        {successNote && (
          <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-xs text-emerald-300 flex items-center space-x-2 animate-in fade-in">
            <Check className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
            <span>{successNote}</span>
          </div>
        )}

        {/* Search & Category Filter */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1">
          <SearchInput
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search merchant or category..."
            variant="amber"
            className="flex-1"
            data-testid="modal-tx-search"
          />
          <div className="flex items-center gap-2">
            <select
              value={categoryFilter || ''}
              onChange={(e) => setCategoryFilter(e.target.value || null)}
              className="bg-background border border-border rounded-xl px-2.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
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
              {filteredTransactions.length} of {collapsedTransactions.length}
            </div>
          </div>
        </div>

        {/* Transactions List */}
        <TransactionList
          transactions={filteredTransactions}
          categories={availableCategories}
          loading={loading}
          loadingLabel="Loading account transactions..."
          emptyTitle="No transactions found for this account and period."
          updatingId={updatingId}
          onCategoryChange={(txId, cat) => {
            setError(null);
            void handleCategoryChange(txId, cat);
          }}
          onTagsChange={(txId, newTags) => {
            void handleTagsChange(txId, newTags);
          }}
          onRecurrenceChange={(txId, recurrence) => {
            void handleRecurrenceChange(txId, recurrence);
          }}
          loans={loans}
          onLoanChange={(txId, loanId) => {
            setError(null);
            const matchedLoan = loans.find((l) => l.id === loanId);
            void handleLoanChange(txId, loanId, matchedLoan?.name ?? null);
          }}
          onCreateRule={handleCreateRuleFromTx}
          onReceiptUpdated={() => {
            void loadTransactions();
            onTransactionCategoryChanged();
          }}
          showAccountBadge={account === null}
          fallbackCurrency={account?.currency}
          listTestId="modal-tx-list"
          getRowTestId={(tx) => `account-modal-tx-row-${tx.id}`}
          getSelectTestId={(tx) => `modal-select-category-${tx.id}`}
          getRuleBtnTestId={(tx) => `modal-rule-btn-${tx.id}`}
        />

        <div className="pt-2 flex justify-end">
          <Button variant="outline" size="sm" onClick={onClose} data-testid="modal-close-done-btn">
            Done
          </Button>
        </div>
      </div>

      <RulesManagerModal
        isOpen={isRulesModalOpen}
        onClose={closeRulesModal}
        prefillRule={rulePrefill}
        onRulesApplied={() => {
          loadTransactions();
          onTransactionCategoryChanged();
        }}
      />
    </Modal>
  );
};
