import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  ArrowRightLeft,
  PieChart,
  Target,
} from 'lucide-react';
import {
  AlertBanner,
  BudgetProgressRow,
  Button,
  EmptyState,
  GlassCard,
  LoadingState,
  SectionHeader,
  SegmentedControl,
  SummaryMetricGrid,
} from '@yggdrasil-lab/ui';
import { getCategoryIcon } from '../constants/categoryIcons';
import { fetchSpendingBreakdown } from '../services/api';
import { CategorySpendingReport, PeriodType, SpendingBreakdownResponse } from '../types';
import { formatMoney } from '../utils/format';
import { BudgetConfigModal } from './BudgetConfigModal';
import { CategoryTransactionInspectionModal } from './CategoryTransactionInspectionModal';
import { getDefaultCustomRange, PeriodFilterBar } from './PeriodFilterBar';

/**
 * Format a compact category item count label separating actual period transactions
 * from amortized recurring commitments when both or fixed items contribute.
 */
function formatCategoryCountLabel(cat: CategorySpendingReport): string | undefined {
  if (cat.is_transfer || cat.budget_period === 'annual') return undefined;
  const amortizedCount = cat.amortized_count ?? 0;
  if (amortizedCount <= 0) return undefined;
  const actualCount =
    cat.actual_transaction_count ?? Math.max(0, cat.transaction_count - amortizedCount);
  if (actualCount <= 0) {
    return `${amortizedCount} fixed`;
  }
  return `${actualCount} + ${amortizedCount} fixed`;
}

interface CategorySpendingBreakdownProps {
  onRefreshRunway?: () => void;
  compact?: boolean;
  onViewAllBudgetsClick?: () => void;
}

/**
 * Category spending breakdown with overspending guardrails, budget configuration,
 * and category drill-down inspection. Supports a compact mode for mobile overview.
 */
export const CategorySpendingBreakdown: React.FC<CategorySpendingBreakdownProps> = ({
  onRefreshRunway,
  compact = false,
  onViewAllBudgetsClick,
}) => {
  const defaultRange = useMemo(() => getDefaultCustomRange(), []);
  const [period, setPeriod] = useState<PeriodType>('month');
  const [startDate, setStartDate] = useState(defaultRange.startDate);
  const [endDate, setEndDate] = useState(defaultRange.endDate);
  const [data, setData] = useState<SpendingBreakdownResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>(undefined);
  const [inspectCategory, setInspectCategory] = useState<string | undefined>(undefined);
  const [isInspectModalOpen, setIsInspectModalOpen] = useState(false);
  const [groupBy, setGroupBy] = useState<'leaf' | 'base'>('leaf');

  const loadBreakdown = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchSpendingBreakdown(
        period,
        period === 'custom' ? startDate : undefined,
        period === 'custom' ? endDate : undefined,
        compact ? 'leaf' : groupBy
      );
      setData(res);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to load spending breakdown');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBreakdown();
  }, [period, startDate, endDate, groupBy, compact]);

  const handleEditBudget = (cat: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setSelectedCategory(cat);
    setIsConfigModalOpen(true);
  };

  const handleInspectCategory = (cat: string) => {
    setInspectCategory(cat);
    setIsInspectModalOpen(true);
  };

  const refreshAll = () => {
    void loadBreakdown();
    onRefreshRunway?.();
  };

  const overBudgetCategories =
    data?.categories.filter((c) => c.is_over_budget && !c.is_transfer) || [];

  const inspectedCategoryReport = data?.categories.find((c) => c.category === inspectCategory);
  const isInspectAnnualOverride = Boolean(
    inspectedCategoryReport &&
      !inspectedCategoryReport.is_transfer &&
      inspectedCategoryReport.budget_period === 'annual'
  );
  const effectiveInspectPeriod: PeriodType = isInspectAnnualOverride ? 'annual' : period;

  return (
    <GlassCard className="space-y-4">
      <SectionHeader
        title="Category Spending & Budgets"
        subtitle={
          compact
            ? 'Top categories this month & budget guardrails'
            : 'Track where your money goes and set overspending guardrails'
        }
        icon={<PieChart className="w-4 h-4" />}
        variant="amber"
        actions={
          compact ? (
            onViewAllBudgetsClick ? (
              <Button
                variant="outline"
                size="xs"
                icon={<ArrowRight className="w-3 h-3 text-amber-400" />}
                onClick={onViewAllBudgetsClick}
                className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
                data-testid="view-all-budgets-btn"
              >
                View All Budgets
              </Button>
            ) : undefined
          ) : (
            <>
              <PeriodFilterBar
                period={period}
                onPeriodChange={setPeriod}
                startDate={startDate}
                endDate={endDate}
                onStartDateChange={setStartDate}
                onEndDateChange={setEndDate}
                idPrefix="budget-period"
              />

              <Button
                variant="outline"
                size="xs"
                icon={<Target className="w-3 h-3 text-amber-400" />}
                onClick={() => {
                  setSelectedCategory(undefined);
                  setIsConfigModalOpen(true);
                }}
                className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
              >
                <span className="hidden sm:inline">Manage Limits</span>
                <span className="sm:hidden">Limits</span>
              </Button>
            </>
          )
        }
      />

      {error && <AlertBanner variant="error">{error}</AlertBanner>}

      {overBudgetCategories.length > 0 && (
        <AlertBanner
          variant="error"
          title={`Overspending Alert: Exceeding budget in ${overBudgetCategories.length} ${
            overBudgetCategories.length === 1 ? 'category' : 'categories'
          }`}
          className="shadow-sm"
        >
          <div className="text-xs space-y-1">
            <p>
              You have exceeded your spending limit for{' '}
              <span className="font-semibold text-rose-300">
                {overBudgetCategories.map((c) => c.category).join(', ')}
              </span>
              . Consider pausing non-essential purchases in these areas to protect your runway.
            </p>
          </div>
        </AlertBanner>
      )}

      {data && (
        <div className="space-y-2">
          <SummaryMetricGrid
            columns={3}
            items={[
              {
                id: 'outflow',
                label: 'Outflow',
                value: (
                  <span className="text-xs sm:text-sm tracking-tight">
                    {formatMoney(data.total_spend, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                ),
                subvalue: 'NZD',
                valueClassName: 'text-slate-100 font-mono',
              },
              {
                id: 'inflow',
                label: 'Inflow',
                value: (
                  <span className="text-xs sm:text-sm tracking-tight">
                    {formatMoney(data.total_income, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                ),
                subvalue: 'NZD',
                valueClassName: 'text-emerald-400 font-mono',
              },
              {
                id: 'net',
                label: 'Net Savings',
                value: (
                  <span className="text-xs sm:text-sm tracking-tight">
                    {formatMoney(data.net_savings, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                      showPlusSign: true,
                    })}
                  </span>
                ),
                subvalue: 'NZD',
                valueClassName: `font-mono ${
                  data.net_savings >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`,
              },
            ]}
          />

          {!compact && Boolean(data.total_transfers && data.total_transfers > 0) && (
            <div className="flex items-center justify-between px-3 py-1.5 bg-card/30 rounded-lg border border-border/60 text-[11px] text-slate-400">
              <div className="flex items-center space-x-1.5">
                <ArrowRightLeft className="w-3 h-3 text-sky-400" />
                <span>Inter-Account Transfers (Excluded from spending):</span>
              </div>
              <span className="font-mono font-medium text-sky-300">
                {formatMoney(data.total_transfers || 0, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}{' '}
                NZD
              </span>
            </div>
          )}
        </div>
      )}

      {loading && !data ? (
        <LoadingState label="Loading spending breakdown..." variant="amber" />
      ) : !data || data.categories.length === 0 ? (
        <EmptyState
          title="No transactions found for this period."
          description="Ingest bank statements or log expenses to see your auto-categorized spending awareness breakdown."
          variant="dashed"
        />
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-[11px] text-slate-400 px-1 gap-2 flex-wrap">
            <div className="flex items-center gap-2 min-w-0">
              <span className="truncate">
                {compact ? 'Top categories (tap to inspect)' : 'Click any category to inspect'}
              </span>
              {!compact && (
                <SegmentedControl<'leaf' | 'base'>
                  options={[
                    { id: 'leaf', label: 'Granular' },
                    { id: 'base', label: 'Base Classes' },
                  ]}
                  value={groupBy}
                  onChange={setGroupBy}
                  variant="amber"
                  size="sm"
                  idPrefix="category-hierarchy-mode"
                />
              )}
            </div>
            <span className="shrink-0 text-right">Target / Spend</span>
          </div>

          {(compact
            ? data.categories.filter((c) => !c.is_transfer).slice(0, 3)
            : data.categories
          ).map((cat) => {
            const isTransfer = Boolean(cat.is_transfer);
            const isAnnual = !isTransfer && cat.budget_period === 'annual';
            const hasBudget =
              !isTransfer &&
              cat.budget_limit !== null &&
              cat.budget_limit !== undefined &&
              cat.budget_limit > 0;
            const percentUsed = cat.percent_used || 0;
            const limitValue = cat.budget_limit || 0;

            const displayCategoryName = cat.parent_category
              ? `${cat.parent_category} › ${cat.category}`
              : cat.category;

            return (
              <BudgetProgressRow
                key={cat.category}
                data-testid={`category-row-${cat.category.toLowerCase()}`}
                category={isAnnual ? `${displayCategoryName} (Annual 52w)` : displayCategoryName}
                icon={getCategoryIcon(cat.category)}
                spendFormatted={`${formatMoney(cat.total_spend, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })} NZD`}
                transactionCount={cat.transaction_count}
                transactionCountLabel={formatCategoryCountLabel(cat)}
                percentage={cat.percentage}
                budgetSummaryLabel={
                  hasBudget
                    ? isAnnual
                      ? `${formatMoney(cat.total_spend)} of ${formatMoney(limitValue)}/yr (${percentUsed.toFixed(0)}% of 52w)`
                      : `${formatMoney(cat.total_spend)} of ${formatMoney(limitValue)} (${percentUsed.toFixed(0)}%)`
                    : null
                }
                remainingOrOverFormatted={
                  hasBudget
                    ? cat.is_over_budget
                      ? `${formatMoney(cat.total_spend - limitValue)} ${isAnnual ? 'OVER ANNUAL' : 'OVER BUDGET'}`
                      : `${formatMoney(limitValue - cat.total_spend)}${isAnnual ? '/yr left' : ' left'}`
                    : null
                }
                percentUsed={percentUsed}
                isOverBudget={cat.is_over_budget}
                warningLevel={cat.warning_level}
                isTransfer={isTransfer}
                onRowClick={() => handleInspectCategory(cat.category)}
                onEditTargetClick={(e) => handleEditBudget(cat.category, e)}
              />
            );
          })}

          {compact && onViewAllBudgetsClick && (
            <Button
              variant="ghost"
              size="sm"
              fullWidth
              icon={<ArrowRight className="w-3.5 h-3.5 text-amber-400" />}
              onClick={onViewAllBudgetsClick}
              className="border border-border/70 text-amber-300 hover:bg-amber-500/10"
              data-testid="view-all-budgets-footer-btn"
            >
              View all categories &amp; budgets
            </Button>
          )}
        </div>
      )}

      <CategoryTransactionInspectionModal
        isOpen={isInspectModalOpen}
        onClose={() => setIsInspectModalOpen(false)}
        category={inspectCategory}
        period={effectiveInspectPeriod}
        startDate={isInspectAnnualOverride ? undefined : startDate}
        endDate={isInspectAnnualOverride ? undefined : endDate}
        isAnnualOverride={isInspectAnnualOverride}
        includeSubclasses={!compact && groupBy === 'base'}
        onCategoryChanged={refreshAll}
      />

      <BudgetConfigModal
        isOpen={isConfigModalOpen}
        onClose={() => setIsConfigModalOpen(false)}
        onSuccess={refreshAll}
        initialCategory={selectedCategory}
      />
    </GlassCard>
  );
};
