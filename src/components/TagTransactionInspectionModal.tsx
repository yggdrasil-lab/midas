import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Tag } from 'lucide-react';
import { AlertBanner, Button, Modal, SearchInput, SummaryMetricGrid } from '@yggdrasil-lab/ui';
import { formatPeriodLabel, isTransferCategory as checkTransferCategory } from '../constants/categories';
import { useCategories } from '../hooks/useCategories';
import { useTransactionCategoryMutation } from '../hooks/useTransactionCategoryMutation';
import { fetchAccounts, fetchLoans, fetchTagTransactions } from '../services/api';
import { Account, LoanItem, PeriodType, TagCategoryBreakdownItem, TagSpendingSummaryItem, Transaction } from '../types';
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

function computeTagStats(
  loading: boolean,
  transactionsCount: number,
  summary: TagSpendingSummaryItem | null,
  expenseTransactions: Transaction[]
) {
  if (loading && transactionsCount === 0 && summary) {
    return { totalSpend: summary.total_spend, txCount: summary.transaction_count, categories: summary.categories };
  }
  const totalSpend = expenseTransactions.reduce((sum, tx) => sum + getTransactionNzdAmount(tx), 0);
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
      percentage: roundedTotal > 0 ? Math.round((data.spend / roundedTotal) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.total_spend - a.total_spend || a.category.localeCompare(b.category));
  return { totalSpend: roundedTotal, txCount: expenseTransactions.length, categories };
}

function filterTagTransactions(
  collapsed: Transaction[],
  selectedCategory: string,
  searchQuery: string
): Transaction[] {
  const base =
    selectedCategory === 'ALL'
      ? collapsed
      : collapsed.filter((tx) => (tx.category || 'General').toLowerCase() === selectedCategory.toLowerCase());
  const q = searchQuery.trim().toLowerCase().replace(/^#+/, '');
  if (!q) return base;
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
}

interface TagBreakdownPillsProps {
  categories: TagCategoryBreakdownItem[];
  txCount: number;
  selectedCategory: string;
  onSelectCategory: (cat: string) => void;
}

const TagBreakdownPills: React.FC<TagBreakdownPillsProps> = ({
  categories, txCount, selectedCategory, onSelectCategory,
}) => {
  if (categories.length === 0) return null;
  const pillCls = (active: boolean) =>
    `text-[11px] px-2.5 py-1 rounded-lg border transition-colors ${
      active
        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 font-semibold'
        : 'bg-card/50 text-slate-300 border-border hover:border-amber-500/30'
    }`;

  return (
    <div className="space-y-2" data-testid="tag-category-breakdown">
      <div className="flex items-center justify-between text-[11px] text-slate-400 px-0.5">
        <span>Breakdown by Category (tap to filter)</span>
        <span>{categories.length} {categories.length === 1 ? 'category' : 'categories'}</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <button type="button" onClick={() => onSelectCategory('ALL')} className={pillCls(selectedCategory === 'ALL')}>
          All ({txCount})
        </button>
        {categories.map((cat) => {
          const isSelected = selectedCategory.toLowerCase() === cat.category.toLowerCase();
          return (
            <button type="button" key={cat.category} onClick={() => onSelectCategory(isSelected ? 'ALL' : cat.category)} className={pillCls(isSelected)}>
              {cat.category}: {formatMoney(cat.total_spend)} ({cat.percentage.toFixed(0)}%)
            </button>
          );
        })}
      </div>
    </div>
  );
};

function useTagInspectionData(opts: {
  isOpen: boolean;
  tagName: string;
  period: PeriodType;
  onTagDataChanged: () => void;
}) {
  const { isOpen, tagName, period, onTagDataChanged } = opts;
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loans, setLoans] = useState<LoanItem[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  const handleTransactionUpdated = useCallback((txId: number, patch: Partial<Transaction>) => {
    setTransactions((prev) => prev.map((t) => (t.id === txId ? { ...t, ...patch } : t)));
  }, []);

  const mutation = useTransactionCategoryMutation({
    onTransactionUpdated: handleTransactionUpdated,
    onChanged: onTagDataChanged,
    onError: (msg) => setError(msg || null),
  });

  const loadTransactions = useCallback(async () => {
    if (!tagName) return;
    setLoading(true);
    setError(null);
    try {
      setTransactions(await fetchTagTransactions(tagName, period));
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to load tagged transactions');
    } finally {
      setLoading(false);
    }
  }, [tagName, period]);

  useEffect(() => {
    if (!isOpen || !tagName) return;
    mutation.setSuccessNote(null);
    setSearchQuery('');
    setSelectedCategory('ALL');
    void loadTransactions();
    fetchLoans().then((r) => setLoans(r.loans || [])).catch(() => setLoans([]));
    fetchAccounts().then(setAccounts).catch(() => setAccounts([]));
  }, [isOpen, tagName, period, loadTransactions, mutation.setSuccessNote]);

  return {
    transactions, loans, accounts, loading, error, setError, searchQuery, setSearchQuery,
    selectedCategory, setSelectedCategory, mutation, loadTransactions, handleTransactionUpdated,
  };
}

function buildTagListHandlers(opts: {
  data: ReturnType<typeof useTagInspectionData>;
  onTagDataChanged: () => void;
}) {
  const { data, onTagDataChanged } = opts;
  return {
    onCategoryChange: (txId: number, cat: string) => { data.setError(null); void data.mutation.handleCategoryChange(txId, cat); },
    onTagsChange: (txId: number, newTags: string[]) => { data.setError(null); void data.mutation.handleTagsChange(txId, newTags); },
    onRecurrenceChange: (txId: number, rec: Transaction['recurrence']) => void data.mutation.handleRecurrenceChange(txId, rec ?? null),
    onLoanChange: (txId: number, loanId: number | null, amt?: number | null) => {
      data.setError(null);
      const matched = data.loans.find((l) => l.id === loanId);
      void data.mutation.handleLoanChange(txId, loanId, amt, matched?.name ?? null, matched?.loan_type ?? null);
    },
    onCounterpartChange: (txId: number, counterpartId: number | null) => {
      data.setError(null);
      const matched = data.accounts.find((a) => a.id === counterpartId) ?? null;
      void data.mutation.handleCounterpartChange(txId, counterpartId, matched);
    },
    onCreateRule: data.mutation.handleCreateRuleFromTx,
    onReceiptUpdated: () => { void data.loadTransactions(); onTagDataChanged(); },
    onSplitsUpdated: (updatedTx: Transaction) => {
      data.handleTransactionUpdated(updatedTx.id, updatedTx);
      data.mutation.setSuccessNote(updatedTx.is_split ? 'Saved transaction splits' : 'Cleared transaction splits');
    },
  };
}

/**
 * Modal for inspecting all cross-category expenses tagged with a given trip or
 * project tag, showing category breakdown pills and inline editing controls.
 */
export const TagTransactionInspectionModal: React.FC<TagTransactionInspectionModalProps> = ({
  isOpen, onClose, summary, period, onTagDataChanged,
}) => {
  const { categoryNames } = useCategories();
  const tagName = summary?.tag || '';
  const data = useTagInspectionData({ isOpen, tagName, period, onTagDataChanged });
  const collapsed = useMemo(() => collapsePairedTransfers(data.transactions), [data.transactions]);
  const expenseTransactions = useMemo(
    () => collapsed.filter((tx) => !checkTransferCategory(tx.category, tx) && Number(tx.amount) < 0),
    [collapsed]
  );
  const computedStats = useMemo(
    () => computeTagStats(data.loading, data.transactions.length, summary, expenseTransactions),
    [data.loading, data.transactions.length, summary, expenseTransactions]
  );
  const filteredTransactions = useMemo(
    () => filterTagTransactions(collapsed, data.selectedCategory, data.searchQuery),
    [collapsed, data.selectedCategory, data.searchQuery]
  );
  if (!summary) return null;

  const periodLabel = formatPeriodLabel(period);
  const dateRangeLabel = summary.first_date === summary.last_date ? summary.last_date : `${summary.first_date} to ${summary.last_date}`;
  const handlers = buildTagListHandlers({ data, onTagDataChanged });

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Inspect Tag: #${tagName}`} className="sm:max-w-2xl">
      <div className="space-y-4" data-testid="tag-inspection-modal">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs text-slate-300 bg-card/60 p-3 rounded-xl border border-border gap-2">
          <div className="flex items-center space-x-2 flex-wrap gap-y-1">
            <span className="p-1 rounded bg-amber-500/10 text-amber-400"><Tag className="w-3.5 h-3.5" /></span>
            <span className="font-semibold text-amber-300">#{tagName}</span>
            <span className="text-[11px] text-slate-400">({periodLabel})</span>
          </div>
          <div className="text-[11px] text-slate-400">{dateRangeLabel}</div>
        </div>
        <SummaryMetricGrid
          columns={3}
          items={[
            { id: 'tag-total-nzd', label: 'Total Spend (NZD)', value: formatMoney(computedStats.totalSpend, { minimumFractionDigits: 2, maximumFractionDigits: 2 }), valueClassName: 'text-slate-100 font-mono text-xs sm:text-sm tracking-tight' },
            { id: 'tag-txn-count', label: 'Expenses', value: computedStats.txCount, valueClassName: 'text-amber-300 font-mono text-xs sm:text-sm tracking-tight' },
            { id: 'tag-category-count', label: 'Categories', value: computedStats.categories.length, valueClassName: 'text-slate-200 font-mono text-xs sm:text-sm tracking-tight' },
          ]}
        />
        <TagBreakdownPills categories={computedStats.categories} txCount={computedStats.txCount} selectedCategory={data.selectedCategory} onSelectCategory={data.setSelectedCategory} />
        {Boolean(data.error) && <AlertBanner variant="error">{data.error}</AlertBanner>}
        {Boolean(data.mutation.successNote) && (
          <AlertBanner variant="success">{data.mutation.successNote}</AlertBanner>
        )}
        {data.transactions.length > 0 && (
          <SearchInput value={data.searchQuery} onChange={data.setSearchQuery} placeholder="Filter by merchant, category, or account..." variant="amber" />
        )}
        <TransactionList
          transactions={filteredTransactions} categories={categoryNames} loading={data.loading} loadingLabel={`Loading #${tagName} transactions...`}
          emptyTitle={`No transactions found for #${tagName} in ${periodLabel.toLowerCase()}.`} updatingId={data.mutation.updatingId}
          loans={data.loans} accounts={data.accounts} showAccountBadge {...handlers}
        />
        <div className="pt-2 flex justify-end"><Button variant="outline" size="sm" onClick={onClose}>Done</Button></div>
      </div>
      <RulesManagerModal isOpen={data.mutation.isRulesModalOpen} onClose={data.mutation.closeRulesModal} prefillRule={data.mutation.rulePrefill} onRulesApplied={() => { void data.loadTransactions(); onTagDataChanged(); }} />
    </Modal>
  );
};
