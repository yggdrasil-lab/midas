import React, { useMemo } from 'react';
import { ArrowDownLeft, ArrowUpRight, CalendarClock, Repeat } from 'lucide-react';
import {
  AlertBanner,
  Button,
  CollapsibleSection,
  EmptyState,
  FilterChipBar,
  LoadMoreFooter,
  LoadingState,
  Modal,
  SearchInput,
  SegmentedControl,
  SummaryMetricGrid,
  SummaryMetricItem,
} from '@yggdrasil-lab/ui';
import { getCategoryIcon } from '../constants/categoryIcons';
import { formatPeriodLabel, toTaxonomySlug, useCategories } from '../taxonomy';
import {
  buildInspectionListProps,
  CashflowSummaryMetrics,
  computeCashflowSummary,
  deriveAnnualizedCategories,
  deriveOutflowCategoryChips,
  getAnnualizedPeriodShare,
  InspectionContextErrorBanner,
  isBudgetCadencePeriod,
  isWeeklyBudgetPeriod,
  matchesInspectionSearch,
  partitionCashflowTransactions,
  SharedInspectionListProps,
  useCashflowInspectionScope,
  useInspectionContext,
  useTransactionMutation,
} from '../inspection';
import {
  CashflowDirection,
  CategorizationRuleCreate,
  CategorySpendingReport,
  PeriodType,
  SpendingBreakdownResponse,
  Transaction,
} from '../types';
import { formatMoney, getTransactionNzdAmount } from '../utils/format';
import { RulesManagerModal } from './RulesManagerModal';
import { TransactionList } from './TransactionList';

export interface CashflowTransactionInspectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialFlow: CashflowDirection;
  period: PeriodType;
  startDate?: string;
  endDate?: string;
  includeSubclasses?: boolean;
  breakdown: SpendingBreakdownResponse | null;
  onDataChanged: () => Promise<void> | void;
  onInspectCategory?: (category: string) => void;
}

const MONEY_OPTS = { minimumFractionDigits: 2, maximumFractionDigits: 2 };

interface CashflowHeaderBannerProps {
  activeFlow: CashflowDirection;
  periodLabel: string;
  onSwitchFlow: (flow: CashflowDirection) => void;
}

const CashflowHeaderBanner: React.FC<CashflowHeaderBannerProps> = ({
  activeFlow, periodLabel, onSwitchFlow,
}) => (
  <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-card/60 p-3 rounded-xl border border-border gap-2">
    <div className="flex items-center gap-2 text-xs text-slate-300 flex-wrap">
      <span className="p-1 rounded bg-amber-500/10 text-amber-400">
        {activeFlow === 'inflow' ? <ArrowDownLeft className="w-3.5 h-3.5" /> : <ArrowUpRight className="w-3.5 h-3.5" />}
      </span>
      <span className="font-semibold text-slate-200">
        {activeFlow === 'inflow' ? 'Inflow Ledger' : 'Outflow Reconciliation'}
      </span>
      <span className="text-[11px] text-slate-400">({periodLabel})</span>
    </div>
    <SegmentedControl<CashflowDirection>
      options={[{ id: 'inflow', label: 'Inflow' }, { id: 'outflow', label: 'Outflow' }]}
      value={activeFlow}
      onChange={onSwitchFlow}
      variant="brand"
      size="sm"
      idPrefix="cashflow-modal-flow"
    />
  </div>
);

function buildSummaryGridItems(
  activeFlow: CashflowDirection,
  selectedCategory: string,
  summary: CashflowSummaryMetrics
): SummaryMetricItem[] {
  return [
    {
      id: 'cashflow-total',
      label: activeFlow === 'inflow' ? 'Inflow' : 'Outflow',
      value: <span className="text-xs sm:text-sm tracking-tight">{formatMoney(summary.headlineTotal, MONEY_OPTS)}</span>,
      subvalue: selectedCategory === 'ALL' ? 'NZD' : `${selectedCategory} (NZD)`,
      valueClassName: activeFlow === 'inflow' ? 'text-emerald-400 font-mono' : 'text-slate-100 font-mono',
    },
    {
      id: 'cashflow-count',
      label: 'Items',
      value: <span className="text-xs sm:text-sm tracking-tight">{summary.itemCount}</span>,
      subvalue: summary.itemSubvalue,
      valueClassName: 'text-amber-300 font-mono',
    },
    {
      id: 'cashflow-third',
      label: summary.thirdMetricLabel,
      value: <span className="text-xs sm:text-sm tracking-tight">{formatMoney(summary.thirdMetricValue, MONEY_OPTS)}</span>,
      subvalue: summary.thirdMetricSubvalue,
      valueClassName: 'text-slate-200 font-mono',
    },
  ];
}

interface CashflowCategoryChipsProps {
  categories: string[];
  selectedCategory: string;
  onSelect: (category: string) => void;
}

const CashflowCategoryChips: React.FC<CashflowCategoryChipsProps> = ({
  categories, selectedCategory, onSelect,
}) => {
  if (categories.length === 0) return null;
  const options = [
    { id: 'ALL', label: 'All', testId: 'cashflow-chip-all' },
    ...categories.map((cat) => ({
      id: cat,
      label: cat,
      testId: `cashflow-chip-${toTaxonomySlug(cat)}`,
    })),
  ];

  return (
    <FilterChipBar
      data-testid="cashflow-category-chips"
      options={options}
      selectedId={selectedCategory}
      onSelect={onSelect}
      toggleDeselectId="ALL"
      variant="brand"
      size="sm"
    />
  );
};

interface AnnualizedCategoryCardProps {
  cat: CategorySpendingReport;
  isWeekly: boolean;
  onInspectCategory?: (category: string) => void;
}

const AnnualizedCategoryCard: React.FC<AnnualizedCategoryCardProps> = ({
  cat, isWeekly, onInspectCategory,
}) => {
  const cadenceUnit = isWeekly ? 'wk' : 'mo';
  const share = getAnnualizedPeriodShare(cat.total_spend, isWeekly);
  return (
    <div data-testid={`cashflow-annual-card-${toTaxonomySlug(cat.category)}`} className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/25 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 min-w-0">
        <span className="p-1.5 rounded-lg bg-background border border-border/70 shrink-0">{getCategoryIcon(cat.category)}</span>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-semibold text-slate-100 truncate">{cat.category}</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/15 border border-amber-500/30 text-amber-300 font-medium">52w Annual</span>
          </div>
          <div className="text-[11px] font-mono text-slate-400">
            -{formatMoney(share, MONEY_OPTS)} NZD/{cadenceUnit} | From {formatMoney(cat.total_spend, MONEY_OPTS)} NZD/52w
          </div>
        </div>
      </div>
      {Boolean(onInspectCategory) && (
        <Button variant="outline" size="xs" onClick={() => onInspectCategory?.(cat.category)} data-testid={`cashflow-annual-inspect-${toTaxonomySlug(cat.category)}`} className="shrink-0 border-amber-500/30 text-amber-300 hover:bg-amber-500/10">
          Inspect 52w
        </Button>
      )}
    </div>
  );
};

interface AnnualizedCategoryShareSectionProps {
  categories: CategorySpendingReport[];
  isWeekly: boolean;
  totalShareNzd: number;
  onInspectCategory?: (category: string) => void;
}

const AnnualizedCategoryShareSection: React.FC<AnnualizedCategoryShareSectionProps> = ({
  categories, isWeekly, totalShareNzd, onInspectCategory,
}) => {
  if (categories.length === 0) return null;
  const cadenceUnit = isWeekly ? 'wk' : 'mo';
  return (
    <div className="space-y-2" data-testid="cashflow-annualized-section">
      <div className="flex items-center justify-between text-[11px] text-amber-300 px-1">
        <span className="inline-flex items-center gap-1.5 font-medium">
          <CalendarClock className="w-3 h-3 text-amber-400" />
          <span>Annualized Categories (52-week smoothed)</span>
        </span>
        <span className="font-mono">{formatMoney(totalShareNzd, MONEY_OPTS)} NZD/{cadenceUnit}</span>
      </div>
      <div className="space-y-2">
        {categories.map((cat) => (
          <AnnualizedCategoryCard key={cat.category} cat={cat} isWeekly={isWeekly} onInspectCategory={onInspectCategory} />
        ))}
      </div>
    </div>
  );
};

interface CashflowListSectionProps {
  sectionTestId: string;
  listTestId: string;
  headerClassName: string;
  headerTitle: React.ReactNode;
  totalLabel: string;
  transactions: Transaction[];
  rowPrefix: string;
  selectPrefix: string;
  rulePrefix?: string;
  listProps: SharedInspectionListProps;
}

const CashflowListSection: React.FC<CashflowListSectionProps> = ({
  sectionTestId, listTestId, headerClassName, headerTitle, totalLabel,
  transactions, rowPrefix, selectPrefix, rulePrefix, listProps,
}) => {
  if (transactions.length === 0) return null;
  return (
    <div className="space-y-2" data-testid={sectionTestId}>
      <div className={`flex items-center justify-between text-[11px] px-1 ${headerClassName}`}>
        <span className="font-medium inline-flex items-center gap-1.5">{headerTitle}</span>
        <span className="font-mono">{totalLabel}</span>
      </div>
      <TransactionList
        transactions={transactions}
        loading={false}
        scrollable={false}
        emptyTitle=""
        listTestId={listTestId}
        getRowTestId={(tx) => `${rowPrefix}-${tx.id}`}
        getSelectTestId={(tx) => `${selectPrefix}-${tx.id}`}
        getRuleBtnTestId={rulePrefix ? (tx) => `${rulePrefix}-${tx.id}` : undefined}
        {...listProps}
      />
    </div>
  );
};

interface CashflowExcludedSectionProps {
  transactions: Transaction[];
  listProps: SharedInspectionListProps;
}

const CashflowExcludedSection: React.FC<CashflowExcludedSectionProps> = ({ transactions, listProps }) => {
  if (transactions.length === 0) return null;
  const excludedTotal = transactions.reduce((sum, tx) => sum + getTransactionNzdAmount(tx), 0);
  return (
    <div data-testid="cashflow-excluded-section">
      <CollapsibleSection
        variant="card"
        defaultOpen={false}
        className="!p-3 !bg-card/40 !rounded-xl !shadow-none"
        title={`Excluded (${transactions.length}): ${formatMoney(excludedTotal, MONEY_OPTS)} NZD`}
      >
        <TransactionList
          transactions={transactions}
          loading={false}
          scrollable={false}
          emptyTitle=""
          listTestId="cashflow-excluded-list"
          getRowTestId={(tx) => `cashflow-excluded-row-${tx.id}`}
          getSelectTestId={(tx) => `cashflow-excluded-select-${tx.id}`}
          {...listProps}
        />
      </CollapsibleSection>
    </div>
  );
};

interface CashflowSectionsBodyProps {
  activeFlow: CashflowDirection;
  periodLabel: string;
  isWeekly: boolean;
  loading: boolean;
  searchQuery: string;
  actualTransactions: Transaction[];
  amortizedCommitments: Transaction[];
  annualizedCategories: CategorySpendingReport[];
  excludedTransactions: Transaction[];
  actualVolume: number;
  amortizedVolume: number;
  annualizedShareTotal: number;
  listProps: SharedInspectionListProps;
  onInspectCategory?: (category: string) => void;
}

const CashflowScrollableSections: React.FC<Omit<CashflowSectionsBodyProps, 'loading' | 'periodLabel' | 'searchQuery'>> = ({
  activeFlow, isWeekly, actualTransactions, amortizedCommitments, annualizedCategories,
  excludedTransactions, actualVolume, amortizedVolume, annualizedShareTotal, listProps, onInspectCategory,
}) => {
  const cadenceUnit = isWeekly ? 'wk' : 'mo';
  return (
    <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-1" data-testid="cashflow-inspection-scroll-container">
      <CashflowListSection
        sectionTestId="cashflow-actual-section"
        listTestId="cashflow-actual-list"
        headerClassName="text-slate-300"
        headerTitle={`${activeFlow === 'inflow' ? 'Actual Inflows' : 'Actual Outflows'} (${actualTransactions.length})`}
        totalLabel={`${formatMoney(actualVolume, MONEY_OPTS)} NZD`}
        transactions={actualTransactions}
        rowPrefix="cashflow-tx-row"
        selectPrefix="cashflow-select-category"
        rulePrefix="cashflow-create-rule"
        listProps={listProps}
      />
      <CashflowListSection
        sectionTestId="cashflow-amortized-section"
        listTestId="cashflow-amortized-list"
        headerClassName="text-sky-300"
        headerTitle={<><Repeat className="w-3 h-3 text-sky-400" /><span>Amortized Recurring Commitments ({amortizedCommitments.length})</span></>}
        totalLabel={`${formatMoney(amortizedVolume, MONEY_OPTS)} NZD/${cadenceUnit}`}
        transactions={amortizedCommitments}
        rowPrefix="cashflow-amortized-row"
        selectPrefix="cashflow-amortized-select"
        listProps={listProps}
      />
      <AnnualizedCategoryShareSection categories={annualizedCategories} isWeekly={isWeekly} totalShareNzd={annualizedShareTotal} onInspectCategory={onInspectCategory} />
      {activeFlow === 'outflow' && <CashflowExcludedSection transactions={excludedTransactions} listProps={listProps} />}
    </div>
  );
};

const CashflowSectionsBody: React.FC<CashflowSectionsBodyProps> = (props) => {
  if (props.loading) {
    return <LoadingState label={`Loading ${props.activeFlow} transactions...`} variant="brand" />;
  }
  const hasAny =
    props.actualTransactions.length > 0 ||
    props.amortizedCommitments.length > 0 ||
    props.annualizedCategories.length > 0 ||
    props.excludedTransactions.length > 0;
  if (!hasAny) {
    const emptyTitle = props.searchQuery.trim()
      ? `No matching ${props.activeFlow} transactions.`
      : `No ${props.activeFlow} transactions found for ${props.periodLabel.toLowerCase()}.`;
    return <EmptyState title={emptyTitle} variant="dashed" />;
  }
  return <CashflowScrollableSections {...props} />;
};

interface CashflowStatusAndSearchProps {
  contextError: string | null;
  contextLoading: boolean;
  onRetryContext: () => void;
  error: string | null;
  successNote: string | null;
  hasTransactions: boolean;
  searchQuery: string;
  onSearchChange: (q: string) => void;
}

const CashflowStatusAndSearch: React.FC<CashflowStatusAndSearchProps> = ({
  contextError, contextLoading, onRetryContext, error, successNote, hasTransactions, searchQuery, onSearchChange,
}) => (
  <>
    <InspectionContextErrorBanner contextError={contextError} retrying={contextLoading} onRetry={onRetryContext} />
    {Boolean(error) && <AlertBanner variant="error">{error}</AlertBanner>}
    {Boolean(successNote) && <AlertBanner variant="success">{successNote}</AlertBanner>}
    {(hasTransactions || Boolean(searchQuery)) && (
      <SearchInput value={searchQuery} onChange={onSearchChange} placeholder="Filter merchant, category, account..." variant="brand" data-testid="cashflow-search-input" />
    )}
  </>
);

interface CashflowFooterBarProps {
  loadedRegularCount: number;
  totalCount: number;
  loadingMore: boolean;
  onLoadMore: () => void;
  onClose: () => void;
  isRulesModalOpen: boolean;
  closeRulesModal: () => void;
  rulePrefill: Partial<CategorizationRuleCreate> | null;
  onRulesApplied: () => void;
}

const CashflowFooterBar: React.FC<CashflowFooterBarProps> = ({
  loadedRegularCount, totalCount, loadingMore, onLoadMore, onClose,
  isRulesModalOpen, closeRulesModal, rulePrefill, onRulesApplied,
}) => (
  <>
    <LoadMoreFooter
      loadedCount={loadedRegularCount}
      totalCount={totalCount}
      loading={loadingMore}
      onLoadMore={onLoadMore}
      loadMoreTestId="cashflow-load-more-btn"
      doneLabel="Done"
      onDone={onClose}
    />
    <RulesManagerModal isOpen={isRulesModalOpen} onClose={closeRulesModal} prefillRule={rulePrefill} onRulesApplied={onRulesApplied} />
  </>
);

function useCashflowViewProjection(params: {
  activeFlow: CashflowDirection;
  period: PeriodType;
  selectedCategory: string;
  searchQuery: string;
  transactions: Transaction[];
  totalCount: number;
  inflowCategories: string[];
  breakdown: SpendingBreakdownResponse | null;
}) {
  const { activeFlow, period, selectedCategory, searchQuery, transactions, totalCount, inflowCategories, breakdown } = params;
  const partition = useMemo(() => partitionCashflowTransactions(transactions), [transactions]);
  const allAnnualized = useMemo(() => deriveAnnualizedCategories(breakdown), [breakdown]);
  const summary = useMemo(
    () => computeCashflowSummary({ activeFlow, period, selectedCategory, totalCount, breakdown, partition, annualizedCategories: allAnnualized }),
    [activeFlow, period, selectedCategory, totalCount, breakdown, partition, allAnnualized]
  );
  const chipCategories = activeFlow === 'outflow' ? deriveOutflowCategoryChips(breakdown) : inflowCategories;
  const filteredActual = partition.actualTransactions.filter((tx) => matchesInspectionSearch(tx, searchQuery));
  const filteredAmortized = partition.amortizedCommitments.filter((tx) => matchesInspectionSearch(tx, searchQuery));
  const filteredExcluded = partition.excludedTransactions.filter((tx) => matchesInspectionSearch(tx, searchQuery));
  const showAnnual = activeFlow === 'outflow' && isBudgetCadencePeriod(period) && selectedCategory === 'ALL';
  const q = searchQuery.trim().toLowerCase();
  const visibleAnnualized = showAnnual ? (q ? allAnnualized.filter((c) => c.category.toLowerCase().includes(q)) : allAnnualized) : [];
  return { summary, chipCategories, filteredActual, filteredAmortized, filteredExcluded, visibleAnnualized };
}

interface CashflowInspectionBodyProps {
  initialFlow: CashflowDirection;
  period: PeriodType;
  startDate?: string;
  endDate?: string;
  includeSubclasses: boolean;
  breakdown: SpendingBreakdownResponse | null;
  onDataChanged: () => Promise<void> | void;
  onInspectCategory?: (category: string) => void;
  onClose: () => void;
}

const CashflowInspectionBody: React.FC<CashflowInspectionBodyProps> = ({
  initialFlow, period, startDate, endDate, includeSubclasses, breakdown, onDataChanged, onInspectCategory, onClose,
}) => {
  const { categoryNames } = useCategories();
  const ctx = useInspectionContext({ enabled: true });
  const { state, actions } = useCashflowInspectionScope({ initialFlow, period, startDate, endDate, includeSubclasses });
  const mutation = useTransactionMutation({
    onTransactionUpdated: actions.patchTransactionLocal,
    reloadScope: actions.reload,
    onRefreshParent: onDataChanged,
    onError: actions.setError,
  });
  const listProps = buildInspectionListProps({
    categories: categoryNames,
    loans: ctx.loans,
    accounts: ctx.accounts,
    mutation,
    showAccountBadge: true,
  });
  const view = useCashflowViewProjection({ ...state, period, breakdown });
  const periodLabel = formatPeriodLabel(period, startDate, endDate);

  return (
    <div className="space-y-4" data-testid="cashflow-inspection-modal">
      <CashflowHeaderBanner activeFlow={state.activeFlow} periodLabel={periodLabel} onSwitchFlow={(f) => { mutation.setSuccessNote(null); actions.switchFlow(f); }} />
      <SummaryMetricGrid columns={3} items={buildSummaryGridItems(state.activeFlow, state.selectedCategory, view.summary)} />
      <CashflowCategoryChips categories={view.chipCategories} selectedCategory={state.selectedCategory} onSelect={actions.selectCategory} />
      <CashflowStatusAndSearch
        contextError={ctx.contextError}
        contextLoading={ctx.contextLoading}
        onRetryContext={() => void ctx.retryContext()}
        error={state.error}
        successNote={mutation.successNote}
        hasTransactions={state.transactions.length > 0}
        searchQuery={state.searchQuery}
        onSearchChange={actions.setSearchQuery}
      />
      <CashflowSectionsBody
        activeFlow={state.activeFlow} periodLabel={periodLabel} isWeekly={isWeeklyBudgetPeriod(period)} loading={state.loading} searchQuery={state.searchQuery}
        actualTransactions={view.filteredActual} amortizedCommitments={view.filteredAmortized} annualizedCategories={view.visibleAnnualized} excludedTransactions={view.filteredExcluded}
        actualVolume={view.summary.actualVolume} amortizedVolume={view.summary.amortizedVolume} annualizedShareTotal={view.summary.annualizedShareTotal}
        listProps={listProps} onInspectCategory={onInspectCategory}
      />
      <CashflowFooterBar
        loadedRegularCount={state.loadedRegularCount} totalCount={state.totalCount} loadingMore={state.loadingMore}
        onLoadMore={actions.loadMore} onClose={onClose} isRulesModalOpen={mutation.isRulesModalOpen} closeRulesModal={mutation.closeRulesModal}
        rulePrefill={mutation.rulePrefill} onRulesApplied={() => void mutation.handleRulesApplied()}
      />
    </div>
  );
};

/**
 * Dedicated modal for inspecting period Inflow or Outflow cashflow transactions
 * backed by Plutus Spending Projection parity, server-side category filtering,
 * offset pagination, and weekly/monthly Outflow reconciliation sections.
 */
export const CashflowTransactionInspectionModal: React.FC<
  CashflowTransactionInspectionModalProps
> = ({ isOpen, onClose, initialFlow, period, startDate, endDate, includeSubclasses = false, breakdown, onDataChanged, onInspectCategory }) => (
  <Modal isOpen={isOpen} onClose={onClose} title="Inspect Cashflow" subtitle={formatPeriodLabel(period, startDate, endDate)} className="sm:max-w-2xl">
    {isOpen ? (
      <CashflowInspectionBody
        initialFlow={initialFlow} period={period} startDate={startDate} endDate={endDate}
        includeSubclasses={includeSubclasses} breakdown={breakdown} onDataChanged={onDataChanged}
        onInspectCategory={onInspectCategory} onClose={onClose}
      />
    ) : null}
  </Modal>
);
