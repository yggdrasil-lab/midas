import React, { useState } from 'react';
import { Clock, ShieldCheck, TrendingUp, Lock, Sparkles } from 'lucide-react';
import { RunwayData } from '../types';

interface RunwayClockProps {
  data: RunwayData;
}

export const RunwayClock: React.FC<RunwayClockProps> = ({ data }) => {
  const [showYears, setShowYears] = useState(false);

  const { is_perpetual, primary_runway_weeks, primary_runway_years, breakdown } = data;

  const getStatusBadge = () => {
    if (is_perpetual) {
      return {
        label: 'Perpetual Freedom',
        bg: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
        icon: <Sparkles className="w-4 h-4 mr-1 text-amber-400" />,
      };
    }
    if (primary_runway_weeks >= 104) {
      return {
        label: 'Abundant Horizon',
        bg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
        icon: <ShieldCheck className="w-4 h-4 mr-1 text-emerald-400" />,
      };
    }
    if (primary_runway_weeks >= 26) {
      return {
        label: 'Stable Horizon',
        bg: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
        icon: <Clock className="w-4 h-4 mr-1 text-sky-400" />,
      };
    }
    return {
      label: 'Focus Needed',
      bg: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
      icon: <Clock className="w-4 h-4 mr-1 text-rose-400" />,
    };
  };

  const status = getStatusBadge();

  return (
    <div className="bg-card border border-border rounded-2xl p-6 shadow-xl relative overflow-hidden">
      {/* Background radial glow */}
      <div className="absolute top-0 right-0 -mr-16 -mt-16 w-48 h-48 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Header and status badge */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs font-semibold tracking-wider uppercase text-slate-400">
          Financial Freedom Clock
        </span>
        <div className={`flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${status.bg}`}>
          {status.icon}
          {status.label}
        </div>
      </div>

      {/* Hero counter */}
      <div className="text-center my-6 cursor-pointer" onClick={() => setShowYears(!showYears)}>
        {is_perpetual ? (
          <div className="text-5xl sm:text-6xl font-black text-amber-400 tracking-tight flex items-center justify-center">
            <span>&infin;</span>
            <span className="text-xl ml-2 font-semibold text-slate-300">Weeks</span>
          </div>
        ) : (
          <div className="space-y-1">
            <div className="text-5xl sm:text-6xl font-black text-slate-50 tracking-tight">
              {showYears ? primary_runway_years : Math.round(primary_runway_weeks)}
              <span className="text-2xl font-semibold text-amber-400 ml-2">
                {showYears ? 'Years' : 'Weeks'}
              </span>
            </div>
            <p className="text-xs text-slate-400">
              {showYears ? `Approx ${Math.round(primary_runway_weeks)} weeks` : `Approx ${primary_runway_years} years`} &bull; Tap to toggle
            </p>
          </div>
        )}
      </div>

      {/* Tier breakdown cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 border-t border-border">
        {/* Tier 1: Cash floor */}
        <div className="bg-background/60 p-3 rounded-xl border border-border/60">
          <div className="flex items-center text-xs text-slate-400 mb-1">
            <ShieldCheck className="w-3.5 h-3.5 text-sky-400 mr-1.5" />
            <span>Cash Floor</span>
          </div>
          <div className="text-base font-bold text-slate-200">
            {breakdown.emergency_weeks} <span className="text-xs font-normal text-slate-400">weeks</span>
          </div>
          <div className="text-xs text-slate-400">
            ${breakdown.cash_balance.toLocaleString('en-NZ')} NZD
          </div>
        </div>

        {/* Tier 2: Accessible investments */}
        <div className="bg-background/60 p-3 rounded-xl border border-border/60">
          <div className="flex items-center text-xs text-slate-400 mb-1">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-400 mr-1.5" />
            <span>Growth Portfolio</span>
          </div>
          <div className="text-base font-bold text-slate-200">
            {breakdown.is_perpetual ? 'Perpetual' : breakdown.growth_weeks ? `${breakdown.growth_weeks} w` : 'N/A'}
          </div>
          <div className="text-xs text-slate-400">
            ${breakdown.growth_balance.toLocaleString('en-NZ')} NZD
          </div>
        </div>

        {/* Tier 3: KiwiSaver / locked */}
        <div className="bg-background/60 p-3 rounded-xl border border-border/60">
          <div className="flex items-center text-xs text-slate-400 mb-1">
            <Lock className="w-3.5 h-3.5 text-amber-400 mr-1.5" />
            <span>KiwiSaver (Locked)</span>
          </div>
          <div className="text-base font-bold text-slate-200">
            Retirement
          </div>
          <div className="text-xs text-slate-400">
            ${breakdown.locked_balance.toLocaleString('en-NZ')} NZD
          </div>
        </div>
      </div>
    </div>
  );
};
