import React from 'react';
import { Clock, ShieldCheck, TrendingUp, Lock, Sparkles } from 'lucide-react';
import { MetricHero, MetricHeroBadge, StatCard } from '@yggdrasil-lab/ui';
import { RunwayData } from '../types';

interface RunwayClockProps {
  data: RunwayData;
}

export const RunwayClock: React.FC<RunwayClockProps> = ({ data }) => {
  const { is_perpetual, primary_runway_weeks, primary_runway_years, breakdown } = data;

  const cashLabel = breakdown.tier_labels?.cash || 'Cash Floor';
  const growthLabel = breakdown.tier_labels?.growth || 'Growth';
  const lockedLabel = breakdown.tier_labels?.locked || 'Locked Reserve';

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
      variant="amber"
    >
      {/* 3-Tier Dynamic Asset Cards */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3 pt-4 border-t border-border">
        {/* Tier 1: Cash floor */}
        <StatCard
          title={cashLabel}
          value={`${breakdown.emergency_weeks} w`}
          subtitle={`$${Math.round(breakdown.cash_balance).toLocaleString('en-NZ')}`}
          icon={<ShieldCheck className="w-3.5 h-3.5" />}
          variant="sky"
        />

        {/* Tier 2: Accessible growth investments */}
        <StatCard
          title={growthLabel}
          value={breakdown.is_perpetual ? 'Perpetual' : breakdown.growth_weeks ? `${breakdown.growth_weeks} w` : 'N/A'}
          subtitle={`$${Math.round(breakdown.growth_balance).toLocaleString('en-NZ')}`}
          icon={<TrendingUp className="w-3.5 h-3.5" />}
          variant="emerald"
        />

        {/* Tier 3: Preserved / locked retirement capital */}
        <StatCard
          title={lockedLabel}
          value={breakdown.locked_weeks !== undefined && breakdown.locked_weeks !== null ? `${breakdown.locked_weeks} w` : '0 w'}
          subtitle={`$${Math.round(breakdown.locked_balance).toLocaleString('en-NZ')} (Locked)`}
          icon={<Lock className="w-3.5 h-3.5" />}
          variant="amber"
        />
      </div>
    </MetricHero>
  );
};
