import React from 'react';
import { Flame, PlusCircle, ArrowUpRight } from 'lucide-react';
import { RunwayData } from '../types';

interface WeeklyBurnTrackerProps {
  data: RunwayData;
  onQuickLogClick: () => void;
}

export const WeeklyBurnTracker: React.FC<WeeklyBurnTrackerProps> = ({ data, onQuickLogClick }) => {
  const { weekly_spend_this_week, weekly_budget_target, time_banked_this_week } = data;

  const spendPct = Math.min(100, Math.round((weekly_spend_this_week / (weekly_budget_target || 1)) * 100));
  const remaining = Math.max(0, weekly_budget_target - weekly_spend_this_week);

  const isBankedPositive = time_banked_this_week >= 0;

  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-lg">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400">
            <Flame className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-200">Weekly Burn & Budget</h3>
            <p className="text-xs text-slate-400">Resets Monday 00:00 NZDT</p>
          </div>
        </div>

        <button
          onClick={onQuickLogClick}
          className="flex items-center space-x-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 rounded-xl text-xs font-semibold shadow transition-all duration-150"
        >
          <PlusCircle className="w-3.5 h-3.5" />
          <span>Quick Log</span>
        </button>
      </div>

      {/* Progress Bar */}
      <div className="space-y-1.5 my-3">
        <div className="flex justify-between text-xs">
          <span className="text-slate-400">
            Spent <strong className="text-slate-200">${Math.round(weekly_spend_this_week)}</strong> of ${Math.round(weekly_budget_target)}
          </span>
          <span className={spendPct > 90 ? 'text-rose-400 font-semibold' : 'text-slate-400 font-medium'}>
            {spendPct}%
          </span>
        </div>
        <div className="w-full h-2.5 bg-background rounded-full overflow-hidden border border-border/50">
          <div
            className={`h-full transition-all duration-500 rounded-full ${
              spendPct > 90 ? 'bg-rose-500' : spendPct > 70 ? 'bg-amber-400' : 'bg-emerald-400'
            }`}
            style={{ width: `${spendPct}%` }}
          />
        </div>
      </div>

      {/* Micro-Feedback: Time Banked */}
      <div className="flex items-center justify-between pt-2 border-t border-border/50 text-xs">
        <span className="text-slate-400">
          Remaining allowance: <strong className="text-slate-200">${Math.round(remaining)} NZD</strong>
        </span>
        <div
          className={`flex items-center font-medium px-2 py-0.5 rounded-md ${
            isBankedPositive
              ? 'text-emerald-300 bg-emerald-500/10'
              : 'text-rose-300 bg-rose-500/10'
          }`}
        >
          <ArrowUpRight className={`w-3.5 h-3.5 mr-1 ${isBankedPositive ? '' : 'rotate-90'}`} />
          <span>
            {isBankedPositive ? `+${time_banked_this_week}` : time_banked_this_week} weeks banked
          </span>
        </div>
      </div>
    </div>
  );
};
