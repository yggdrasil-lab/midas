import React from 'react';
import { AlertTriangle, CreditCard, Pencil } from 'lucide-react';
import { Button, ProgressBar, SectionHeader, StatusBadge } from '@yggdrasil-lab/ui';
import { Account } from '../../types';
import {
  AccountCreditMetrics,
  CreditBackstopSectionSummary,
  getCreditSeverityBadgeVariant,
  getCreditSeverityTextClass,
} from '../../utils/creditBackstop';
import { formatMoney, formatNzdEquivalent } from '../../utils/format';

interface CreditBackstopSectionProps {
  summary: CreditBackstopSectionSummary;
  onInspectAccount: (account: Account) => void;
  onEditAccount: (account: Account) => void;
}

const MONEY_OPTS = { minimumFractionDigits: 2, maximumFractionDigits: 2 };

const CreditBackstopHeaderActions: React.FC<{ summary: CreditBackstopSectionSummary }> = ({
  summary,
}) => (
  <div
    data-testid="credit-backstop-summary-totals"
    className="flex flex-wrap items-center gap-2 text-xs"
  >
    <span className="font-mono text-slate-300 whitespace-nowrap">
      Available:{' '}
      <strong className="text-amber-300">
        {formatMoney(summary.totalAvailableNzd, MONEY_OPTS)} NZD
      </strong>
    </span>
    <span className="font-mono text-slate-400 whitespace-nowrap">
      Owed:{' '}
      <strong className={summary.totalOwedNzd > 0 ? 'text-rose-400' : 'text-slate-200'}>
        {formatMoney(summary.totalOwedNzd, MONEY_OPTS)} NZD
      </strong>
    </span>
    {summary.configuredCount > 0 && (
      <StatusBadge
        label={`${summary.utilizationPct.toFixed(1)}% utilized`}
        variant={getCreditSeverityBadgeVariant(summary.severity)}
        size="xs"
      />
    )}
  </div>
);

const CreditCardLimitMetrics: React.FC<{ metrics: AccountCreditMetrics }> = ({ metrics }) => {
  const currency = metrics.account.currency || 'NZD';
  const isForeign = currency.toUpperCase() !== 'NZD';
  const severityTextClass = getCreditSeverityTextClass(metrics.severity);

  if (!metrics.hasLimit || metrics.limitNative === null || metrics.availableNative === null) {
    return (
      <div className="space-y-2 pt-1">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-400">Owed</span>
          <span className={metrics.owedNative > 0 ? 'font-mono font-semibold text-rose-400' : 'font-mono text-slate-300'}>
            {formatMoney(metrics.owedNative, MONEY_OPTS)} {currency}
          </span>
        </div>
        <div className="text-[11px] font-medium text-amber-300 bg-amber-500/10 border border-amber-500/25 rounded-lg px-2.5 py-1.5">
          Set credit limit to track available backstop
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      <div>
        <div className="text-[10px] uppercase tracking-wider text-slate-400">Available</div>
        <div className="text-lg font-bold text-slate-100 font-mono leading-tight">
          {formatMoney(metrics.availableNative, MONEY_OPTS)}
          <span className="text-xs font-normal text-slate-400 ml-1">{currency}</span>
        </div>
        {isForeign && metrics.availableNzd !== null && (
          <div className="text-[11px] font-mono text-slate-400">
            ({formatNzdEquivalent(metrics.availableNzd)})
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-border/50">
        <div>
          <div className="text-slate-400">Owed</div>
          <div className={metrics.owedNative > 0 ? 'font-mono font-semibold text-rose-400' : 'font-mono text-slate-300'}>
            {formatMoney(metrics.owedNative, MONEY_OPTS)} {currency}
          </div>
        </div>
        <div className="text-right">
          <div className="text-slate-400">Limit</div>
          <div className="font-mono text-slate-200">
            {formatMoney(metrics.limitNative, MONEY_OPTS)} {currency}
          </div>
          {isForeign && metrics.limitNzd !== null && (
            <div className="text-[10px] font-mono text-slate-400">
              {formatNzdEquivalent(metrics.limitNzd)}
            </div>
          )}
        </div>
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-slate-400">Utilization</span>
          <span className={`font-mono font-semibold ${severityTextClass}`}>
            {metrics.utilizationPct?.toFixed(1)}%
          </span>
        </div>
        <ProgressBar
          value={metrics.utilizationPct ?? 0}
          max={100}
          tone={metrics.severity}
          size="sm"
          label={`${metrics.account.name} credit utilization`}
        />
      </div>
    </div>
  );
};

const CreditBackstopCard: React.FC<{
  metrics: AccountCreditMetrics;
  onInspect: (account: Account) => void;
  onEdit: (account: Account) => void;
}> = ({ metrics, onInspect, onEdit }) => {
  const { account, isCreditLine } = metrics;
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onInspect(account);
    }
  };

  return (
    <div
      data-testid={`account-card-${account.id}`}
      role="button"
      tabIndex={0}
      onClick={() => onInspect(account)}
      onKeyDown={handleKeyDown}
      className="text-left p-3.5 rounded-xl border bg-background/60 border-border/60 hover:border-amber-500/40 transition-all duration-150 cursor-pointer space-y-2.5"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-xs font-semibold text-slate-100 truncate">{account.name}</div>
          <div className="text-[11px] text-slate-400 truncate">{account.institution}</div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="xs"
          icon={<Pencil className="w-3 h-3" />}
          onClick={(e) => {
            e.stopPropagation();
            onEdit(account);
          }}
          data-testid={`edit-account-btn-${account.id}`}
          aria-label={`Edit ${account.name}`}
          className="shrink-0"
        >
          Edit
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <StatusBadge
          label={isCreditLine ? 'Credit Line' : 'Credit Card'}
          variant={isCreditLine ? 'warning' : 'info'}
          size="xs"
          showDot={false}
        />
        {isCreditLine && (
          <StatusBadge
            label="No grace period"
            variant="warning"
            size="xs"
            icon={<AlertTriangle className="w-3 h-3" />}
          />
        )}
      </div>

      <CreditCardLimitMetrics metrics={metrics} />
    </div>
  );
};

/**
 * Renders the dedicated Credit Backstop section for active credit_card and
 * credit_line accounts, separate from Cash Floor and Net Worth.
 */
export const CreditBackstopSection: React.FC<CreditBackstopSectionProps> = ({
  summary,
  onInspectAccount,
  onEditAccount,
}) => {
  if (summary.revolvingAccounts.length === 0) return null;

  return (
    <section className="space-y-3" data-testid="credit-backstop-section">
      <SectionHeader
        title="Credit Backstop (Emergency Headroom)"
        subtitle="Separate from Cash Floor and Net Worth: revolving credit limits and utilization"
        icon={<CreditCard className="w-3.5 h-3.5" />}
        variant="amber"
        uppercaseTitle
        className="px-1"
        actions={<CreditBackstopHeaderActions summary={summary} />}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {summary.revolvingAccounts.map((item) => (
          <CreditBackstopCard
            key={item.account.id}
            metrics={item}
            onInspect={onInspectAccount}
            onEdit={onEditAccount}
          />
        ))}
      </div>
    </section>
  );
};
