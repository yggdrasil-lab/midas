import React from 'react';
import { ChevronRight, CreditCard } from 'lucide-react';
import { StatusBadge } from '@yggdrasil-lab/ui';
import { CreditBackstopSummary } from '../types';
import {
  getCreditSeverityBadgeVariant,
  getCreditSeverityTextClass,
  getCreditUtilizationSeverity,
} from '../utils/creditBackstop';
import { formatMoney } from '../utils/format';

interface CreditBackstopPillProps {
  summary: CreditBackstopSummary;
  onClick: () => void;
}

/**
 * Compact clickable overview card displaying emergency revolving credit headroom
 * while keeping Freedom Runway weeks strictly untouched.
 */
export const CreditBackstopPill: React.FC<CreditBackstopPillProps> = ({ summary, onClick }) => {
  const severity = getCreditUtilizationSeverity(summary.credit_utilization_pct);
  const badgeVariant = getCreditSeverityBadgeVariant(severity);
  const textClass = getCreditSeverityTextClass(severity);

  return (
    <button
      type="button"
      onClick={onClick}
      data-testid="overview-credit-backstop-pill"
      className="w-full text-left rounded-ui-card glass-panel bg-card/70 backdrop-blur-md border border-border/80 hover:border-amber-500/40 px-4 py-3 transition-all duration-150 cursor-pointer group"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 shrink-0">
            <CreditCard className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold text-slate-200 uppercase tracking-wide">
                Credit Backstop
              </span>
              <StatusBadge
                label={`+${summary.backstop_weeks.toFixed(1)} w backstop`}
                variant={badgeVariant}
                size="xs"
                showDot={false}
              />
            </div>
            <div className="text-[11px] text-slate-400">
              Separate from Freedom Runway
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 text-right">
          <div>
            <div className="text-sm font-bold font-mono text-slate-100 whitespace-nowrap">
              {formatMoney(summary.total_available_credit_nzd)} NZD
            </div>
            <div className={`text-[11px] font-mono ${textClass} whitespace-nowrap`}>
              {summary.credit_utilization_pct.toFixed(1)}% used
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-amber-400 transition-colors" />
        </div>
      </div>
    </button>
  );
};
