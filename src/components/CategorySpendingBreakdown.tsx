import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowRight, ArrowRightLeft, PieChart, Target } from 'lucide-react';
import {
  AlertBanner,
  BudgetProgressRow,
  Button,
  EmptyState,
  GlassCard,
  LoadingState,
  PeriodFilterBar,
  SectionHeader,
  SegmentedControl,
  SummaryMetricGrid,
  SummaryMetricItem,
  getDefaultCustomRange,
} from '@yggdrasil-lab/ui';
import { getCategoryIcon } from '../constants/categoryIcons';
import { PERIOD_OPTIONS } from '../taxonomy';
import { fetchSpendingBreakdown } from '../transport';
import {
  CashflowDirection,
  CategorySpendingReport,
  PeriodType,
  SpendingBreakdownResponse,
} from '../types';
import { formatMoney } from '../utils/format';
import { BudgetConfigModal } from './BudgetConfigModal';
import { CashflowTransactionInspectionModal } from './CashflowTransactionInspectionModal';
import { CategoryTransactionInspectionModal } from './CategoryTransactionInspectionModal';

function formatCategoryCountLabel(cat: CategorySpendingReport): string | undefined {
  if (cat.is_transfer || cat.budget_period === 'annual') return undefined;
  const amortizedCount = cat.amortized_count ?? 0;
  if (amortizedCount <= 0) return undefined;
  const actualCount =
    cat.actual_transaction_count ?? Math.max(0, cat.transaction_count - amortizedCount);
  return actualCount <= 0 ? `${amortizedCount} fixed` : `${actualCount} + ${amortizedCount} fixed`;
}

function buildBreakdownMetricItems(
  data: SpendingBreakdownResponse,
  onOpenCashflow: (flow: CashflowDirection) => void
): SummaryMetricItem[] {
  const moneyOpts = { minimumFractionDigits: 2, maximumFractionDigits: 2 };
  return [
    {
      id: 'outflow',
      label: 'Outflow',
      value: <span className="text-xs sm:text-sm tracking-tight">{formatMoney(data.total_spend, moneyOpts)}</span>,
      subvalue: 'NZD',
      valueClassName: 'text-slate-100 font-mono',
      onClick: () => onOpenCashflow('outflow'),
      ariaLabel: 'Inspect Outflow transactions',
      testId: 'summary-card-outflow',
    },
    {
      id: 'inflow',
      label: 'Inflow',
      value: <span className="text-xs sm:text-sm tracking-tight">{formatMoney(data.total_income, moneyOpts)}</span>,
      subvalue: 'NZD',
      valueClassName: 'text-emerald-400 font-mono',
      onClick: () => onOpenCashflow('inflow'),
      ariaLabel: 'Inspect Inflow transactions',
      testId: 'summary-card-inflow',
    },
    {
      id: 'net',
      label: 'Net Savings',
      value: (
        <span className="text-xs sm:text-sm tracking-tight">
          {formatMoney(data.net_savings, { ...moneyOpts, showPlusSign: true })}
        </span>
      ),
      subvalue: 'NZD',
      valueClassName: `font-mono ${data.net_savings >= 0 ? 'text-emerald-400' : 'text-rose-400'}`,
      testId: 'summary-card-net',
    },
  ];
}

function useSpendingBreakdownState(compact: boolean, onRefreshRunway?: () => void) {
  const defaultRange = useMemo(() => getDefaultCustomRange(), []);
  const [period, setPeriod] = useState<PeriodType>('month');
  const [startDate, setStartDate] = useState(defaultRange.startDate);
  const [endDate, setEndDate] = useState(defaultRange.endDate);
  const [groupBy, setGroupBy] = useState<'leaf' | 'base'>('leaf');
  const [data, setData] = useState<SpendingBreakdownResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadBreakdown = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const start = period === 'custom' ? startDate : undefined;
      const end = period === 'custom' ? endDate : undefined;
      setData(await fetchSpendingBreakdown(period, start, end, compact ? 'leaf' : groupBy));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load spending breakdown');
    } finally {
      setLoading(false);
    }
  }, [period, startDate, endDate, groupBy, compact]);

  useEffect(() => {
    void loadBreakdown();
  }, [loadBreakdown]);

  const refreshAll = useCallback(() => {
    const breakdownPromise = loadBreakdown();
    onRefreshRunway?.();
    return breakdownPromise;
  }, [loadBreakdown, onRefreshRunway]);

  return {
    period, setPeriod, startDate, setStartDate, endDate, setEndDate,
    groupBy, setGroupBy, data, loading, error, refreshAll,
  };
}

interface BreakdownHeaderActionsProps {
  compact: boolean;
  period: PeriodType;
  startDate: string;
  endDate: string;
  onPeriodChange: (period: PeriodType) => void;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
  onViewAllBudgetsClick?: () => void;
  onManageLimitsClick: () => void;
}

const BreakdownHeaderActions: React.FC<BreakdownHeaderActionsProps> = ({
  compact, period, startDate, endDate, onPeriodChange, onStartDateChange, onEndDateChange, onViewAllBudgetsClick, onManageLimitsClick,
}) => {
  if (compact) {
    if (!onViewAllBudgetsClick) return null;
    return (
      <Button variant="outline" size="xs" icon={<ArrowRight className="w-3 h-3 text-amber-400" />} onClick={onViewAllBudgetsClick} className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10" data-testid="view-all-budgets-btn">
        View All Budgets
      </Button>
    );
  }
  return (
    <>
      <PeriodFilterBar period={period} onPeriodChange={onPeriodChange} startDate={startDate} endDate={endDate} onStartDateChange={onStartDateChange} onEndDateChange={onEndDateChange} options={PERIOD_OPTIONS} variant="brand" idPrefix="budget-period" />
      <Button variant="outline" size="xs" icon={<Target className="w-3 h-3 text-amber-400" />} onClick={onManageLimitsClick} className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10">
        <span className="hidden sm:inline">Manage Limits</span>
        <span className="sm:hidden">Limits</span>
      </Button>
    </>
  );
};

const BreakdownOverspendBanner: React.FC<{ categories: CategorySpendingReport[] }> = ({ categories }) => {
  if (categories.length === 0) return null;
  const noun = categories.length === 1 ? 'category' : 'categories';
  return (
    <AlertBanner variant="error" title={`Overspending Alert: Exceeding budget in ${categories.length} ${noun}`} className="shadow-sm">
      <div className="text-xs space-y-1">
        <p>
          You have exceeded your spending limit for{' '}
          <span className="font-semibold text-rose-300">{categories.map((c) => c.category).join(', ')}</span>.
          {' '}Consider pausing non-essential purchases in these areas to protect your runway.
        </p>
      </div>
    </AlertBanner>
  );
};

const BreakdownTransferNotice: React.FC<{ totalTransfers?: number }> = ({ totalTransfers }) => {
  if (!totalTransfers || totalTransfers <= 0) return null;
  const formatted = formatMoney(totalTransfers, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (
    <div className="flex items-center justify-between px-3 py-1.5 bg-card/30 rounded-lg border border-border/60 text-[11px] text-slate-400">
      <div className="flex items-center space-x-1.5">
        <ArrowRightLeft className="w-3 h-3 text-sky-400" />
        <span>Inter-Account Transfers (Excluded from spending):</span>
      </div>
      <span className="font-mono font-medium text-sky-300">{formatted} NZD</span>
    </div>
  );
};

interface BreakdownCategoryRowProps {
  cat: CategorySpendingReport;
  onInspect: (category: string) => void;
  onEditBudget: (category: string, e?: React.MouseEvent) => void;
}

const BreakdownCategoryRow: React.FC<BreakdownCategoryRowProps> = ({ cat, onInspect, onEditBudget }) => {
  const isTransfer = Boolean(cat.is_transfer);
  const isAnnual = !isTransfer && cat.budget_period === 'annual';
  const hasBudget = !isTransfer && cat.budget_limit !== null && cat.budget_limit !== undefined && cat.budget_limit > 0;
  const percentUsed = cat.percent_used || 0;
  const limitValue = cat.budget_limit || 0;
  const displayName = cat.parent_category ? `${cat.parent_category} › ${cat.category}` : cat.category;
  const spendFormatted = `${formatMoney(cat.total_spend, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} NZD`;
  const budgetSummaryLabel = hasBudget
    ? isAnnual
      ? `${formatMoney(cat.total_spend)} of ${formatMoney(limitValue)}/yr (${percentUsed.toFixed(0)}% of 52w)`
      : `${formatMoney(cat.total_spend)} of ${formatMoney(limitValue)} (${percentUsed.toFixed(0)}%)`
    : null;
  const remainingOrOverFormatted = hasBudget
    ? cat.is_over_budget
      ? `${formatMoney(cat.total_spend - limitValue)} ${isAnnual ? 'OVER ANNUAL' : 'OVER BUDGET'}`
      : `${formatMoney(limitValue - cat.total_spend)}${isAnnual ? '/yr left' : ' left'}`
    : null;

  return (
    <BudgetProgressRow
      data-testid={`category-row-${cat.category.toLowerCase()}`}
      category={isAnnual ? `${displayName} (Annual 52w)` : displayName}
      icon={getCategoryIcon(cat.category)}
      spendFormatted={spendFormatted}
      transactionCount={cat.transaction_count}
      transactionCountLabel={formatCategoryCountLabel(cat)}
      percentage={cat.percentage}
      budgetSummaryLabel={budgetSummaryLabel}
      remainingOrOverFormatted={remainingOrOverFormatted}
      percentUsed={percentUsed}
      isOverBudget={cat.is_over_budget}
      warningLevel={cat.warning_level}
      isTransfer={isTransfer}
      onRowClick={() => onInspect(cat.category)}
      onEditTargetClick={(e) => onEditBudget(cat.category, e)}
    />
  );
};

interface BreakdownCategoryListProps {
  compact: boolean;
  loading: boolean;
  data: SpendingBreakdownResponse | null;
  groupBy: 'leaf' | 'base';
  onGroupByChange: (mode: 'leaf' | 'base') => void;
  onInspectCategory: (cat: string) => void;
  onEditBudget: (cat: string, e?: React.MouseEvent) => void;
  onViewAllBudgetsClick?: () => void;
}

const BreakdownCategoryList: React.FC<BreakdownCategoryListProps> = ({
  compact, loading, data, groupBy, onGroupByChange, onInspectCategory, onEditBudget, onViewAllBudgetsClick,
}) => {
  if (loading && !data) return <LoadingState label="Loading spending breakdown..." variant="brand" />;
  if (!data || data.categories.length === 0) {
    return <EmptyState title="No transactions found for this period." description="Ingest bank statements or log expenses to see your auto-categorized spending awareness breakdown." variant="dashed" />;
  }
  const rows = compact ? data.categories.filter((c) => !c.is_transfer).slice(0, 3) : data.categories;
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-[11px] text-slate-400 px-1 gap-2 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <span className="truncate">{compact ? 'Top categories (tap to inspect)' : 'Click any category to inspect'}</span>
          {!compact && (
            <SegmentedControl<'leaf' | 'base'> options={[{ id: 'leaf', label: 'Granular' }, { id: 'base', label: 'Base Classes' }]} value={groupBy} onChange={onGroupByChange} variant="brand" size="sm" idPrefix="category-hierarchy-mode" />
          )}
        </div>
        <span className="shrink-0 text-right">Target / Spend</span>
      </div>
      {rows.map((cat) => (
        <BreakdownCategoryRow key={cat.category} cat={cat} onInspect={onInspectCategory} onEditBudget={onEditBudget} />
      ))}
      {compact && onViewAllBudgetsClick && (
        <Button variant="ghost" size="sm" fullWidth icon={<ArrowRight className="w-3.5 h-3.5 text-amber-400" />} onClick={onViewAllBudgetsClick} className="border border-border/70 text-amber-300 hover:bg-amber-500/10" data-testid="view-all-budgets-footer-btn">
          View all categories &amp; budgets
        </Button>
      )}
    </div>
  );
};

interface BreakdownModalsProps {
  compact: boolean;
  period: PeriodType;
  startDate: string;
  endDate: string;
  groupBy: 'leaf' | 'base';
  data: SpendingBreakdownResponse | null;
  cashflowModalFlow: CashflowDirection | null;
  onCloseCashflow: () => void;
  onInspectFromCashflow: (cat: string) => void;
  isInspectModalOpen: boolean;
  onCloseInspect: () => void;
  inspectCategory?: string;
  isAnnualOverride: boolean;
  isConfigModalOpen: boolean;
  onCloseConfig: () => void;
  selectedCategory?: string;
  onRefreshAll: () => void;
}

const BreakdownModals: React.FC<BreakdownModalsProps> = ({
  compact, period, startDate, endDate, groupBy, data, cashflowModalFlow, onCloseCashflow,
  onInspectFromCashflow, isInspectModalOpen, onCloseInspect, inspectCategory, isAnnualOverride,
  isConfigModalOpen, onCloseConfig, selectedCategory, onRefreshAll,
}) => (
  <>
    <CashflowTransactionInspectionModal
      isOpen={cashflowModalFlow !== null} onClose={onCloseCashflow} initialFlow={cashflowModalFlow ?? 'outflow'}
      period={period} startDate={startDate} endDate={endDate} includeSubclasses={!compact && groupBy === 'base'}
      breakdown={data} onDataChanged={onRefreshAll} onInspectCategory={onInspectFromCashflow}
    />
    <CategoryTransactionInspectionModal
      isOpen={isInspectModalOpen} onClose={onCloseInspect} category={inspectCategory}
      period={isAnnualOverride ? 'annual' : period} startDate={isAnnualOverride ? undefined : startDate} endDate={isAnnualOverride ? undefined : endDate}
      isAnnualOverride={isAnnualOverride} includeSubclasses={!compact && groupBy === 'base'} onCategoryChanged={onRefreshAll}
    />
    <BudgetConfigModal isOpen={isConfigModalOpen} onClose={onCloseConfig} onSuccess={onRefreshAll} initialCategory={selectedCategory} />
  </>
);

interface CategorySpendingBreakdownProps {
  onRefreshRunway?: () => void;
  compact?: boolean;
  onViewAllBudgetsClick?: () => void;
}

/**
 * Category spending breakdown with overspending guardrails, budget configuration,
 * and category/cashflow drill-down inspection. Supports compact overview mode.
 */
export const CategorySpendingBreakdown: React.FC<CategorySpendingBreakdownProps> = ({
  onRefreshRunway, compact = false, onViewAllBudgetsClick,
}) => {
  const s = useSpendingBreakdownState(compact, onRefreshRunway);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>(undefined);
  const [inspectCategory, setInspectCategory] = useState<string | undefined>(undefined);
  const [isInspectModalOpen, setIsInspectModalOpen] = useState(false);
  const [cashflowModalFlow, setCashflowModalFlow] = useState<CashflowDirection | null>(null);
  const overBudget = s.data?.categories.filter((c) => c.is_over_budget && !c.is_transfer) || [];
  const inspected = s.data?.categories.find((c) => c.category === inspectCategory);
  const isAnnualOverride = Boolean(inspected && !inspected.is_transfer && inspected.budget_period === 'annual');

  return (
    <GlassCard className="space-y-4">
      <SectionHeader
        title="Category Spending & Budgets"
        subtitle={compact ? 'Top categories this month & budget guardrails' : 'Track where your money goes and set overspending guardrails'}
        icon={<PieChart className="w-4 h-4" />}
        variant="brand"
        actions={<BreakdownHeaderActions compact={compact} period={s.period} startDate={s.startDate} endDate={s.endDate} onPeriodChange={s.setPeriod} onStartDateChange={s.setStartDate} onEndDateChange={s.setEndDate} onViewAllBudgetsClick={onViewAllBudgetsClick} onManageLimitsClick={() => { setSelectedCategory(undefined); setIsConfigModalOpen(true); }} />}
      />
      {Boolean(s.error) && <AlertBanner variant="error">{s.error}</AlertBanner>}
      <BreakdownOverspendBanner categories={overBudget} />
      {s.data && (
        <div className="space-y-2">
          <SummaryMetricGrid columns={3} items={buildBreakdownMetricItems(s.data, setCashflowModalFlow)} />
          {!compact && <BreakdownTransferNotice totalTransfers={s.data.total_transfers} />}
        </div>
      )}
      <BreakdownCategoryList compact={compact} loading={s.loading} data={s.data} groupBy={s.groupBy} onGroupByChange={s.setGroupBy} onInspectCategory={(cat) => { setInspectCategory(cat); setIsInspectModalOpen(true); }} onEditBudget={(cat, e) => { e?.stopPropagation(); setSelectedCategory(cat); setIsConfigModalOpen(true); }} onViewAllBudgetsClick={onViewAllBudgetsClick} />
      <BreakdownModals compact={compact} period={s.period} startDate={s.startDate} endDate={s.endDate} groupBy={s.groupBy} data={s.data} cashflowModalFlow={cashflowModalFlow} onCloseCashflow={() => setCashflowModalFlow(null)} onInspectFromCashflow={(cat) => { setCashflowModalFlow(null); setInspectCategory(cat); setIsInspectModalOpen(true); }} isInspectModalOpen={isInspectModalOpen} onCloseInspect={() => setIsInspectModalOpen(false)} inspectCategory={inspectCategory} isAnnualOverride={isAnnualOverride} isConfigModalOpen={isConfigModalOpen} onCloseConfig={() => setIsConfigModalOpen(false)} selectedCategory={selectedCategory} onRefreshAll={s.refreshAll} />
    </GlassCard>
  );
};
