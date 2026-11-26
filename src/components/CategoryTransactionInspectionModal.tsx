import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRightLeft, Layers, Repeat } from 'lucide-react';
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
  useCategories,
} from '../taxonomy';
import {
  buildInspectionListProps,
  InspectionContextErrorBanner,
  matchesInspectionSearch,
  partitionCashflowTransactions,
  SharedInspectionListProps,
  useInspectionContext,
  useInspectionScope,
  useTransactionMutation,
} from '../inspection';
import { PeriodType, Transaction } from '../types';
import { formatMoney, getTransactionNzdAmount } from '../utils/format';
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
  onCategoryChanged: () => Promise<void> | void;
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
  emptyTitle: string;
  sharedListProps: SharedInspectionListProps;
}

const CategorySectionsBody: React.FC<CategorySectionsBodyProps> = ({
  loading, hasSupplementalSections, filteredActual, filteredAmortized, filteredExcluded,
  actualVolume, amortizedVolume, cadenceUnit, searchQuery, category, periodLabel, emptyTitle, sharedListProps,
}) => {
  if (!hasSupplementalSections) {
    return (
      <TransactionList
        transactions={filteredActual}
        loading={loading}
        loadingLabel="Loading transactions..."
        emptyTitle={emptyTitle}
        {...sharedListProps}
      />
    );
  }
  if (loading) return <LoadingState label="Loading transactions..." variant="brand" />;
  if (filteredActual.length === 0 && filteredAmortized.length === 0 && filteredExcluded.length === 0) {
    const resolvedEmptyTitle = searchQuery.trim()
      ? 'No matching transactions or commitments.'
      : `No transactions found for ${category} in ${periodLabel.toLowerCase()}.`;
    return <EmptyState title={resolvedEmptyTitle} variant="dashed" />;
  }

  return (
    <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-1" data-testid="category-inspection-scroll-container">
      {filteredActual.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
            <span className="font-medium text-slate-300">Transactions in Period ({filteredActual.length})</span>
            <span className="font-mono text-slate-300">{formatMoney(actualVolume, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} NZD</span>
          </div>
          <TransactionList transactions={filteredActual} loading={false} scrollable={false} emptyTitle="" {...sharedListProps} />
        </div>
      )}
      {filteredAmortized.length > 0 && (
        <div className="space-y-2" data-testid="amortized-commitments-section">
          <div className="flex items-center justify-between text-[11px] text-sky-300 px-1">
            <span className="inline-flex items-center gap-1.5 font-medium"><Repeat className="w-3 h-3 text-sky-400" /><span>Amortized Recurring Commitments ({filteredAmortized.length})</span></span>
            <span className="font-mono">{formatMoney(amortizedVolume, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} NZD/{cadenceUnit}</span>
          </div>
          <TransactionList transactions={filteredAmortized} loading={false} scrollable={false} emptyTitle="" {...sharedListProps} />
        </div>
      )}
      {filteredExcluded.length > 0 && (
        <div className="space-y-2" data-testid="excluded-transactions-section">
          <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
            <span className="font-medium">Excluded from Period Budget ({filteredExcluded.length})</span>
          </div>
          <TransactionList transactions={filteredExcluded} loading={false} scrollable={false} emptyTitle="" {...sharedListProps} />
        </div>
      )}
    </div>
  );
};

const CategoryTransferNotice: React.FC<{ reconciling: boolean; onReconcile: () => void }> = ({
  reconciling,
  onReconcile,
}) => (
  <div className="space-y-2">
    <AlertBanner variant="info" title="Inter-Account Transfers & Foreign Exchange">
      Transactions classified under Transfers represent money moving between your own accounts (such as ASB, DBS Singapore, Philippine banks, Bitcoin/crypto wallets, or Wise). They are excluded from your operational spending and weekly burn calculations.
    </AlertBanner>
    <div className="flex justify-end">
      <Button variant="secondary" size="xs" loading={reconciling} loadingText="Pairing..." icon={<ArrowRightLeft className="w-3.5 h-3.5 text-sky-400" />} onClick={onReconcile}>
        Reconcile Transfers Now
      </Button>
    </div>
  </div>
);

function useCategoryInspectionViewState(opts: {
  isOpen: boolean;
  category?: string;
  period: PeriodType;
  startDate?: string;
  endDate?: string;
  isAnnualOverride: boolean;
  includeSubclasses: boolean;
  onCategoryChanged: () => Promise<void> | void;
}) {
  const { isOpen, category, period, startDate, endDate, isAnnualOverride, includeSubclasses, onCategoryChanged } = opts;
  const { categoryNames } = useCategories();
  const [searchQuery, setSearchQuery] = useState('');
  const isTransferCategory = Boolean(category && checkTransferCategory(category));
  const shouldIncludeAmortized = Boolean(
    category && !isTransferCategory && !isAnnualOverride &&
    (period === 'week' || period === 'last_week' || period === 'month' || period === 'last_month')
  );
  const activeEnabled = Boolean(isOpen && category);
  const ctx = useInspectionContext({ enabled: activeEnabled });
  const scope = useInspectionScope({
    enabled: activeEnabled,
    request: { kind: 'category', category: category || '', period, startDate, endDate, includeSubclasses, includeAmortized: shouldIncludeAmortized },
  });
  const mutation = useTransactionMutation({
    onTransactionUpdated: scope.patchTransactionLocal,
    reloadScope: scope.reload,
    onRefreshParent: onCategoryChanged,
    onError: scope.setError,
  });

  useEffect(() => {
    if (!activeEnabled) return;
    mutation.setSuccessNote(null);
    setSearchQuery('');
  }, [activeEnabled, category, period, startDate, endDate, includeSubclasses, shouldIncludeAmortized, mutation.setSuccessNote]);

  const partition = useMemo(() => partitionCashflowTransactions(scope.transactions), [scope.transactions]);
  const sharedListProps = buildInspectionListProps({
    categories: categoryNames, loans: ctx.loans, accounts: ctx.accounts, mutation, showAccountBadge: true,
  });
  return { ctx, scope, mutation, searchQuery, setSearchQuery, isTransferCategory, partition, sharedListProps };
}

/**
 * Modal for inspecting transactions within a spending category, reconciling
 * inter-account transfers, surfacing amortized recurring commitments, and
 * recategorizing or creating rules inline.
 */
export const CategoryTransactionInspectionModal: React.FC<
  CategoryTransactionInspectionModalProps
> = ({
  isOpen, onClose, category, period, startDate, endDate,
  isAnnualOverride = false, includeSubclasses = false, onCategoryChanged,
}) => {
  const v = useCategoryInspectionViewState({
    isOpen, category, period, startDate, endDate, isAnnualOverride, includeSubclasses, onCategoryChanged,
  });
  if (!category) return null;

  const { actualTransactions, amortizedCommitments, excludedTransactions } = v.partition;
  const periodLabel = formatPeriodLabel(period, startDate, endDate);
  const actualVolume = actualTransactions.reduce((sum, tx) => sum + getTransactionNzdAmount(tx), 0);
  const amortizedVolume = amortizedCommitments.reduce((sum, tx) => sum + Math.abs(Number(tx.amortized_period_amount_nzd ?? 0)), 0);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Inspect Category: ${category}`} className="sm:max-w-2xl">
      <div className="space-y-4" data-testid="category-inspection-modal">
        <CategoryHeaderAndMetrics
          category={category} periodLabel={periodLabel} isAnnualOverride={isAnnualOverride}
          actualCount={actualTransactions.length} amortizedCount={amortizedCommitments.length}
          actualVolume={actualVolume} amortizedVolume={amortizedVolume}
        />
        {v.isTransferCategory && (
          <CategoryTransferNotice reconciling={v.mutation.reconciling} onReconcile={() => void v.mutation.handleReconcileTransfers()} />
        )}
        <InspectionContextErrorBanner contextError={v.ctx.contextError} retrying={v.ctx.contextLoading} onRetry={() => void v.ctx.retryContext()} />
        {Boolean(v.scope.error) && <AlertBanner variant="error">{v.scope.error}</AlertBanner>}
        {Boolean(v.mutation.successNote) && <AlertBanner variant="success">{v.mutation.successNote}</AlertBanner>}
        {v.scope.transactions.length > 0 && (
          <SearchInput value={v.searchQuery} onChange={v.setSearchQuery} placeholder="Filter by merchant or account..." variant="brand" />
        )}
        <CategorySectionsBody
          loading={v.scope.loading}
          hasSupplementalSections={amortizedCommitments.length > 0 || excludedTransactions.length > 0}
          filteredActual={actualTransactions.filter((tx) => matchesInspectionSearch(tx, v.searchQuery))}
          filteredAmortized={amortizedCommitments.filter((tx) => matchesInspectionSearch(tx, v.searchQuery))}
          filteredExcluded={excludedTransactions.filter((tx) => matchesInspectionSearch(tx, v.searchQuery))}
          actualVolume={actualVolume} amortizedVolume={amortizedVolume}
          cadenceUnit={period === 'week' || period === 'last_week' ? 'wk' : 'mo'}
          searchQuery={v.searchQuery} category={category} periodLabel={periodLabel}
          emptyTitle={`No transactions found for ${category} in ${periodLabel.toLowerCase()}.`}
          sharedListProps={v.sharedListProps}
        />
        <div className="pt-2 flex justify-end"><Button variant="outline" size="sm" onClick={onClose}>Done</Button></div>
      </div>
      <RulesManagerModal isOpen={v.mutation.isRulesModalOpen} onClose={v.mutation.closeRulesModal} prefillRule={v.mutation.rulePrefill} onRulesApplied={() => void v.mutation.handleRulesApplied()} />
    </Modal>
  );
};
