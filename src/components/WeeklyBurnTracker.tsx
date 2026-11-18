import React from 'react';
import { Flame, PlusCircle } from 'lucide-react';
import {
  AllowanceProgressBar,
  Button,
  GlassCard,
  SummaryMetricGrid,
} from '@yggdrasil-lab/ui';
import { RunwayData } from '../types';
import { formatMoney } from '../utils/format';

interface WeeklyBurnTrackerProps {
  data: RunwayData;
  onQuickLogClick: () => void;
}

/**
 * Displays current calendar-week spending against weekly budget alongside
 * the underlying average weekly burn decomposition (recurring + variable).
 */
export const WeeklyBurnTracker: React.FC<WeeklyBurnTrackerProps> = ({ data, onQuickLogClick }) => {
  const { weekly_spend_this_week, weekly_budget_target, time_banked_this_week, breakdown } = data;
  const isBankedPositive = time_banked_this_week >= 0;

  const avgWeeklyBurn = breakdown.weekly_burn_rate;
  const recurringBurn = breakdown.recurring_weekly_burn ?? 0;
  const variableBurn =
    breakdown.variable_weekly_burn ?? Math.max(0, avgWeeklyBurn - recurringBurn);

  return (
    <div className="space-y-2.5" data-testid="weekly-burn-tracker">
      <AllowanceProgressBar
        title="Weekly Burn & Budget"
        subtitle="Resets Monday 00:00 NZDT"
        icon={<Flame className="w-4 h-4" />}
        currentValue={weekly_spend_this_week}
        targetValue={weekly_budget_target}
        currencyPrefix="$"
        currencySuffix="NZD"
        deltaBadge={{
          label: `${isBankedPositive ? `+${time_banked_this_week}` : time_banked_this_week} weeks banked`,
          isPositive: isBankedPositive,
        }}
        action={
          <Button
            variant="amber"
            size="sm"
            icon={<PlusCircle className="w-3.5 h-3.5" />}
            onClick={onQuickLogClick}
          >
            Quick Log
          </Button>
        }
      />

      <GlassCard className="!p-3">
        <SummaryMetricGrid
          columns={3}
          items={[
            {
              id: 'avg-burn',
              label: 'Avg Burn/wk',
              value: (
                <span className="text-xs sm:text-sm tracking-tight">
                  {formatMoney(avgWeeklyBurn)}
                </span>
              ),
              subvalue: '4w trailing + fixed',
              valueClassName: 'text-amber-300 font-mono',
            },
            {
              id: 'recurring-burn',
              label: 'Recurring',
              value: (
                <span className="text-xs sm:text-sm tracking-tight">
                  {formatMoney(recurringBurn)}
                </span>
              ),
              subvalue: 'Fixed commitments',
              valueClassName: 'text-sky-300 font-mono',
            },
            {
              id: 'variable-burn',
              label: 'Variable',
              value: (
                <span className="text-xs sm:text-sm tracking-tight">
                  {formatMoney(variableBurn)}
                </span>
              ),
              subvalue: '4w spend avg',
              valueClassName: 'text-slate-200 font-mono',
            },
          ]}
        />
      </GlassCard>
    </div>
  );
};
