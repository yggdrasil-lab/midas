import React from 'react';
import { Clock, Lock, ShieldCheck, Sparkles, TrendingUp } from 'lucide-react';
import { MetricHero, MetricHeroBadge, StatCard } from '@yggdrasil-lab/ui';
import { ACCOUNT_TIER_META } from '../taxonomy';
import { RunwayData } from '../types';
import { formatMoney } from '../utils/format';

interface RunwayClockProps {
  data: RunwayData;
}

function resolveHorizonBadge(isPerpetual: boolean, primaryRunwayWeeks: number): MetricHeroBadge {
  if (isPerpetual) {
    return { label: 'Perpetual Freedom', variant: 'amber', icon: <Sparkles className="w-3.5 h-3.5 mr-1" /> };
  }
  if (primaryRunwayWeeks >= 104) {
    return { label: 'Abundant Horizon', variant: 'emerald', icon: <ShieldCheck className="w-3.5 h-3.5 mr-1" /> };
  }
  if (primaryRunwayWeeks >= 26) {
    return { label: 'Stable Horizon', variant: 'sky', icon: <Clock className="w-3.5 h-3.5 mr-1" /> };
  }
  return { label: 'Focus Needed', variant: 'rose', icon: <Clock className="w-3.5 h-3.5 mr-1" /> };
}

const RunwayTierCards: React.FC<{ breakdown: RunwayData['breakdown'] }> = ({ breakdown }) => {
  const cashLabel = breakdown.tier_labels?.cash || ACCOUNT_TIER_META.cash.shortLabel;
  const growthLabel = breakdown.tier_labels?.growth || ACCOUNT_TIER_META.growth.shortLabel;
  const lockedLabel = breakdown.tier_labels?.locked || ACCOUNT_TIER_META.locked.shortLabel;
  const growthValue = breakdown.is_perpetual
    ? 'Perpetual'
    : breakdown.growth_weeks
      ? `${breakdown.growth_weeks} w`
      : 'N/A';
  const lockedValue =
    breakdown.locked_weeks !== undefined && breakdown.locked_weeks !== null ? `${breakdown.locked_weeks} w` : '0 w';
  const moneyOpts = { minimumFractionDigits: 0, maximumFractionDigits: 0 };

  return (
    <div className="grid grid-cols-3 gap-2 sm:gap-3 pt-4 border-t border-border">
      <StatCard
        title={cashLabel}
        value={`${breakdown.emergency_weeks} w`}
        subtitle={`${formatMoney(breakdown.cash_balance, moneyOpts)} NZD`}
        icon={<ShieldCheck className="w-3.5 h-3.5" />}
        variant={ACCOUNT_TIER_META.cash.statCardVariant}
      />
      <StatCard
        title={growthLabel}
        value={growthValue}
        subtitle={`${formatMoney(breakdown.growth_balance, moneyOpts)} NZD`}
        icon={<TrendingUp className="w-3.5 h-3.5" />}
        variant={ACCOUNT_TIER_META.growth.statCardVariant}
      />
      <StatCard
        title={lockedLabel}
        value={lockedValue}
        subtitle={`${formatMoney(breakdown.locked_balance, moneyOpts)} NZD`}
        icon={<Lock className="w-3.5 h-3.5" />}
        variant={ACCOUNT_TIER_META.locked.statCardVariant}
      />
    </div>
  );
};

/**
 * Financial Freedom Clock hero card displaying runway weeks/years and
 * three freedom-tier balance cards.
 */
export const RunwayClock: React.FC<RunwayClockProps> = ({ data }) => {
  const { is_perpetual, primary_runway_weeks, primary_runway_years, breakdown } = data;

  return (
    <MetricHero
      title="Financial Freedom Clock"
      primaryValue={is_perpetual ? '∞' : Math.round(primary_runway_weeks)}
      primaryUnit="Weeks"
      secondaryValue={is_perpetual ? '∞' : primary_runway_years}
      secondaryUnit="Years"
      toggleHint="Tap to toggle Weeks / Years"
      badge={resolveHorizonBadge(is_perpetual, primary_runway_weeks)}
      variant="brand"
    >
      <RunwayTierCards breakdown={breakdown} />
    </MetricHero>
  );
};
