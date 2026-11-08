import React, { useEffect, useState } from 'react';
import {
  PieChart,
  AlertTriangle,
  Target,
  ShoppingCart,
  Car,
  UtensilsCrossed,
  Zap,
  HeartPulse,
  Gamepad2,
  ShieldCheck,
  Plane,
  Home,
  Package,
  ArrowRightLeft,
  Search,
  SlidersHorizontal,
  Receipt as ReceiptIcon,
} from 'lucide-react';
import { GlassCard, Button, AlertBanner, SegmentedControl, SegmentedControlOption } from '@yggdrasil-lab/ui';
import { SpendingBreakdownResponse, PeriodType } from '../types';
import { fetchSpendingBreakdown } from '../services/api';
import { BudgetConfigModal } from './BudgetConfigModal';
import { CategoryTransactionInspectionModal } from './CategoryTransactionInspectionModal';
import { RulesManagerModal } from './RulesManagerModal';
import { ReceiptsHubModal } from './ReceiptsHubModal';

interface CategorySpendingBreakdownProps {
  onRefreshRunway?: () => void;
}

const PERIOD_OPTIONS: SegmentedControlOption<PeriodType>[] = [
  { id: 'month', label: 'This Month' },
  { id: 'week', label: 'This Week' },
  { id: 'last_month', label: 'Last Month' },
  { id: 'all', label: 'All Time' },
];

export const CategorySpendingBreakdown: React.FC<CategorySpendingBreakdownProps> = ({
  onRefreshRunway,
}) => {
  const [period, setPeriod] = useState<PeriodType>('month');
  const [data, setData] = useState<SpendingBreakdownResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>(undefined);
  const [inspectCategory, setInspectCategory] = useState<string | undefined>(undefined);
  const [isInspectModalOpen, setIsInspectModalOpen] = useState(false);
  const [isRulesModalOpen, setIsRulesModalOpen] = useState(false);
  const [isReceiptsModalOpen, setIsReceiptsModalOpen] = useState(false);

  const loadBreakdown = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchSpendingBreakdown(period);
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
  }, [period]);

  const getCategoryIcon = (category: string) => {
    const c = category.toLowerCase();
    if (c.includes('transfer') || c.includes('wise')) return <ArrowRightLeft className="w-3.5 h-3.5 text-sky-400" />;
    if (c.includes('grocer') || c.includes('supermarket')) return <ShoppingCart className="w-3.5 h-3.5 text-emerald-400" />;
    if (c.includes('transport') || c.includes('fuel') || c.includes('transit')) return <Car className="w-3.5 h-3.5 text-sky-400" />;
    if (c.includes('food') || c.includes('cafe') || c.includes('restaurant') || c.includes('dining')) return <UtensilsCrossed className="w-3.5 h-3.5 text-amber-400" />;
    if (c.includes('util') || c.includes('power') || c.includes('internet') || c.includes('phone')) return <Zap className="w-3.5 h-3.5 text-yellow-400" />;
    if (c.includes('health') || c.includes('medical') || c.includes('gym') || c.includes('fitness')) return <HeartPulse className="w-3.5 h-3.5 text-rose-400" />;
    if (c.includes('leisure') || c.includes('entertainment') || c.includes('movie') || c.includes('game')) return <Gamepad2 className="w-3.5 h-3.5 text-purple-400" />;
    if (c.includes('insurance')) return <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />;
    if (c.includes('travel') || c.includes('flight') || c.includes('air')) return <Plane className="w-3.5 h-3.5 text-cyan-400" />;
    if (c.includes('housing') || c.includes('rent') || c.includes('mortgage')) return <Home className="w-3.5 h-3.5 text-teal-400" />;
    return <Package className="w-3.5 h-3.5 text-slate-400" />;
  };

  const handleEditBudget = (cat: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedCategory(cat);
    setIsConfigModalOpen(true);
  };

  const handleInspectCategory = (cat: string) => {
    setInspectCategory(cat);
    setIsInspectModalOpen(true);
  };

  const overBudgetCategories = data?.categories.filter((c) => c.is_over_budget && !c.is_transfer) || [];

  return (
    <GlassCard className="space-y-4">
      {/* Header with Title and Period Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center space-x-2">
          <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 shrink-0">
            <PieChart className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-200">Category Spending & Budgets</h3>
            <p className="text-xs text-slate-400">Track where your money goes and set overspending guardrails</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <SegmentedControl
            options={PERIOD_OPTIONS}
            value={period}
            onChange={setPeriod}
            variant="amber"
            size="xs"
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

          <Button
            variant="outline"
            size="xs"
            icon={<SlidersHorizontal className="w-3 h-3 text-amber-400" />}
            onClick={() => setIsRulesModalOpen(true)}
            className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
            data-testid="rules-manager-btn"
          >
            Rules
          </Button>

          <Button
            variant="outline"
            size="xs"
            icon={<ReceiptIcon className="w-3 h-3 text-amber-400" />}
            onClick={() => setIsReceiptsModalOpen(true)}
            className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
            data-testid="receipts-hub-btn"
          >
            Receipts
          </Button>
        </div>
      </div>

      {error && <AlertBanner variant="error">{error}</AlertBanner>}

      {/* Overspending Warning Alert */}
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

      {/* Summary Chips */}
      {data && (
        <div className="space-y-2">
          <div className="grid grid-cols-3 gap-2 p-3 bg-card/40 rounded-xl border border-border text-center">
            <div>
              <span className="text-[10px] text-slate-400 block uppercase tracking-wider">Total Outflow</span>
              <span className="text-sm font-semibold font-mono text-slate-100">
                ${data.total_spend.toLocaleString('en-NZ', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block uppercase tracking-wider">Total Inflow</span>
              <span className="text-sm font-semibold font-mono text-emerald-400">
                ${data.total_income.toLocaleString('en-NZ', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block uppercase tracking-wider">Net Savings</span>
              <span
                className={`text-sm font-semibold font-mono ${
                  data.net_savings >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {data.net_savings >= 0 ? '+' : ''}${data.net_savings.toLocaleString('en-NZ', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {/* Transfer volume footnote chip */}
          {Boolean(data.total_transfers && data.total_transfers > 0) && (
            <div className="flex items-center justify-between px-3 py-1.5 bg-card/30 rounded-lg border border-border/60 text-[11px] text-slate-400">
              <div className="flex items-center space-x-1.5">
                <ArrowRightLeft className="w-3 h-3 text-sky-400" />
                <span>Inter-Account Transfers (Excluded from spending):</span>
              </div>
              <span className="font-mono font-medium text-sky-300">
                ${(data.total_transfers || 0).toLocaleString('en-NZ', { minimumFractionDigits: 2 })}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Category Progress Bars */}
      {loading && !data ? (
        <div className="flex items-center justify-center py-10 text-slate-400">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-amber-500" />
        </div>
      ) : !data || data.categories.length === 0 ? (
        <div className="p-6 rounded-xl border border-dashed border-border text-center text-xs text-slate-400 space-y-2">
          <p>No transactions found for this period.</p>
          <p className="text-[11px] text-slate-500">
            Ingest bank statements or log expenses to see your auto-categorized spending awareness breakdown.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-[11px] text-slate-400 px-1 gap-2">
            <span className="truncate">Click any category to inspect</span>
            <span className="shrink-0 text-right">Target / Spend</span>
          </div>

          {data.categories.map((cat) => {
            const isTransfer = cat.is_transfer;
            const hasBudget = !isTransfer && cat.budget_limit !== null && cat.budget_limit !== undefined && cat.budget_limit > 0;
            const percentUsed = cat.percent_used || 0;
            const barWidth = Math.min(percentUsed, 100);

            // Determine bar color
            const barColor =
              cat.warning_level === 'danger'
                ? 'bg-rose-500'
                : cat.warning_level === 'warning'
                ? 'bg-amber-500'
                : 'bg-emerald-500';

            return (
              <div
                key={cat.category}
                data-testid={`category-row-${cat.category.toLowerCase()}`}
                onClick={() => handleInspectCategory(cat.category)}
                className="p-3 bg-card/40 hover:bg-card/70 rounded-xl border border-border hover:border-slate-600 transition-all cursor-pointer space-y-1.5 group"
                title={`Click to inspect and correct transactions in ${cat.category}`}
              >
                <div className="flex items-center justify-between text-xs gap-2">
                  <div className="flex items-center space-x-2 min-w-0">
                    <div className="p-1 rounded bg-background border border-border shrink-0">
                      {getCategoryIcon(cat.category)}
                    </div>
                    <span className="font-medium text-slate-200 group-hover:text-amber-300 transition-colors truncate">
                      {cat.category}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono shrink-0">
                      {cat.transaction_count} {cat.transaction_count === 1 ? 'txn' : 'txns'}
                      {!isTransfer && ` (${Math.round(cat.percentage)}%)`}
                    </span>
                  </div>

                  <div className="flex items-center space-x-2">
                    <span className={`font-semibold font-mono ${isTransfer ? 'text-sky-300' : 'text-slate-100'}`}>
                      ${cat.total_spend.toLocaleString('en-NZ', { minimumFractionDigits: 2 })}
                    </span>
                    <div className="p-1 rounded bg-card/80 text-slate-400 group-hover:text-slate-200 border border-transparent group-hover:border-border transition-colors">
                      <Search className="w-3 h-3" />
                    </div>
                  </div>
                </div>

                {/* Progress bar container or transfer status */}
                {isTransfer ? (
                  <div className="flex justify-between items-center text-[10px] text-sky-400/90 pt-0.5">
                    <span className="flex items-center space-x-1">
                      <ArrowRightLeft className="w-2.5 h-2.5" />
                      <span>Internal transfers between accounts · Excluded from spend</span>
                    </span>
                    <span className="text-slate-400 hover:text-slate-200">Inspect txns</span>
                  </div>
                ) : hasBudget ? (
                  <div className="space-y-1">
                    <div className="w-full bg-background rounded-full h-2 overflow-hidden border border-border">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                    <div className="flex justify-between items-center text-[10px] text-slate-400 font-mono">
                      <span>
                        ${cat.total_spend.toFixed(0)} of ${cat.budget_limit?.toFixed(0)} ({percentUsed.toFixed(0)}%)
                      </span>
                      <div className="flex items-center space-x-2">
                        {cat.is_over_budget ? (
                          <span className="text-rose-400 font-semibold flex items-center space-x-1">
                            <AlertTriangle className="w-3 h-3" />
                            <span>${(cat.total_spend - (cat.budget_limit || 0)).toFixed(0)} OVER BUDGET</span>
                          </span>
                        ) : (
                          <span className="text-emerald-400">
                            ${((cat.budget_limit || 0) - cat.total_spend).toFixed(0)} left
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={(e) => handleEditBudget(cat.category, e)}
                          title="Edit budget target"
                          className="text-slate-500 hover:text-amber-400 p-0.5"
                        >
                          <Target className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex justify-between items-center text-[10px] text-slate-500 pt-0.5">
                    <span>No target budget configured</span>
                    <button
                      type="button"
                      onClick={(e) => handleEditBudget(cat.category, e)}
                      className="text-amber-400/80 hover:text-amber-300 flex items-center space-x-0.5"
                    >
                      <Target className="w-2.5 h-2.5" />
                      <span>Set target</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Category Transaction Inspection & Correction Modal */}
      <CategoryTransactionInspectionModal
        isOpen={isInspectModalOpen}
        onClose={() => setIsInspectModalOpen(false)}
        category={inspectCategory}
        period={period}
        onCategoryChanged={() => {
          loadBreakdown();
          if (onRefreshRunway) onRefreshRunway();
        }}
      />

      {/* Budget Configuration Modal */}
      <BudgetConfigModal
        isOpen={isConfigModalOpen}
        onClose={() => setIsConfigModalOpen(false)}
        onSuccess={() => {
          loadBreakdown();
          if (onRefreshRunway) onRefreshRunway();
        }}
        initialCategory={selectedCategory}
      />

      {/* Rules Manager Modal */}
      <RulesManagerModal
        isOpen={isRulesModalOpen}
        onClose={() => setIsRulesModalOpen(false)}
        onRulesApplied={() => {
          loadBreakdown();
          if (onRefreshRunway) onRefreshRunway();
        }}
      />

      {/* Receipts & Granular Product Hub Modal */}
      <ReceiptsHubModal
        isOpen={isReceiptsModalOpen}
        onClose={() => setIsReceiptsModalOpen(false)}
        onReceiptLinked={() => {
          loadBreakdown();
          if (onRefreshRunway) onRefreshRunway();
        }}
      />
    </GlassCard>
  );
};
