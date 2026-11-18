import React, { useState } from 'react';
import { ChevronRight, Flame, PlusCircle } from 'lucide-react';
import {
  AllowanceProgressBar,
  Button,
  GlassCard,
} from '@yggdrasil-lab/ui';
import { RunwayData } from '../types';
import { formatMoney } from '../utils/format';
import { BurnBreakdownModal, BurnBreakdownTab } from './BurnBreakdownModal';

interface WeeklyBurnTrackerProps {
  data: RunwayData;
  onQuickLogClick: () => void;
  onBudgetChanged?: () => void;
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
  const variableBurn =
    breakdown.variable_weekly_burn ?? Math.max(0, avgWeeklyBurn - recurringBurn);

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

      <GlassCard className="!p-3 space-y-2">
        <div className="grid grid-cols-3 gap-2 text-center">
          <button
            type="button"
            data-testid="inspect-avg-burn-btn"
            onClick={() => openBreakdown('variable')}
            className="px-2.5 py-2 rounded-xl bg-background/60 border border-border/60 hover:border-amber-500/40 hover:bg-amber-500/5 transition-colors text-center cursor-pointer"
          >
            <div className="text-[10px] uppercase tracking-wider text-slate-400 font-medium truncate">
              Avg Burn/wk
            </div>
            <div className="text-xs sm:text-sm font-bold font-mono text-amber-300 mt-0.5 truncate">
              {formatMoney(avgWeeklyBurn)}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5 truncate">
              4w trailing + fixed
            </div>
          </button>

          <button
            type="button"
            data-testid="inspect-recurring-burn-btn"
            onClick={() => openBreakdown('recurring')}
            className="px-2.5 py-2 rounded-xl bg-background/60 border border-border/60 hover:border-sky-500/40 hover:bg-sky-500/5 transition-colors text-center cursor-pointer"
          >
            <div className="text-[10px] uppercase tracking-wider text-slate-400 font-medium truncate">
              Recurring
            </div>
            <div className="text-xs sm:text-sm font-bold font-mono text-sky-300 mt-0.5 truncate">
              {formatMoney(recurringBurn)}
            </div>
            <div className="text-[10px] text-sky-400/90 mt-0.5 inline-flex items-center justify-center gap-0.5 max-w-full truncate">
              <span className="truncate">View fixed</span>
              <ChevronRight className="w-2.5 h-2.5 shrink-0" />
            </div>
          </button>

          <button
            type="button"
            data-testid="inspect-variable-burn-btn"
            onClick={() => openBreakdown('variable')}
            className="px-2.5 py-2 rounded-xl bg-background/60 border border-border/60 hover:border-amber-500/40 hover:bg-amber-500/5 transition-colors text-center cursor-pointer"
          >
            <div className="text-[10px] uppercase tracking-wider text-slate-400 font-medium truncate">
              Variable
            </div>
            <div className="text-xs sm:text-sm font-bold font-mono text-slate-200 mt-0.5 truncate">
              {formatMoney(variableBurn)}
            </div>
            <div className="text-[10px] text-amber-400/90 mt-0.5 inline-flex items-center justify-center gap-0.5 max-w-full truncate">
              <span className="truncate">Category %</span>
              <ChevronRight className="w-2.5 h-2.5 shrink-0" />
            </div>
          </button>
        </div>

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
