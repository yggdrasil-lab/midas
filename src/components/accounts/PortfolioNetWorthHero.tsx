import React from 'react';
import { Building2, Check, Landmark, PieChart, PlusCircle, RefreshCw } from 'lucide-react';
import {
  AlertBanner,
  Button,
  GlassCard,
  MultiSegmentBar,
  SectionHeader,
  SelectableCard,
  StatusBadge,
} from '@yggdrasil-lab/ui';
import { PeriodType, SyncResult } from '../../types';
import { formatMoney } from '../../utils/format';
import { PeriodFilterBar } from '../PeriodFilterBar';

interface PortfolioNetWorthHeroProps {
  accountCount: number;
  tierTotals: { cash: number; growth: number; locked: number };
  totalPortfolioBalance: number;
  totalLiabilities: number;
  period: PeriodType;
  onPeriodChange: (period: PeriodType) => void;
  startDate: string;
  endDate: string;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
  syncing: boolean;
  error: string | null;
  successNote: string | null;
  syncSummary: SyncResult | null;
  onSyncNow: () => void;
  onRecordSnapshot: () => void;
  onInspectAllAccounts: () => void;
}

/**
 * Portfolio net worth summary hero with tier allocation bar, account sync trigger,
 * period selector, and combined ledger entrypoint.
 */
export const PortfolioNetWorthHero: React.FC<PortfolioNetWorthHeroProps> = ({
  accountCount,
  tierTotals,
  totalPortfolioBalance,
  totalLiabilities,
  period,
  onPeriodChange,
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  syncing,
  error,
  successNote,
  syncSummary,
  onSyncNow,
  onRecordSnapshot,
  onInspectAllAccounts,
}) => {
  const pctOfPortfolio = (val: number) =>
    totalPortfolioBalance > 0 ? Math.round((val / totalPortfolioBalance) * 100) : 0;

  const cashPct = pctOfPortfolio(tierTotals.cash);
  const growthPct = pctOfPortfolio(tierTotals.growth);
  const lockedPct = totalPortfolioBalance > 0 ? Math.max(0, 100 - cashPct - growthPct) : 0;

  return (
    <GlassCard className="space-y-5">
      <SectionHeader
        title="Accounts & Per-Account Ledger"
        subtitle="Portfolio Allocation across 3 Freedom Tiers - Tap any account to inspect its ledger"
        icon={<Landmark className="w-5 h-5" />}
        variant="amber"
        size="md"
        titleAs="h2"
        uppercaseTitle
        actions={
          <>
            <PeriodFilterBar
              period={period}
              onPeriodChange={onPeriodChange}
              startDate={startDate}
              endDate={endDate}
              onStartDateChange={onStartDateChange}
              onEndDateChange={onEndDateChange}
              idPrefix="account-period"
            />
            <Button
              variant="secondary"
              size="xs"
              loading={syncing}
              loadingText="Syncing..."
              icon={<RefreshCw className="w-3.5 h-3.5" />}
              onClick={onSyncNow}
              data-testid="sync-now-btn"
            >
              Sync Now
            </Button>
            <Button
              variant="amber"
              size="xs"
              icon={<PlusCircle className="w-3.5 h-3.5" />}
              onClick={onRecordSnapshot}
              data-testid="record-snapshot-btn"
            >
              Record Valuation Snapshot
            </Button>
          </>
        }
      />

      {error && (
        <AlertBanner variant="error" title="Account Error">
          {error}
        </AlertBanner>
      )}

      {successNote && (
        <div className="space-y-2 animate-in fade-in" data-testid="account-success-banner">
          <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-xs text-emerald-300 flex items-center space-x-2">
            <Check className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
            <span>{successNote}</span>
          </div>
          {syncSummary && syncSummary.accounts.length > 0 && (
            <div className="flex flex-wrap gap-1.5" data-testid="sync-summary-accounts">
              {syncSummary.accounts.map((acc) => (
                <span
                  key={acc.account_id}
                  className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-800/80 border border-border/70 text-[11px] text-slate-300"
                >
                  <span className="font-medium text-slate-200">{acc.account_name}</span>
                  <span className="text-emerald-400 font-mono">+{acc.transactions_created}</span>
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="p-4 rounded-xl bg-background/50 border border-border/70 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
          <div>
            <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
              Total Portfolio Net Worth
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-slate-100 font-mono tracking-tight">
              {formatMoney(totalPortfolioBalance - totalLiabilities)}
              <span className="text-sm font-sans font-medium text-slate-400 ml-2">NZD</span>
            </div>
            {totalLiabilities > 0 && (
              <div className="text-[11px] text-slate-400 font-mono pt-0.5">
                Assets {formatMoney(totalPortfolioBalance)} NZD - Loans{' '}
                <span className="text-rose-400">{formatMoney(totalLiabilities)} NZD</span>
              </div>
            )}
          </div>
          <div className="text-xs text-slate-400 flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800/80 border border-border">
              <PieChart className="w-3 h-3 text-amber-400" />
              {accountCount} Active Accounts
            </span>
          </div>
        </div>

        <MultiSegmentBar
          heightClass="h-3"
          segments={[
            {
              id: 'cash',
              label: 'Tier 1 (Cash Floor)',
              value: tierTotals.cash,
              barColor: 'bg-sky-500',
              dotColor: 'bg-sky-400',
              textColor: 'text-sky-300',
              valueLabel: `${formatMoney(tierTotals.cash)} NZD (${cashPct}%)`,
              minVisiblePct: 0,
            },
            {
              id: 'growth',
              label: 'Tier 2 (Growth)',
              value: tierTotals.growth,
              barColor: 'bg-emerald-500',
              dotColor: 'bg-emerald-400',
              textColor: 'text-emerald-300',
              valueLabel: `${formatMoney(tierTotals.growth)} NZD (${growthPct}%)`,
              minVisiblePct: 0,
            },
            {
              id: 'locked',
              label: 'Tier 3 (Locked)',
              value: tierTotals.locked,
              barColor: 'bg-amber-500',
              dotColor: 'bg-amber-400',
              textColor: 'text-amber-300',
              valueLabel: `${formatMoney(tierTotals.locked)} NZD (${lockedPct}%)`,
              minVisiblePct: 0,
            },
          ]}
        />
      </div>

      <div className="pt-1">
        <SelectableCard
          data-testid="account-card-all"
          onClick={onInspectAllAccounts}
          isSelected={false}
          title="All Accounts Combined Ledger"
          icon={<Building2 className="w-4 h-4 text-amber-400" />}
          badge={<StatusBadge label={`${accountCount} active`} variant="idle" />}
          value={formatMoney(totalPortfolioBalance)}
          valueSuffix="NZD"
          subtitle="All connected institutions"
          subvalue="Inspect Ledger ->"
          subvalueTrend="positive"
          variant="amber"
        />
      </div>
    </GlassCard>
  );
};
