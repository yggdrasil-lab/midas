import React from 'react';
import { Clock, ShieldCheck, TrendingUp, Lock, Sparkles } from 'lucide-react';
import { MetricHero, MetricHeroBadge } from '@yggdrasil-lab/ui';
import { RunwayData } from '../types';

interface RunwayClockProps {
  data: RunwayData;
}

export const RunwayClock: React.FC<RunwayClockProps> = ({ data }) => {
  const { is_perpetual, primary_runway_weeks, primary_runway_years, breakdown } = data;

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
      {/* 3-Tier Asset Floor Cards */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3 pt-4 border-t border-border">
        {/* Tier 1: Cash floor */}
        <div className="bg-background/60 p-2 sm:p-3 rounded-xl border border-border/60">
          <div className="flex items-center text-[10px] sm:text-xs text-slate-400 mb-1 truncate">
            <ShieldCheck className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-sky-400 mr-1 shrink-0" />
            <span className="truncate">Cash Floor</span>
          </div>
          <div className="text-sm sm:text-base font-bold text-slate-200">
            {breakdown.emergency_weeks} <span className="text-[10px] sm:text-xs font-normal text-slate-400">w</span>
          </div>
          <div className="text-[10px] sm:text-xs text-slate-400 truncate">
            ${Math.round(breakdown.cash_balance).toLocaleString('en-NZ')}
          </div>
        </div>

        {/* Tier 2: Accessible investments */}
        <div className="bg-background/60 p-2 sm:p-3 rounded-xl border border-border/60">
          <div className="flex items-center text-[10px] sm:text-xs text-slate-400 mb-1 truncate">
            <TrendingUp className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-emerald-400 mr-1 shrink-0" />
            <span className="truncate">Growth</span>
          </div>
          <div className="text-sm sm:text-base font-bold text-slate-200">
            {breakdown.is_perpetual ? 'Perpetual' : breakdown.growth_weeks ? `${breakdown.growth_weeks} w` : 'N/A'}
          </div>
          <div className="text-[10px] sm:text-xs text-slate-400 truncate">
            ${Math.round(breakdown.growth_balance).toLocaleString('en-NZ')}
          </div>
        </div>

        {/* Tier 3: KiwiSaver / locked */}
        <div className="bg-background/60 p-2 sm:p-3 rounded-xl border border-border/60">
          <div className="flex items-center text-[10px] sm:text-xs text-slate-400 mb-1 truncate">
            <Lock className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-400 mr-1 shrink-0" />
            <span className="truncate">KiwiSaver</span>
          </div>
          <div className="text-sm sm:text-base font-bold text-slate-200">
            Locked
          </div>
          <div className="text-[10px] sm:text-xs text-slate-400 truncate">
            ${Math.round(breakdown.locked_balance).toLocaleString('en-NZ')}
          </div>
        </div>
      </div>
    </MetricHero>
  );
};
