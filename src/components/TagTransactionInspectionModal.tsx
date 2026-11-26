import React, { useEffect, useMemo, useState } from 'react';
import { Tag } from 'lucide-react';
import { AlertBanner, Button, Modal, SearchInput, SummaryMetricGrid } from '@yggdrasil-lab/ui';
import {
  formatPeriodLabel,
  isTransferCategory as checkTransferCategory,
  useCategories,
} from '../taxonomy';
import {
  buildInspectionListProps,
  computeTagStats,
  filterTagTransactions,
  InspectionContextErrorBanner,
  useInspectionContext,
  useInspectionScope,
  useTransactionMutation,
} from '../inspection';
import { PeriodType, TagCategoryBreakdownItem, TagSpendingSummaryItem } from '../types';
import { formatMoney } from '../utils/format';
import { RulesManagerModal } from './RulesManagerModal';
import { TransactionList } from './TransactionList';

interface TagTransactionInspectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  summary: TagSpendingSummaryItem | null;
  period: PeriodType;
  onTagDataChanged: () => Promise<void> | void;
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

function useTagInspectionViewState(opts: {
  isOpen: boolean;
  summary: TagSpendingSummaryItem | null;
  period: PeriodType;
  onTagDataChanged: () => Promise<void> | void;
}) {
  const { isOpen, summary, period, onTagDataChanged } = opts;
  const { categoryNames } = useCategories();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const tagName = summary?.tag || '';
  const activeEnabled = Boolean(isOpen && tagName);

  const ctx = useInspectionContext({ enabled: activeEnabled });
  const scope = useInspectionScope({ enabled: activeEnabled, request: { kind: 'tag', tag: tagName, period } });
  const mutation = useTransactionMutation({
    onTransactionUpdated: scope.patchTransactionLocal,
    reloadScope: scope.reload,
    onRefreshParent: onTagDataChanged,
    onError: scope.setError,
  });

  useEffect(() => {
    if (!activeEnabled) return;
    mutation.setSuccessNote(null);
    setSearchQuery('');
    setSelectedCategory('ALL');
  }, [activeEnabled, tagName, period, mutation.setSuccessNote]);

  const expenseTransactions = useMemo(
    () => scope.transactions.filter((tx) => !checkTransferCategory(tx.category, tx) && Number(tx.amount) < 0),
    [scope.transactions]
  );
  const computedStats = useMemo(
    () => computeTagStats(scope.loading, scope.transactions.length, summary, expenseTransactions),
    [scope.loading, scope.transactions.length, summary, expenseTransactions]
  );
  const filteredTransactions = useMemo(
    () => filterTagTransactions(scope.transactions, selectedCategory, searchQuery),
    [scope.transactions, selectedCategory, searchQuery]
  );
  const listProps = buildInspectionListProps({
    categories: categoryNames, loans: ctx.loans, accounts: ctx.accounts, mutation, showAccountBadge: true,
  });
  return { tagName, ctx, scope, mutation, searchQuery, setSearchQuery, selectedCategory, setSelectedCategory, computedStats, filteredTransactions, listProps };
}

/**
 * Modal for inspecting all cross-category expenses tagged with a given trip or
 * project tag, showing category breakdown pills and inline editing controls.
 */
export const TagTransactionInspectionModal: React.FC<TagTransactionInspectionModalProps> = ({
  isOpen, onClose, summary, period, onTagDataChanged,
}) => {
  const v = useTagInspectionViewState({ isOpen, summary, period, onTagDataChanged });
  if (!summary) return null;

  const periodLabel = formatPeriodLabel(period);
  const dateRangeLabel = summary.first_date === summary.last_date ? summary.last_date : `${summary.first_date} to ${summary.last_date}`;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Inspect Tag: #${v.tagName}`} className="sm:max-w-2xl">
      <div className="space-y-4" data-testid="tag-inspection-modal">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs text-slate-300 bg-card/60 p-3 rounded-xl border border-border gap-2">
          <div className="flex items-center space-x-2 flex-wrap gap-y-1">
            <span className="p-1 rounded bg-amber-500/10 text-amber-400"><Tag className="w-3.5 h-3.5" /></span>
            <span className="font-semibold text-amber-300">#{v.tagName}</span>
            <span className="text-[11px] text-slate-400">({periodLabel})</span>
          </div>
          <div className="text-[11px] text-slate-400">{dateRangeLabel}</div>
        </div>
        <SummaryMetricGrid
          columns={3}
          items={[
            { id: 'tag-total-nzd', label: 'Total Spend (NZD)', value: formatMoney(v.computedStats.totalSpend, { minimumFractionDigits: 2, maximumFractionDigits: 2 }), valueClassName: 'text-slate-100 font-mono text-xs sm:text-sm tracking-tight' },
            { id: 'tag-txn-count', label: 'Expenses', value: v.computedStats.txCount, valueClassName: 'text-amber-300 font-mono text-xs sm:text-sm tracking-tight' },
            { id: 'tag-category-count', label: 'Categories', value: v.computedStats.categories.length, valueClassName: 'text-slate-200 font-mono text-xs sm:text-sm tracking-tight' },
          ]}
        />
        <TagBreakdownPills categories={v.computedStats.categories} txCount={v.computedStats.txCount} selectedCategory={v.selectedCategory} onSelectCategory={v.setSelectedCategory} />
        <InspectionContextErrorBanner contextError={v.ctx.contextError} retrying={v.ctx.contextLoading} onRetry={() => void v.ctx.retryContext()} />
        {Boolean(v.scope.error) && <AlertBanner variant="error">{v.scope.error}</AlertBanner>}
        {Boolean(v.mutation.successNote) && <AlertBanner variant="success">{v.mutation.successNote}</AlertBanner>}
        {v.scope.transactions.length > 0 && (
          <SearchInput value={v.searchQuery} onChange={v.setSearchQuery} placeholder="Filter by merchant, category, or account..." variant="brand" />
        )}
        <TransactionList
          transactions={v.filteredTransactions}
          loading={v.scope.loading}
          loadingLabel={`Loading #${v.tagName} transactions...`}
          emptyTitle={`No transactions found for #${v.tagName} in ${periodLabel.toLowerCase()}.`}
          {...v.listProps}
        />
        <div className="pt-2 flex justify-end"><Button variant="outline" size="sm" onClick={onClose}>Done</Button></div>
      </div>
      <RulesManagerModal isOpen={v.mutation.isRulesModalOpen} onClose={v.mutation.closeRulesModal} prefillRule={v.mutation.rulePrefill} onRulesApplied={() => void v.mutation.handleRulesApplied()} />
    </Modal>
  );
};
