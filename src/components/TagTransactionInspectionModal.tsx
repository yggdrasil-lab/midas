import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Tag } from 'lucide-react';
import {
  AlertBanner,
  Button,
  Modal,
  SearchInput,
  SummaryMetricGrid,
} from '@yggdrasil-lab/ui';
import {
  formatPeriodLabel,
  isTransferCategory as checkTransferCategory,
} from '../constants/categories';
import { useCategories } from '../hooks/useCategories';
import { useTransactionCategoryMutation } from '../hooks/useTransactionCategoryMutation';
import { fetchLoans, fetchTagTransactions } from '../services/api';
import {
  LoanItem,
  PeriodType,
  TagCategoryBreakdownItem,
  TagSpendingSummaryItem,
  Transaction,
} from '../types';
import { formatMoney, getTransactionNzdAmount } from '../utils/format';
import { collapsePairedTransfers } from '../utils/transfers';
import { RulesManagerModal } from './RulesManagerModal';
import { TransactionList } from './TransactionList';

interface TagTransactionInspectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  summary: TagSpendingSummaryItem | null;
  period: PeriodType;
  onTagDataChanged: () => void;
}

/**
 * Modal for inspecting all cross-category expenses tagged with a given trip or
 * project tag, showing category breakdown pills and inline editing controls.
 */
export const TagTransactionInspectionModal: React.FC<TagTransactionInspectionModalProps> = ({
  isOpen,
  onClose,
  summary,
  period,
  onTagDataChanged,
}) => {
  const { categoryNames } = useCategories();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loans, setLoans] = useState<LoanItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  const tagName = summary?.tag || '';

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
    onChanged: onTagDataChanged,
    onError: (msg) => setError(msg || null),
  });

  const loadTransactions = useCallback(async () => {
    if (!tagName) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetchTagTransactions(tagName, period);
      setTransactions(res);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to load tagged transactions');
    } finally {
      setLoading(false);
    }
  }, [tagName, period]);

  useEffect(() => {
    if (isOpen && tagName) {
      setSuccessNote(null);
      setSearchQuery('');
      setSelectedCategory('ALL');
      void loadTransactions();
      fetchLoans()
        .then((res) => setLoans(res.loans || []))
        .catch(() => setLoans([]));
    }
  }, [isOpen, tagName, period, loadTransactions, setSuccessNote]);

  const collapsedTransactions = useMemo(
    () => collapsePairedTransfers(transactions),
    [transactions]
  );

  const expenseTransactions = useMemo(
    () =>
      collapsedTransactions.filter(
        (tx) => !checkTransferCategory(tx.category, tx) && Number(tx.amount) < 0
      ),
    [collapsedTransactions]
  );

  const computedStats = useMemo(() => {
    if (loading && transactions.length === 0 && summary) {
      return {
        totalSpend: summary.total_spend,
        txCount: summary.transaction_count,
        categories: summary.categories,
      };
    }

    const totalSpend = expenseTransactions.reduce(
      (sum, tx) => sum + getTransactionNzdAmount(tx),
      0
    );
    const roundedTotal = Math.round(totalSpend * 100) / 100;
    const byCat = new Map<string, { spend: number; count: number }>();

    for (const tx of expenseTransactions) {
      const cat = (tx.category || 'General').trim() || 'General';
      const entry = byCat.get(cat) || { spend: 0, count: 0 };
      entry.spend += getTransactionNzdAmount(tx);
      entry.count += 1;
      byCat.set(cat, entry);
    }

    const categories: TagCategoryBreakdownItem[] = Array.from(byCat.entries())
      .map(([category, data]) => ({
        category,
        total_spend: Math.round(data.spend * 100) / 100,
        transaction_count: data.count,
        percentage:
          roundedTotal > 0 ? Math.round((data.spend / roundedTotal) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.total_spend - a.total_spend || a.category.localeCompare(b.category));

    return {
      totalSpend: roundedTotal,
      txCount: expenseTransactions.length,
      categories,
    };
  }, [loading, transactions.length, summary, expenseTransactions]);

  const filteredTransactions = useMemo(() => {
    let base = collapsedTransactions;
    if (selectedCategory !== 'ALL') {
      base = base.filter(
        (tx) => (tx.category || 'General').toLowerCase() === selectedCategory.toLowerCase()
      );
    }
    if (!searchQuery.trim()) return base;
    const q = searchQuery.toLowerCase().replace(/^#+/, '');
    return base.filter(
      (tx) =>
        tx.merchant.toLowerCase().includes(q) ||
        tx.category.toLowerCase().includes(q) ||
        (tx.account_name || '').toLowerCase().includes(q) ||
        (tx.linked_account_name || '').toLowerCase().includes(q) ||
        (tx.counterpart_account_name || '').toLowerCase().includes(q) ||
        (tx.loan_name || '').toLowerCase().includes(q) ||
        (tx.raw_description || '').toLowerCase().includes(q) ||
        (tx.tags || []).some((tag) => tag.toLowerCase().includes(q))
    );
  }, [collapsedTransactions, selectedCategory, searchQuery]);

  if (!summary) return null;

  const periodLabel = formatPeriodLabel(period);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Inspect Tag: #${tagName}`}
      className="sm:max-w-2xl"
    >
      <div className="space-y-4" data-testid="tag-inspection-modal">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs text-slate-300 bg-card/60 p-3 rounded-xl border border-border gap-2">
          <div className="flex items-center space-x-2 flex-wrap gap-y-1">
            <span className="p-1 rounded bg-amber-500/10 text-amber-400">
              <Tag className="w-3.5 h-3.5" />
            </span>
            <span className="font-semibold text-amber-300">#{tagName}</span>
            <span className="text-[11px] text-slate-400">({periodLabel})</span>
          </div>
          <div className="text-[11px] text-slate-400">
            {summary.first_date === summary.last_date
              ? summary.last_date
              : `${summary.first_date} to ${summary.last_date}`}
          </div>
        </div>

        <SummaryMetricGrid
          columns={3}
          items={[
            {
              id: 'tag-total-nzd',
              label: 'Total Spend (NZD)',
              value: formatMoney(computedStats.totalSpend, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              }),
              valueClassName: 'text-slate-100 font-mono text-xs sm:text-sm tracking-tight',
            },
            {
              id: 'tag-txn-count',
              label: 'Expenses',
              value: computedStats.txCount,
              valueClassName: 'text-amber-300 font-mono text-xs sm:text-sm tracking-tight',
            },
            {
              id: 'tag-category-count',
              label: 'Categories',
              value: computedStats.categories.length,
              valueClassName: 'text-slate-200 font-mono text-xs sm:text-sm tracking-tight',
            },
          ]}
        />

        {computedStats.categories.length > 0 && (
          <div className="space-y-2" data-testid="tag-category-breakdown">
            <div className="flex items-center justify-between text-[11px] text-slate-400 px-0.5">
              <span>Breakdown by Category (tap to filter)</span>
              <span>
                {computedStats.categories.length}{' '}
                {computedStats.categories.length === 1 ? 'category' : 'categories'}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setSelectedCategory('ALL')}
                className={`text-[11px] px-2.5 py-1 rounded-lg border transition-colors ${
                  selectedCategory === 'ALL'
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 font-semibold'
                    : 'bg-card/50 text-slate-300 border-border hover:border-amber-500/30'
                }`}
              >
                All ({computedStats.txCount})
              </button>
              {computedStats.categories.map((cat) => {
                const isSelected = selectedCategory.toLowerCase() === cat.category.toLowerCase();
                return (
                  <button
                    type="button"
                    key={cat.category}
                    onClick={() =>
                      setSelectedCategory(isSelected ? 'ALL' : cat.category)
                    }
                    className={`text-[11px] px-2.5 py-1 rounded-lg border transition-colors ${
                      isSelected
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 font-semibold'
                        : 'bg-card/50 text-slate-300 border-border hover:border-amber-500/30'
                    }`}
                  >
                    {cat.category}: {formatMoney(cat.total_spend)} ({cat.percentage.toFixed(0)}%)
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {error && <AlertBanner variant="error">{error}</AlertBanner>}
        {successNote && (
          <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-xs text-emerald-300 flex items-center space-x-2 animate-in fade-in">
            <Check className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
            <span>{successNote}</span>
          </div>
        )}

        {transactions.length > 0 && (
          <SearchInput
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Filter by merchant, category, or account..."
            variant="amber"
          />
        )}

        <TransactionList
          transactions={filteredTransactions}
          categories={categoryNames}
          loading={loading}
          loadingLabel={`Loading #${tagName} transactions...`}
          emptyTitle={`No transactions found for #${tagName} in ${periodLabel.toLowerCase()}.`}
          updatingId={updatingId}
          onCategoryChange={(txId, cat) => {
            setError(null);
            void handleCategoryChange(txId, cat);
          }}
          onTagsChange={(txId, newTags) => {
            setError(null);
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
            onTagDataChanged();
          }}
          showAccountBadge
        />

        <div className="pt-2 flex justify-end">
          <Button variant="outline" size="sm" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>

      <RulesManagerModal
        isOpen={isRulesModalOpen}
        onClose={closeRulesModal}
        prefillRule={rulePrefill}
        onRulesApplied={() => {
          void loadTransactions();
          onTagDataChanged();
        }}
      />
    </Modal>
  );
};
