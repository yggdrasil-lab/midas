import React from 'react';
import { Flame, PlusCircle } from 'lucide-react';
import { AllowanceProgressBar, Button } from '@yggdrasil-lab/ui';
import { RunwayData } from '../types';

interface WeeklyBurnTrackerProps {
  data: RunwayData;
  onQuickLogClick: () => void;
}

export const WeeklyBurnTracker: React.FC<WeeklyBurnTrackerProps> = ({ data, onQuickLogClick }) => {
  const { weekly_spend_this_week, weekly_budget_target, time_banked_this_week } = data;
  const isBankedPositive = time_banked_this_week >= 0;

  return (
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
  );
};
