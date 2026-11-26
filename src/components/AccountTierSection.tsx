import React from 'react';
import { Lock, ShieldCheck, TrendingUp } from 'lucide-react';
import { SectionHeader, SelectableCard, StatusBadge } from '@yggdrasil-lab/ui';
import { ACCOUNT_TIER_META } from '../taxonomy';
import { Account, AssetSnapshot } from '../types';
import {
  formatAccountSubtitle,
  formatMoney,
  formatPrincipalRecoveredPct,
  formatSignedTransactionAmount,
} from '../utils/format';

interface AccountTierSectionProps {
  tier: Account['tier'];
  accounts: Account[];
  totalNzd: number;
  snapshotsByAccount: Record<number, AssetSnapshot[]>;
  onInspectAccount: (account: Account) => void;
}

const TIER_ICONS: Record<Account['tier'], { section: React.ReactNode; badge: React.ReactNode }> = {
  cash: {
    section: <ShieldCheck className="w-3.5 h-3.5" />,
    badge: <ShieldCheck className="w-3 h-3 mr-1" />,
  },
  growth: {
    section: <TrendingUp className="w-3.5 h-3.5" />,
    badge: <TrendingUp className="w-3 h-3 mr-1" />,
  },
  locked: {
    section: <Lock className="w-3.5 h-3.5" />,
    badge: <Lock className="w-3 h-3 mr-1" />,
  },
};

interface AccountEarnedChipProps {
  account: Account;
  nativeBalance: number;
}

const AccountEarnedChip: React.FC<AccountEarnedChipProps> = ({ account, nativeBalance }) => {
  const payoutCount = account.payout_count ?? 0;
  const payoutNative = Number(account.payout_total_native ?? 0);
  const earnedText = formatSignedTransactionAmount(payoutNative, account.currency || 'NZD');
  const recoveredPct = formatPrincipalRecoveredPct(payoutNative, nativeBalance);
  const payoutLabel = `${payoutCount} ${payoutCount === 1 ? 'payout' : 'payouts'}`;

  return (
    <div
      data-testid={`account-earned-chip-${account.id}`}
      className="mt-2 pt-2 border-t border-emerald-500/20 flex items-center justify-between flex-wrap gap-x-2 gap-y-1 text-[11px]"
    >
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 font-medium whitespace-nowrap">
        <span>Earned</span>
        <span className="font-mono font-semibold whitespace-nowrap">{earnedText}</span>
      </span>
      <span className="text-[10px] text-emerald-300/85 font-mono whitespace-nowrap">
        {recoveredPct !== null ? `${recoveredPct}% recovered • ` : ''}
        {payoutLabel}
      </span>
    </div>
  );
};

interface AccountTierCardProps {
  account: Account;
  tier: Account['tier'];
  snapshots?: AssetSnapshot[];
  onInspect: (account: Account) => void;
}

const AccountTierCard: React.FC<AccountTierCardProps> = ({
  account,
  tier,
  snapshots,
  onInspect,
}) => {
  const meta = ACCOUNT_TIER_META[tier];
  const icons = TIER_ICONS[tier];
  const latestSnap = snapshots?.[0];
  const balance = latestSnap ? Number(latestSnap.balance ?? latestSnap.balance_nzd) : 0;
  const delta =
    snapshots && snapshots.length >= 2 ? snapshots[0].balance_nzd - snapshots[1].balance_nzd : null;
  const hasDelta = delta !== null && delta !== 0;
  const isCrypto = account.account_type === 'crypto' || account.currency === 'BTC';
  const showEarned = (account.payout_count ?? 0) > 0 || account.account_type === 'private_note';
  const subvalue = hasDelta
    ? formatMoney(delta, { showPlusSign: true, minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : latestSnap
      ? latestSnap.snapshot_date
      : 'Inspect Ledger ->';
  const subvalueTrend = hasDelta ? (delta > 0 ? 'positive' : 'negative') : 'neutral';

  const cardProps = {
    onClick: () => onInspect(account),
    title: account.name,
    badge: <StatusBadge label={meta.shortLabel} variant={meta.badgeVariant} icon={icons.badge} />,
    value: formatMoney(balance, { minimumFractionDigits: 2, maximumFractionDigits: isCrypto ? 8 : 2 }),
    valueSuffix: account.currency || 'NZD',
    subtitle: formatAccountSubtitle(account),
    subvalue,
    subvalueTrend: subvalueTrend as 'positive' | 'negative' | 'neutral',
    variant: meta.cardVariant,
  };

  if (!showEarned) {
    return <SelectableCard data-testid={`account-card-${account.id}`} {...cardProps} />;
  }

  return (
    <div
      data-testid={`account-card-${account.id}`}
      className="rounded-xl border bg-background/60 border-border/60 hover:border-slate-700 transition-all duration-150 overflow-hidden"
    >
      <SelectableCard {...cardProps} className="border-0 bg-transparent rounded-none" />
      <div className="px-3.5 pb-3 -mt-1">
        <AccountEarnedChip account={account} nativeBalance={balance} />
      </div>
    </div>
  );
};

/**
 * Renders a tier-grouped account card grid for Cash Floor, Growth, or Locked assets.
 */
export const AccountTierSection: React.FC<AccountTierSectionProps> = ({
  tier,
  accounts,
  totalNzd,
  snapshotsByAccount,
  onInspectAccount,
}) => {
  if (accounts.length === 0) return null;

  const meta = ACCOUNT_TIER_META[tier];
  const icons = TIER_ICONS[tier];

  return (
    <div className="space-y-3">
      <SectionHeader
        title={meta.sectionTitle}
        subtitle={meta.sectionDescription}
        icon={icons.section}
        variant={meta.cardVariant}
        uppercaseTitle
        className="px-1"
        actions={
          <div className={`font-mono font-semibold text-xs whitespace-nowrap ${meta.totalTextColor}`}>
            {formatMoney(totalNzd, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} NZD
          </div>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {accounts.map((acc) => (
          <AccountTierCard
            key={acc.id}
            account={acc}
            tier={tier}
            snapshots={snapshotsByAccount[acc.id]}
            onInspect={onInspectAccount}
          />
        ))}
      </div>
    </div>
  );
};
