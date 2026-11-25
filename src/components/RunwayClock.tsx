import React from 'react';
import { Clock, Lock, ShieldCheck, Sparkles, TrendingUp } from 'lucide-react';
import { MetricHero, MetricHeroBadge, StatCard } from '@yggdrasil-lab/ui';
import { RunwayData } from '../types';
import { formatMoney } from '../utils/format';

interface RunwayClockProps {
  data: RunwayData;
}

/**
 * Financial Freedom Clock hero card displaying runway weeks/years and
 * three freedom-tier balance cards.
 */
export const RunwayClock: React.FC<RunwayClockProps> = ({ data }) => {
  const { is_perpetual, primary_runway_weeks, primary_runway_years, breakdown } = data;

  const cashLabel = breakdown.tier_labels?.cash || 'Cash';
  const growthLabel = breakdown.tier_labels?.growth || 'Growth';
  const lockedLabel = breakdown.tier_labels?.locked || 'Locked';

  const getBadge = (): MetricHeroBadge => {
    if (is_perpetual) {
      return {
        label: 'Perpetual Freedom',
        variant: 'amber',
        icon: <Sparkles className="w-3.5 h-3.5 mr-1" />,
      };
    }
    if (primary_runway_weeks >= 104) {
      return {
        label: 'Abundant Horizon',
        variant: 'emerald',
        icon: <ShieldCheck className="w-3.5 h-3.5 mr-1" />,
      };
    }
    if (primary_runway_weeks >= 26) {
      return {
        label: 'Stable Horizon',
        variant: 'sky',
        icon: <Clock className="w-3.5 h-3.5 mr-1" />,
      };
    }
    return {
      label: 'Focus Needed',
      variant: 'rose',
      icon: <Clock className="w-3.5 h-3.5 mr-1" />,
    };
  };

  return (
    <MetricHero
      title="Financial Freedom Clock"
      primaryValue={is_perpetual ? '∞' : Math.round(primary_runway_weeks)}
      primaryUnit="Weeks"
      secondaryValue={is_perpetual ? '∞' : primary_runway_years}
      secondaryUnit="Years"
      toggleHint="Tap to toggle Weeks / Years"
      badge={getBadge()}
      variant="brand"
    >
      <div className="grid grid-cols-3 gap-2 sm:gap-3 pt-4 border-t border-border">
        <StatCard
          title={cashLabel}
          value={`${breakdown.emergency_weeks} w`}
          subtitle={`${formatMoney(breakdown.cash_balance, { minimumFractionDigits: 0, maximumFractionDigits: 0 })} NZD`}
          icon={<ShieldCheck className="w-3.5 h-3.5" />}
          variant="sky"
        />

        <StatCard
          title={growthLabel}
          value={
            breakdown.is_perpetual
              ? 'Perpetual'
              : breakdown.growth_weeks
              ? `${breakdown.growth_weeks} w`
              : 'N/A'
          }
          subtitle={`${formatMoney(breakdown.growth_balance, { minimumFractionDigits: 0, maximumFractionDigits: 0 })} NZD`}
          icon={<TrendingUp className="w-3.5 h-3.5" />}
          variant="emerald"
        />

        <StatCard
          title={lockedLabel}
          value={
            breakdown.locked_weeks !== undefined && breakdown.locked_weeks !== null
              ? `${breakdown.locked_weeks} w`
              : '0 w'
          }
          subtitle={`${formatMoney(breakdown.locked_balance, { minimumFractionDigits: 0, maximumFractionDigits: 0 })} NZD`}
          icon={<Lock className="w-3.5 h-3.5" />}
          variant="amber"
        />
      </div>
    </MetricHero>
  );
};
