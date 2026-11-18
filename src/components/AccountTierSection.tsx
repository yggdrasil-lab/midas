import React from 'react';
import { Lock, ShieldCheck, TrendingUp } from 'lucide-react';
import { SelectableCard, StatusBadge } from '@yggdrasil-lab/ui';
import { ACCOUNT_TIER_META } from '../constants/categories';
import { Account, AssetSnapshot } from '../types';
import { formatMoney } from '../utils/format';

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
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center space-x-2">
          <div className={`p-1 rounded border ${meta.iconBgClass}`}>
            {icons.section}
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
              {meta.sectionTitle}
            </h3>
            <p className="text-[11px] text-slate-400">{meta.sectionDescription}</p>
          </div>
        </div>
        <div className={`font-mono font-semibold text-xs ${meta.totalTextColor}`}>
          {formatMoney(totalNzd, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} NZD
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {accounts.map((acc) => {
          const snaps = snapshotsByAccount[acc.id];
          const latestSnap = snaps?.[0];
          const balance = latestSnap ? Number(latestSnap.balance ?? latestSnap.balance_nzd) : 0;
          const delta = snaps && snaps.length >= 2 ? snaps[0].balance_nzd - snaps[1].balance_nzd : null;
          const hasDelta = delta !== null && delta !== 0;

          const isCrypto = acc.account_type === 'crypto' || acc.currency === 'BTC';
          const valueMaxDecimals = isCrypto ? 8 : 2;
          const returnHint =
            tier === 'growth' && acc.expected_annual_return > 0
              ? ` • ${(acc.expected_annual_return * 100).toFixed(1)}% p.a.`
              : '';

          return (
            <SelectableCard
              key={acc.id}
              data-testid={`account-card-${acc.id}`}
              onClick={() => onInspectAccount(acc)}
              isSelected={false}
              title={acc.name}
              badge={
                <StatusBadge
                  label={meta.shortLabel}
                  variant={meta.badgeVariant}
                  icon={icons.badge}
                />
              }
              value={formatMoney(balance, {
                minimumFractionDigits: 2,
                maximumFractionDigits: valueMaxDecimals,
              })}
              valueSuffix={acc.currency || 'NZD'}
              subtitle={`${acc.institution} • ${acc.account_type.replace('_', ' ')}${returnHint}`}
              subvalue={
                hasDelta
                  ? formatMoney(delta, {
                      showPlusSign: true,
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })
                  : latestSnap
                  ? latestSnap.snapshot_date
                  : 'Inspect Ledger ->'
              }
              subvalueTrend={
                hasDelta ? (delta > 0 ? 'positive' : 'negative') : 'neutral'
              }
              variant={meta.cardVariant}
            />
          );
        })}
      </div>
    </div>
  );
};
