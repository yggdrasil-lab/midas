import React from 'react';
import { Lock, ShieldCheck, TrendingUp } from 'lucide-react';
import { StatusBadge } from '@yggdrasil-lab/ui';
import { ACCOUNT_TIER_META } from '../constants/categories';
import { Account, AssetSnapshot } from '../types';
import { formatAccountSubtitle, formatMoney, formatSignedTransactionAmount } from '../utils/format';

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
  const recoveredPct = nativeBalance > 0 ? (payoutNative / nativeBalance) * 100 : null;
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
        {recoveredPct !== null ? `${recoveredPct.toFixed(1)}% recovered • ` : ''}
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
  const trendColor = hasDelta
    ? delta > 0
      ? 'text-emerald-400'
      : 'text-rose-400'
    : 'text-slate-400';

  return (
    <button
      type="button"
      data-testid={`account-card-${account.id}`}
      onClick={() => onInspect(account)}
      className="text-left p-3.5 rounded-xl border transition-all duration-150 w-full bg-background/60 border-border/60 hover:border-slate-700"
    >
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <span className="text-xs font-semibold text-slate-200 truncate min-w-0">
          {account.name}
        </span>
        <div className="shrink-0">
          <StatusBadge label={meta.shortLabel} variant={meta.badgeVariant} icon={icons.badge} />
        </div>
      </div>
      <div className="text-lg font-bold text-slate-100 font-mono">
        {formatMoney(balance, { minimumFractionDigits: 2, maximumFractionDigits: isCrypto ? 8 : 2 })}
        <span className="text-xs font-normal text-slate-400 ml-1">{account.currency || 'NZD'}</span>
      </div>
      <div className="flex items-center justify-between gap-1.5 text-[11px] text-slate-400 mt-1">
        <span className="truncate min-w-0">{formatAccountSubtitle(account)}</span>
        <span className={`font-mono font-medium shrink-0 ${trendColor}`}>{subvalue}</span>
      </div>
      {showEarned && <AccountEarnedChip account={account} nativeBalance={balance} />}
    </button>
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
      <div className="flex items-center justify-between gap-2 px-1">
        <div className="flex items-center space-x-2 min-w-0">
          <div className={`p-1 rounded border shrink-0 ${meta.iconBgClass}`}>{icons.section}</div>
          <div className="min-w-0">
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
              {meta.sectionTitle}
            </h3>
            <p className="text-[11px] text-slate-400">{meta.sectionDescription}</p>
          </div>
        </div>
        <div className={`font-mono font-semibold text-xs whitespace-nowrap ${meta.totalTextColor}`}>
          {formatMoney(totalNzd, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} NZD
        </div>
      </div>

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
