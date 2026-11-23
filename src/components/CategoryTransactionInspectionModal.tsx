import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRightLeft, Check, Layers, Repeat } from 'lucide-react';
import {
  AlertBanner,
  Button,
  EmptyState,
  LoadingState,
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
import {
  fetchAccounts,
  fetchCategoryTransactions,
  fetchLoans,
  triggerReconcileTransfers,
} from '../services/api';
import { Account, LoanItem, PeriodType, Transaction } from '../types';
import { formatMoney, getTransactionNzdAmount } from '../utils/format';
import { collapsePairedTransfers } from '../utils/transfers';
import { RulesManagerModal } from './RulesManagerModal';
import { TransactionList } from './TransactionList';

interface CategoryTransactionInspectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  category?: string;
  period: PeriodType;
  startDate?: string;
  endDate?: string;
  isAnnualOverride?: boolean;
  includeSubclasses?: boolean;
  onCategoryChanged: () => void;
}

type CategoryListSharedProps = Omit<
  React.ComponentProps<typeof TransactionList>,
  'transactions' | 'loading' | 'scrollable' | 'loadingLabel'
>;

function matchesTransactionSearch(tx: Transaction, query: string): boolean {
  const q = query.trim().toLowerCase().replace(/^#+/, '');
  if (!q) return true;
  return (
    tx.merchant.toLowerCase().includes(q) ||
    (tx.account_name || '').toLowerCase().includes(q) ||
    (tx.linked_account_name || '').toLowerCase().includes(q) ||
    (tx.counterpart_account_name || '').toLowerCase().includes(q) ||
    (tx.loan_name || '').toLowerCase().includes(q) ||
    (tx.raw_description || '').toLowerCase().includes(q) ||
    (tx.recurrence || '').toLowerCase().includes(q) ||
    (tx.tags || []).some((tag) => tag.toLowerCase().includes(q))
  );
}

function partitionCategoryTransactions(collapsed: Transaction[]) {
  const actual: Transaction[] = [];
  const amortized: Transaction[] = [];
  const excluded: Transaction[] = [];
  for (const tx of collapsed) {
    if (tx.is_amortized_commitment) amortized.push(tx);
    else if (tx.excluded_from_period_budget) excluded.push(tx);
    else actual.push(tx);
  }
  return { actualTransactions: actual, amortizedCommitments: amortized, excludedTransactions: excluded };
}

interface CategoryHeaderAndMetricsProps {
  category: string;
  periodLabel: string;
  isAnnualOverride: boolean;
  actualCount: number;
  amortizedCount: number;
  actualVolume: number;
  amortizedVolume: number;
}

const CategoryHeaderAndMetrics: React.FC<CategoryHeaderAndMetricsProps> = ({
  category, periodLabel, isAnnualOverride, actualCount, amortizedCount, actualVolume, amortizedVolume,
}) => {
  const hasAmortized = amortizedCount > 0;
  const totalVolume = actualVolume + amortizedVolume;
  const budgetedCount = actualCount + amortizedCount;
  const avgTx = budgetedCount > 0 ? totalVolume / budgetedCount : 0;

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs text-slate-300 bg-card/60 p-3 rounded-xl border border-border gap-2">
        <div className="flex items-center space-x-2 flex-wrap gap-y-1">
          <span className="p-1 rounded bg-amber-500/10 text-amber-400"><Layers className="w-3.5 h-3.5" /></span>
          <span className="font-semibold text-slate-200">{category}</span>
          <span className="text-[11px] text-slate-400">({periodLabel})</span>
          {isAnnualOverride && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 font-medium" data-testid="annual-override-badge">
              52w Annual Budget Period
            </span>
          )}
        </div>
        <div className="text-[11px] text-slate-400" data-testid="category-inspection-count-summary">
          {hasAmortized
            ? `${actualCount} ${actualCount === 1 ? 'txn' : 'txns'} + ${amortizedCount} amortized`
            : `${actualCount} ${actualCount === 1 ? 'transaction' : 'transactions'}`}
        </div>
      </div>
      <SummaryMetricGrid
        columns={3}
        items={[
          { id: 'total', label: 'Total', value: formatMoney(totalVolume, { minimumFractionDigits: 2, maximumFractionDigits: 2 }), subvalue: hasAmortized ? `${formatMoney(actualVolume)} + ${formatMoney(amortizedVolume)} fixed` : undefined, valueClassName: 'text-slate-100 font-mono text-xs sm:text-sm tracking-tight' },
          { id: 'count', label: hasAmortized ? 'Items' : 'Txns', value: budgetedCount, subvalue: hasAmortized ? `${actualCount} + ${amortizedCount} fixed` : undefined, valueClassName: 'text-amber-300 font-mono text-xs sm:text-sm tracking-tight' },
          { id: 'avg', label: 'Average', value: formatMoney(avgTx, { minimumFractionDigits: 2, maximumFractionDigits: 2 }), valueClassName: 'text-slate-200 font-mono text-xs sm:text-sm tracking-tight' },
        ]}
      />
    </>
  );
};

interface CategorySectionsBodyProps {
  loading: boolean;
  hasSupplementalSections: boolean;
  filteredActual: Transaction[];
  filteredAmortized: Transaction[];
  filteredExcluded: Transaction[];
  actualVolume: number;
  amortizedVolume: number;
  cadenceUnit: string;
  searchQuery: string;
  category: string;
  periodLabel: string;
  sharedListProps: CategoryListSharedProps;
}

const CategorySectionsBody: React.FC<CategorySectionsBodyProps> = ({
  loading, hasSupplementalSections, filteredActual, filteredAmortized, filteredExcluded,
  actualVolume, amortizedVolume, cadenceUnit, searchQuery, category, periodLabel, sharedListProps,
}) => {
  if (!hasSupplementalSections) {
    return <TransactionList transactions={filteredActual} loading={loading} loadingLabel="Loading transactions..." {...sharedListProps} />;
  }
  if (loading) return <LoadingState label="Loading transactions..." variant="amber" />;
  if (filteredActual.length === 0 && filteredAmortized.length === 0 && filteredExcluded.length === 0) {
    const emptyTitle = searchQuery.trim()
      ? 'No matching transactions or commitments.'
      : `No transactions found for ${category} in ${periodLabel.toLowerCase()}.`;
    return <EmptyState title={emptyTitle} variant="dashed" />;
  }

  return (
    <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-1" data-testid="category-inspection-scroll-container">
      {filteredActual.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
            <span className="font-medium text-slate-300">Transactions in Period ({filteredActual.length})</span>
            <span className="font-mono text-slate-300">{formatMoney(actualVolume, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} NZD</span>
          </div>
          <TransactionList transactions={filteredActual} loading={false} scrollable={false} {...sharedListProps} />
        </div>
      )}
      {filteredAmortized.length > 0 && (
        <div className="space-y-2" data-testid="amortized-commitments-section">
          <div className="flex items-center justify-between text-[11px] text-sky-300 px-1">
            <span className="inline-flex items-center gap-1.5 font-medium"><Repeat className="w-3 h-3 text-sky-400" /><span>Amortized Recurring Commitments ({filteredAmortized.length})</span></span>
            <span className="font-mono">{formatMoney(amortizedVolume, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} NZD/{cadenceUnit}</span>
          </div>
          <TransactionList transactions={filteredAmortized} loading={false} scrollable={false} {...sharedListProps} />
        </div>
      )}
      {filteredExcluded.length > 0 && (
        <div className="space-y-2" data-testid="excluded-transactions-section">
          <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
            <span className="font-medium">Excluded from Period Budget ({filteredExcluded.length})</span>
          </div>
          <TransactionList transactions={filteredExcluded} loading={false} scrollable={false} {...sharedListProps} />
        </div>
      )}
    </div>
  );
};

function useCategoryReconcileAction(opts: {
  setError: (msg: string | null) => void;
  setSuccessNote: (msg: string | null) => void;
  loadTransactions: () => Promise<void>;
  onCategoryChanged: () => void;
}) {
  const { setError, setSuccessNote, loadTransactions, onCategoryChanged } = opts;
  const [reconciling, setReconciling] = useState(false);

  const handleReconcileTransfers = useCallback(async () => {
    setReconciling(true);
    setError(null);
    try {
      const res = await triggerReconcileTransfers();
      setSuccessNote(
        res.matched_transfers > 0
          ? `Successfully reconciled and paired ${res.matched_transfers} transfer legs!`
          : 'All transfers are currently reconciled.'
      );
      void loadTransactions();
      onCategoryChanged();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to reconcile transfers');
    } finally {
      setReconciling(false);
    }
  }, [setError, setSuccessNote, loadTransactions, onCategoryChanged]);

  return { reconciling, handleReconcileTransfers };
}

function useCategoryInspectionData(opts: {
  isOpen: boolean;
  category?: string;
  period: PeriodType;
  startDate?: string;
  endDate?: string;
  includeSubclasses: boolean;
  shouldIncludeAmortized: boolean;
  onCategoryChanged: () => void;
}) {
  const { isOpen, category, period, startDate, endDate, includeSubclasses, shouldIncludeAmortized, onCategoryChanged } = opts;
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loans, setLoans] = useState<LoanItem[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const mutationSucceededRef = useRef(false);

  const handleTransactionUpdated = useCallback((txId: number, patch: Partial<Transaction>) => {
    mutationSucceededRef.current = true;
    setTransactions((prev) => prev.map((t) => (t.id === txId ? { ...t, ...patch } : t)));
  }, []);

  const mutation = useTransactionCategoryMutation({
    onTransactionUpdated: handleTransactionUpdated,
    onChanged: onCategoryChanged,
    onError: (msg) => setError(msg || null),
  });

  const loadTransactions = useCallback(async () => {
    if (!category) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetchCategoryTransactions(
        category, period, period === 'custom' ? startDate : undefined, period === 'custom' ? endDate : undefined, includeSubclasses, shouldIncludeAmortized
      );
      setTransactions(res);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to load category transactions');
    } finally {
      setLoading(false);
    }
  }, [category, period, startDate, endDate, includeSubclasses, shouldIncludeAmortized]);

  useEffect(() => {
    if (!isOpen || !category) return;
    mutation.setSuccessNote(null);
    setSearchQuery('');
    void loadTransactions();
    fetchLoans().then((r) => setLoans(r.loans || [])).catch(() => setLoans([]));
    fetchAccounts().then(setAccounts).catch(() => setAccounts([]));
  }, [isOpen, category, loadTransactions]);

  const { reconciling, handleReconcileTransfers } = useCategoryReconcileAction({
    setError, setSuccessNote: mutation.setSuccessNote, loadTransactions, onCategoryChanged,
  });

  return {
    transactions, loans, accounts, loading, error, setError, reconciling, searchQuery, setSearchQuery,
    mutation, mutationSucceededRef, loadTransactions, handleTransactionUpdated, handleReconcileTransfers,
  };
}

function buildCategoryListProps(opts: {
  categoryNames: readonly string[];
  emptyTitle: string;
  data: ReturnType<typeof useCategoryInspectionData>;
  onCategoryChanged: () => void;
}): CategoryListSharedProps {
  const { categoryNames, emptyTitle, data, onCategoryChanged } = opts;
  const runAndReload = async (task: Promise<void>) => {
    data.setError(null);
    data.mutationSucceededRef.current = false;
    await task;
    if (data.mutationSucceededRef.current) void data.loadTransactions();
  };
  return {
    categories: categoryNames,
    emptyTitle,
    updatingId: data.mutation.updatingId,
    loans: data.loans,
    accounts: data.accounts,
    showAccountBadge: true,
    onCategoryChange: (txId, cat) => void runAndReload(data.mutation.handleCategoryChange(txId, cat)),
    onTagsChange: (txId, tags) => void data.mutation.handleTagsChange(txId, tags),
    onRecurrenceChange: (txId, rec) => void runAndReload(data.mutation.handleRecurrenceChange(txId, rec ?? null)),
    onLoanChange: (txId, loanId, amt) => {
      const matched = data.loans.find((l) => l.id === loanId);
      void runAndReload(data.mutation.handleLoanChange(txId, loanId, amt, matched?.name ?? null, matched?.loan_type ?? null));
    },
    onCounterpartChange: (txId, counterpartId) => {
      const matched = data.accounts.find((a) => a.id === counterpartId) ?? null;
      void runAndReload(data.mutation.handleCounterpartChange(txId, counterpartId, matched));
    },
    onCreateRule: data.mutation.handleCreateRuleFromTx,
    onReceiptUpdated: () => { void data.loadTransactions(); onCategoryChanged(); },
    onSplitsUpdated: (updatedTx) => {
      data.handleTransactionUpdated(updatedTx.id, updatedTx);
      data.mutation.setSuccessNote(updatedTx.is_split ? 'Saved transaction splits' : 'Cleared transaction splits');
    },
  };
}

/**
 * Modal for inspecting transactions within a spending category, reconciling
 * inter-account transfers, surfacing amortized recurring commitments, and
 * recategorizing or creating rules inline.
 */
export const CategoryTransactionInspectionModal: React.FC<
  CategoryTransactionInspectionModalProps
> = ({ isOpen, onClose, category, period, startDate, endDate, isAnnualOverride = false, includeSubclasses = false, onCategoryChanged }) => {
  const { categoryNames } = useCategories();
  const isTransferCategory = Boolean(category && checkTransferCategory(category));
  const shouldIncludeAmortized = Boolean(
    category && !isTransferCategory && !isAnnualOverride &&
    (period === 'week' || period === 'last_week' || period === 'month' || period === 'last_month')
  );
  const data = useCategoryInspectionData({
    isOpen, category, period, startDate, endDate, includeSubclasses, shouldIncludeAmortized, onCategoryChanged,
  });
  const collapsed = useMemo(() => collapsePairedTransfers(data.transactions), [data.transactions]);
  const { actualTransactions, amortizedCommitments, excludedTransactions } = useMemo(
    () => partitionCategoryTransactions(collapsed),
    [collapsed]
  );
  if (!category) return null;

  const periodLabel = formatPeriodLabel(period, startDate, endDate);
  const actualVolume = actualTransactions.reduce((sum, tx) => sum + getTransactionNzdAmount(tx), 0);
  const amortizedVolume = amortizedCommitments.reduce((sum, tx) => sum + Math.abs(Number(tx.amortized_period_amount_nzd ?? 0)), 0);
  const sharedListProps = buildCategoryListProps({
    categoryNames, emptyTitle: `No transactions found for ${category} in ${periodLabel.toLowerCase()}.`, data, onCategoryChanged,
  });

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Inspect Category: ${category}`} className="sm:max-w-2xl">
      <div className="space-y-4" data-testid="category-inspection-modal">
        <CategoryHeaderAndMetrics category={category} periodLabel={periodLabel} isAnnualOverride={isAnnualOverride} actualCount={actualTransactions.length} amortizedCount={amortizedCommitments.length} actualVolume={actualVolume} amortizedVolume={amortizedVolume} />
        {isTransferCategory && (
          <div className="space-y-2">
            <AlertBanner variant="info" title="Inter-Account Transfers & Foreign Exchange">
              Transactions classified under Transfers represent money moving between your own accounts (such as ASB, DBS Singapore, Philippine banks, Bitcoin/crypto wallets, or Wise). They are excluded from your operational spending and weekly burn calculations.
            </AlertBanner>
            <div className="flex justify-end">
              <Button variant="secondary" size="xs" loading={data.reconciling} loadingText="Pairing..." icon={<ArrowRightLeft className="w-3.5 h-3.5 text-sky-400" />} onClick={data.handleReconcileTransfers}>
                Reconcile Transfers Now
              </Button>
            </div>
          </div>
        )}
        {Boolean(data.error) && <AlertBanner variant="error">{data.error}</AlertBanner>}
        {Boolean(data.mutation.successNote) && (
          <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-xs text-emerald-300 flex items-center space-x-2 animate-in fade-in">
            <Check className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
            <span>{data.mutation.successNote}</span>
          </div>
        )}
        {data.transactions.length > 0 && (
          <SearchInput value={data.searchQuery} onChange={data.setSearchQuery} placeholder="Filter by merchant or account..." variant="amber" />
        )}
        <CategorySectionsBody
          loading={data.loading}
          hasSupplementalSections={amortizedCommitments.length > 0 || excludedTransactions.length > 0}
          filteredActual={actualTransactions.filter((tx) => matchesTransactionSearch(tx, data.searchQuery))}
          filteredAmortized={amortizedCommitments.filter((tx) => matchesTransactionSearch(tx, data.searchQuery))}
          filteredExcluded={excludedTransactions.filter((tx) => matchesTransactionSearch(tx, data.searchQuery))}
          actualVolume={actualVolume}
          amortizedVolume={amortizedVolume}
          cadenceUnit={period === 'week' || period === 'last_week' ? 'wk' : 'mo'}
          searchQuery={data.searchQuery}
          category={category}
          periodLabel={periodLabel}
          sharedListProps={sharedListProps}
        />
        <div className="pt-2 flex justify-end"><Button variant="outline" size="sm" onClick={onClose}>Done</Button></div>
      </div>
      <RulesManagerModal isOpen={data.mutation.isRulesModalOpen} onClose={data.mutation.closeRulesModal} prefillRule={data.mutation.rulePrefill} onRulesApplied={() => { void data.loadTransactions(); onCategoryChanged(); }} />
    </Modal>
  );
};
