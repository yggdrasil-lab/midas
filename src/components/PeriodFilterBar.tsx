import React from 'react';
import { Button, SegmentedControl } from '@yggdrasil-lab/ui';
import { Calendar } from 'lucide-react';
import { PERIOD_OPTIONS } from '../constants/categories';
import { PeriodType } from '../types';

interface PeriodFilterBarProps {
  period: PeriodType;
  onPeriodChange: (period: PeriodType) => void;
  startDate: string;
  endDate: string;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
  idPrefix?: string;
}

/** Returns default [startDate, endDate] (trailing 30 days) in YYYY-MM-DD local format. */
export function getDefaultCustomRange(): { startDate: string; endDate: string } {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 30);
  const toIso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return { startDate: toIso(start), endDate: toIso(end) };
}

/**
 * Shared quick-period selector (This Week, Last Week, This Month, Last Month)
 * paired with a Custom date-range toggle and inline date inputs.
 */
export const PeriodFilterBar: React.FC<PeriodFilterBarProps> = ({
  period,
  onPeriodChange,
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  idPrefix,
}) => {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1.5 flex-wrap">
        <SegmentedControl
          options={PERIOD_OPTIONS}
          value={period === 'custom' ? ('' as PeriodType) : period}
          onChange={onPeriodChange}
          variant="amber"
          size="xs"
          idPrefix={idPrefix}
        />
        <Button
          variant={period === 'custom' ? 'amber' : 'outline'}
          size="xs"
          icon={<Calendar className="w-3 h-3" />}
          onClick={() => onPeriodChange('custom')}
          data-testid={idPrefix ? `${idPrefix}-custom-btn` : undefined}
        >
          Custom
        </Button>
      </div>
      {period === 'custom' && (
        <div className="flex items-center gap-2 flex-wrap text-xs">
          <label className="flex items-center gap-1.5 text-slate-400">
            <span>From</span>
            <input
              type="date"
              value={startDate}
              max={endDate || undefined}
              onChange={(e) => onStartDateChange(e.target.value)}
              className="bg-background/80 border border-border/70 rounded-lg px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-amber-500/60"
            />
          </label>
          <label className="flex items-center gap-1.5 text-slate-400">
            <span>To</span>
            <input
              type="date"
              value={endDate}
              min={startDate || undefined}
              onChange={(e) => onEndDateChange(e.target.value)}
              className="bg-background/80 border border-border/70 rounded-lg px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-amber-500/60"
            />
          </label>
        </div>
      )}
    </div>
  );
};
