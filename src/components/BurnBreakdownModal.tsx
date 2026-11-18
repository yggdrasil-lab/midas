import React, { useEffect, useMemo, useState } from 'react';
import { Calendar, Flame, Percent, RefreshCw, Repeat } from 'lucide-react';
import {
  AlertBanner,
  Button,
  EmptyState,
  LoadingState,
  Modal,
  MultiSegmentBar,
  MultiSegmentItem,
  SegmentedControl,
  StatusBadge,
  SummaryMetricGrid,
} from '@yggdrasil-lab/ui';
import { getCategoryIcon } from '../constants/categoryIcons';
import { fetchAverageBurn } from '../services/api';
import {
  AverageBurnReportResponse,
  CategoryBurnEstimate,
  RecurringCommitmentItem,
} from '../types';
import { formatMoney } from '../utils/format';

export type BurnBreakdownTab = 'recurring' | 'variable';
type LookbackOption = '4' | '12' | '26';

interface BurnBreakdownModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: BurnBreakdownTab;
}

const LOOKBACK_OPTIONS: Array<{ id: LookbackOption; label: string }> = [
  { id: '4', label: '4w Avg' },
  { id: '12', label: '12w Avg' },
  { id: '26', label: '26w Avg' },
];

const SEGMENT_PALETTE: Array<{ bar: string; text: string }> = [
  { bar: 'bg-amber-500', text: 'text-amber-300' },
  { bar: 'bg-sky-500', text: 'text-sky-300' },
  { bar: 'bg-emerald-500', text: 'text-emerald-300' },
  { bar: 'bg-indigo-500', text: 'text-indigo-300' },
  { bar: 'bg-rose-500', text: 'text-rose-300' },
  { bar: 'bg-slate-500', text: 'text-slate-300' },
];

/**
 * Group positive category/value pairs into up to 5 top segments plus an "Other" bucket
 * so the MultiSegmentBar legend remains compact on narrow mobile viewports.
 */
function toSegmentItems(
  entries: Array<{ label: string; value: number }>,
  idPrefix: string
): MultiSegmentItem[] {
  const positive = entries
    .filter((entry) => entry.value > 0)
    .sort((a, b) => b.value - a.value);

  if (positive.length === 0) return [];

  const total = positive.reduce((sum, item) => sum + item.value, 0);
  const top = positive.slice(0, 5);
  const remainder = positive.slice(5).reduce((sum, item) => sum + item.value, 0);
  if (remainder > 0) {
    top.push({ label: 'Other', value: remainder });
  }

  return top.map((item, idx) => {
    const palette = SEGMENT_PALETTE[idx % SEGMENT_PALETTE.length];
    const pct = total > 0 ? ((item.value / total) * 100).toFixed(1) : '0.0';
    return {
      id: `${idPrefix}-${item.label.toLowerCase().replace(/\s+/g, '-')}`,
      label: item.label,
      value: item.value,
      barColor: palette.bar,
      textColor: palette.text,
      valueLabel: `${pct}%`,
    };
  });
}

function resolveVariablePct(
  cat: CategoryBurnEstimate,
  totalVariableBurn: number
): number {
  if (cat.variable_percentage !== undefined) {
    return cat.variable_percentage;
  }
  if (totalVariableBurn <= 0) return 0;
  return Math.round((cat.variable_weekly_burn / totalVariableBurn) * 1000) / 10;
}

function resolveTotalPct(cat: CategoryBurnEstimate, totalAvgBurn: number): number {
  if (cat.total_percentage !== undefined) {
    return cat.total_percentage;
  }
  if (totalAvgBurn <= 0) return 0;
  return Math.round((cat.average_weekly_burn / totalAvgBurn) * 1000) / 10;
}

const RecurringCommitmentsSection: React.FC<{
  commitments: RecurringCommitmentItem[];
}> = ({ commitments }) => {
  const segments = useMemo(() => {
    const byCategory = new Map<string, number>();
    for (const item of commitments) {
      byCategory.set(item.category, (byCategory.get(item.category) ?? 0) + item.weekly_nzd);
    }
    return toSegmentItems(
      Array.from(byCategory.entries()).map(([label, value]) => ({ label, value })),
      'rec'
    );
  }, [commitments]);

  if (commitments.length === 0) {
    return (
      <EmptyState
        title="No active recurring commitments found"
        description="Mark recurring transactions (weekly, fortnightly, monthly, or annual) to track fixed baseline burn."
        variant="dashed"
      />
    );
  }

  return (
    <div className="space-y-3">
      {segments.length > 0 && (
        <div className="p-3 rounded-xl bg-background/60 border border-border/70 space-y-2">
          <div className="text-[11px] font-medium text-slate-300 flex items-center justify-between">
            <span>Fixed Burn Mix by Category</span>
            <span className="font-mono text-sky-300">{commitments.length} active</span>
          </div>
          <MultiSegmentBar segments={segments} />
        </div>
      )}

      <div className="space-y-2 max-h-[42vh] overflow-y-auto pr-1">
        {commitments.map((item) => {
          const isForeign = item.currency !== 'NZD';
          return (
            <div
              key={`${item.transaction_id}-${item.merchant}`}
              data-testid="recurring-commitment-row"
              className="p-3 rounded-xl bg-card/70 border border-border/80 space-y-1.5"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex items-start gap-2">
                  <div className="p-1.5 rounded-lg bg-background border border-border/70 shrink-0 mt-0.5">
                    {getCategoryIcon(item.category)}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-slate-100 truncate">
                      {item.merchant}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-slate-400 mt-0.5">
                      <span>{item.category}</span>
                      <span>|</span>
                      <span className="inline-flex items-center gap-1 capitalize text-sky-300">
                        <Repeat className="w-2.5 h-2.5" />
                        {item.recurrence}
                      </span>
                      <span>|</span>
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="w-2.5 h-2.5" />
                        {item.last_charged_date}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className="text-xs font-bold font-mono text-sky-300">
                    {formatMoney(item.weekly_nzd)}/wk
                  </div>
                  <div className="text-[10px] font-mono text-slate-400">
                    {formatMoney(item.monthly_nzd)}/mo
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/50 text-[10px]">
                <span className="text-slate-400 font-mono">
                  Charge: {item.currency} {item.original_amount.toFixed(2)}
                  {isForeign ? ` (${formatMoney(item.amount_nzd)} NZD)` : ''}
                </span>
                <span className="px-1.5 py-0.5 rounded bg-sky-500/15 border border-sky-500/30 text-sky-300 font-mono">
                  {item.percentage_of_recurring.toFixed(1)}% of fixed
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const VariableCategorySection: React.FC<{
  categories: CategoryBurnEstimate[];
  lookbackWeeks: number;
  totalVariableBurn: number;
  totalEffectiveBurn: number;
}> = ({ categories, lookbackWeeks, totalVariableBurn, totalEffectiveBurn }) => {
  const variableCategories = useMemo(
    () =>
      categories
        .filter((c) => c.variable_weekly_burn > 0)
        .sort((a, b) => b.variable_weekly_burn - a.variable_weekly_burn),
    [categories]
  );

  const segments = useMemo(
    () =>
      toSegmentItems(
        variableCategories.map((c) => ({
          label: c.category,
          value: c.variable_weekly_burn,
        })),
        'var'
      ),
    [variableCategories]
  );

  const totalWeeklyCategorySum = useMemo(
    () => categories.reduce((sum, c) => sum + c.average_weekly_burn, 0) || totalEffectiveBurn,
    [categories, totalEffectiveBurn]
  );

  if (variableCategories.length === 0) {
    return (
      <EmptyState
        title={`No variable spend recorded in the last ${lookbackWeeks} weeks`}
        description="Non-recurring transactions appear here once categorized."
        variant="dashed"
      />
    );
  }

  return (
    <div className="space-y-3">
      {segments.length > 0 && (
        <div className="p-3 rounded-xl bg-background/60 border border-border/70 space-y-2">
          <div className="text-[11px] font-medium text-slate-300 flex items-center justify-between">
            <span>Estimated Variable Share ({lookbackWeeks}w window)</span>
            <span className="font-mono text-amber-300">
              {formatMoney(totalVariableBurn)}/wk
            </span>
          </div>
          <MultiSegmentBar segments={segments} />
        </div>
      )}

      <div className="space-y-2 max-h-[42vh] overflow-y-auto pr-1">
        {variableCategories.map((cat) => {
          const varPct = resolveVariablePct(cat, totalVariableBurn);
          const totalPct = resolveTotalPct(cat, totalWeeklyCategorySum);
          const barWidth = Math.min(100, Math.max(0, varPct));

          return (
            <div
              key={cat.category}
              data-testid="variable-category-row"
              className="p-3 rounded-xl bg-card/70 border border-border/80 space-y-2"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0 flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-background border border-border/70 shrink-0">
                    {getCategoryIcon(cat.category)}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-slate-100 truncate">
                      {cat.category}
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono">
                      {totalPct.toFixed(1)}% of total burn
                      {cat.recurring_weekly_burn > 0
                        ? ` | +${formatMoney(cat.recurring_weekly_burn)}/wk fixed`
                        : ''}
                    </div>
                  </div>
                </div>

                <div className="text-right shrink-0 space-y-0.5">
                  <div className="flex items-center justify-end gap-1.5">
                    <span className="px-1.5 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 text-[10px] font-bold font-mono text-amber-300">
                      {varPct.toFixed(1)}%
                    </span>
                    <span className="text-xs font-bold font-mono text-slate-100">
                      {formatMoney(cat.variable_weekly_burn)}/wk
                    </span>
                  </div>
                  <div className="text-[10px] font-mono text-slate-400">
                    Est. {formatMoney(cat.suggested_monthly_limit)}/mo total
                  </div>
                </div>
              </div>

              <div className="w-full h-1.5 rounded-full bg-slate-800/90 overflow-hidden">
                <div
                  className="h-full rounded-full bg-amber-500 transition-all duration-300"
                  style={{ width: `${barWidth}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

/**
 * Inspects itemized active recurring fixed commitments and per-category estimated
 * variable burn percentages across configurable 4w / 12w / 26w trailing windows.
 */
export const BurnBreakdownModal: React.FC<BurnBreakdownModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'recurring',
}) => {
  const [activeTab, setActiveTab] = useState<BurnBreakdownTab>(initialTab);
  const [lookback, setLookback] = useState<LookbackOption>('12');
  const [report, setReport] = useState<AverageBurnReportResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  const loadReport = async (weeks: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchAverageBurn(weeks);
      setReport(res);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to load burn breakdown');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      void loadReport(Number(lookback));
    }
  }, [isOpen, lookback]);

  const totalWeekly = report?.effective_weekly_burn ?? 0;
  const recurringWeekly = report?.recurring_weekly_burn ?? 0;
  const variableWeekly = report?.variable_weekly_burn ?? 0;
  const recurringSharePct = totalWeekly > 0 ? ((recurringWeekly / totalWeekly) * 100).toFixed(1) : '0.0';
  const variableSharePct = totalWeekly > 0 ? ((variableWeekly / totalWeekly) * 100).toFixed(1) : '0.0';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Weekly Burn Anatomy"
      subtitle="Fixed recurring commitments and estimated variable category shares"
      headerIcon={<Flame className="w-4 h-4 text-amber-400" />}
      className="sm:max-w-xl"
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <SegmentedControl<LookbackOption>
            idPrefix="burn-lookback"
            options={LOOKBACK_OPTIONS}
            value={lookback}
            onChange={setLookback}
            variant="amber"
            size="xs"
          />
          {report && (
            <StatusBadge
              variant="info"
              label={`As of ${report.as_of_date}`}
            />
          )}
        </div>

        {error && (
          <AlertBanner
            variant="error"
            action={
              <Button
                variant="rose"
                size="xs"
                icon={<RefreshCw className="w-3 h-3" />}
                onClick={() => void loadReport(Number(lookback))}
              >
                Retry
              </Button>
            }
          >
            {error}
          </AlertBanner>
        )}

        {report && (
          <SummaryMetricGrid
            columns={3}
            items={[
              {
                id: 'modal-avg-total',
                label: 'Total Avg/wk',
                value: <span className="font-mono">{formatMoney(totalWeekly)}</span>,
                subvalue: `${lookback}w combined`,
                valueClassName: 'text-amber-300',
              },
              {
                id: 'modal-fixed',
                label: 'Fixed',
                value: <span className="font-mono">{formatMoney(recurringWeekly)}</span>,
                subvalue: `${recurringSharePct}% of total`,
                valueClassName: 'text-sky-300',
              },
              {
                id: 'modal-variable',
                label: 'Variable',
                value: <span className="font-mono">{formatMoney(variableWeekly)}</span>,
                subvalue: `${variableSharePct}% of total`,
                valueClassName: 'text-slate-100',
              },
            ]}
          />
        )}

        <SegmentedControl<BurnBreakdownTab>
          idPrefix="burn-tab"
          fullWidth
          variant="amber"
          size="sm"
          value={activeTab}
          onChange={setActiveTab}
          options={[
            {
              id: 'recurring',
              label: 'Fixed',
              icon: <Repeat className="w-3.5 h-3.5" />,
              badge: report?.recurring_commitments?.length,
            },
            {
              id: 'variable',
              label: 'Variable %',
              icon: <Percent className="w-3.5 h-3.5" />,
              badge: report?.categories.filter((c) => c.variable_weekly_burn > 0).length,
            },
          ]}
        />

        {loading && !report ? (
          <LoadingState label="Calculating burn anatomy..." variant="amber" className="py-10" />
        ) : report ? (
          activeTab === 'recurring' ? (
            <RecurringCommitmentsSection commitments={report.recurring_commitments ?? []} />
          ) : (
            <VariableCategorySection
              categories={report.categories}
              lookbackWeeks={report.lookback_weeks}
              totalVariableBurn={variableWeekly}
              totalEffectiveBurn={totalWeekly}
            />
          )
        ) : null}

        <div className="flex justify-end pt-2 border-t border-border">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
};
