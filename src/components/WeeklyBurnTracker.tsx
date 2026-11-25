import React, { useState } from 'react';
import { Flame, PlusCircle } from 'lucide-react';
import {
  AllowanceProgressBar,
  Button,
  GlassCard,
  SummaryMetricGrid,
  SummaryMetricItem,
} from '@yggdrasil-lab/ui';
import { RunwayData } from '../types';
import { formatMoney } from '../utils/format';
import { BurnBreakdownModal, BurnBreakdownTab } from './BurnBreakdownModal';

interface WeeklyBurnTrackerProps {
  data: RunwayData;
  onQuickLogClick: () => void;
  onBudgetChanged?: () => void;
}

function buildBurnMetricItems(
  avgWeeklyBurn: number,
  recurringBurn: number,
  variableBurn: number,
  onOpen: (tab: BurnBreakdownTab) => void
): SummaryMetricItem[] {
  return [
    {
      id: 'avg-burn',
      label: 'Avg Burn/wk',
      value: formatMoney(avgWeeklyBurn),
      subvalue: '4w trailing + fixed',
      valueClassName: 'font-mono text-amber-300 text-xs sm:text-sm',
      variant: 'amber',
      testId: 'inspect-avg-burn-btn',
      onClick: () => onOpen('variable'),
    },
    {
      id: 'recurring-burn',
      label: 'Recurring',
      value: formatMoney(recurringBurn),
      subvalue: <span className="text-sky-400/90">View fixed</span>,
      valueClassName: 'font-mono text-sky-300 text-xs sm:text-sm',
      variant: 'blue',
      testId: 'inspect-recurring-burn-btn',
      onClick: () => onOpen('recurring'),
    },
    {
      id: 'variable-burn',
      label: 'Variable',
      value: formatMoney(variableBurn),
      subvalue: <span className="text-amber-400/90">Category %</span>,
      valueClassName: 'font-mono text-slate-200 text-xs sm:text-sm',
      variant: 'amber',
      testId: 'inspect-variable-burn-btn',
      onClick: () => onOpen('variable'),
    },
  ];
}

/**
 * Displays current calendar-week spending against weekly budget alongside
 * interactive average weekly burn metrics that drill into recurring commitments
 * and estimated per-category variable burn percentages.
 */
export const WeeklyBurnTracker: React.FC<WeeklyBurnTrackerProps> = ({
  data,
  onQuickLogClick,
  onBudgetChanged,
}) => {
  const { weekly_spend_this_week, weekly_budget_target, time_banked_this_week, breakdown } = data;
  const isBankedPositive = time_banked_this_week >= 0;
  const [breakdownOpen, setBreakdownOpen] = useState(false);
  const [breakdownTab, setBreakdownTab] = useState<BurnBreakdownTab>('recurring');

  const avgWeeklyBurn = breakdown.weekly_burn_rate;
  const recurringBurn = breakdown.recurring_weekly_burn ?? 0;
  const variableBurn = breakdown.variable_weekly_burn ?? Math.max(0, avgWeeklyBurn - recurringBurn);
  const openBreakdown = (tab: BurnBreakdownTab) => {
    setBreakdownTab(tab);
    setBreakdownOpen(true);
  };

  return (
    <div className="space-y-2.5" data-testid="weekly-burn-tracker">
      <AllowanceProgressBar
        title="Weekly Burn & Budget"
        subtitle="Resets Monday 00:00 NZDT"
        icon={<Flame className="w-4 h-4" />}
        variant="brand"
        currentValue={weekly_spend_this_week}
        targetValue={weekly_budget_target}
        currencyPrefix="$"
        currencySuffix="NZD"
        deltaBadge={{
          label: `${isBankedPositive ? `+${time_banked_this_week}` : time_banked_this_week} weeks banked`,
          isPositive: isBankedPositive,
        }}
        action={
          <Button variant="brand" size="sm" icon={<PlusCircle className="w-3.5 h-3.5" />} onClick={onQuickLogClick}>
            Quick Log
          </Button>
        }
      />

      <GlassCard className="!p-3 space-y-2">
        <SummaryMetricGrid
          columns={3}
          items={buildBurnMetricItems(avgWeeklyBurn, recurringBurn, variableBurn, openBreakdown)}
        />
        <div className="text-[10px] text-slate-400 text-center">
          Tap any metric to view recurring items &amp; category %
        </div>
      </GlassCard>

      <BurnBreakdownModal
        isOpen={breakdownOpen}
        onClose={() => setBreakdownOpen(false)}
        initialTab={breakdownTab}
        onBudgetChanged={onBudgetChanged}
      />
    </div>
  );
};
