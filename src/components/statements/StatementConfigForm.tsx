import React from 'react';
import { Lock, ShieldCheck, Sparkles, TrendingUp } from 'lucide-react';
import {
  ACCOUNT_TYPE_OPTIONS,
  COMMON_CURRENCIES,
  COMMON_INSTITUTIONS,
} from '../../constants/categories';
import { Account, InstitutionInfo } from '../../types';

interface StatementConfigFormProps {
  detectedInstitution?: string;
  institution: string;
  accountName: string;
  accountType: string;
  currency: string;
  tier: Account['tier'];
  institutionsList: InstitutionInfo[];
  accounts: Account[];
  onInstitutionChange: (val: string) => void;
  onAccountNameChange: (val: string) => void;
  onAccountTypeChange: (val: string) => void;
  onCurrencyChange: (val: string) => void;
  onTierChange: (tier: Account['tier']) => void;
}

const TIER_PILLS: Array<{
  id: Account['tier'];
  label: string;
  icon: React.ReactNode;
  activeClass: string;
}> = [
  {
    id: 'cash',
    label: 'Cash Floor',
    icon: <ShieldCheck className="w-3 h-3 shrink-0" />,
    activeClass: 'bg-sky-500/10 border-sky-500/50 text-sky-400',
  },
  {
    id: 'growth',
    label: 'Growth',
    icon: <TrendingUp className="w-3 h-3 shrink-0" />,
    activeClass: 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400',
  },
  {
    id: 'locked',
    label: 'Locked',
    icon: <Lock className="w-3 h-3 shrink-0" />,
    activeClass: 'bg-amber-500/10 border-amber-500/50 text-amber-400',
  },
];

/**
 * Configuration form for creating or matching a target portfolio account
 * during statement ingestion.
 */
export const StatementConfigForm: React.FC<StatementConfigFormProps> = ({
  detectedInstitution,
  institution,
  accountName,
  accountType,
  currency,
  tier,
  institutionsList,
  accounts,
  onInstitutionChange,
  onAccountNameChange,
  onAccountTypeChange,
  onCurrencyChange,
  onTierChange,
}) => {
  const combinedInstitutions = Array.from(
    new Set([
      ...institutionsList.map((i) => i.name),
      ...accounts.map((a) => a.institution),
      ...COMMON_INSTITUTIONS,
    ])
  ).filter(Boolean);

  return (
    <div className="p-3 bg-card/60 rounded-xl border border-border space-y-2.5">
      <div className="flex items-center justify-between text-xs text-slate-300">
        <span className="font-semibold text-slate-200">Account Configuration</span>
        <span className="text-[11px] text-emerald-400 flex items-center space-x-1 font-medium">
          <Sparkles className="w-3.5 h-3.5" />
          <span>
            Auto-detected: {detectedInstitution || 'Unknown'} ({currency})
          </span>
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
        <div>
          <label className="text-[10px] text-slate-400 block mb-1">Institution</label>
          <input
            type="text"
            value={institution}
            onChange={(e) => onInstitutionChange(e.target.value)}
            placeholder="e.g. ANZ, ASB, Sharesies"
            list="known-institutions"
            className="w-full px-2.5 py-1.5 bg-background border border-border rounded text-xs text-slate-100 focus:outline-none focus:border-amber-500"
          />
          <datalist id="known-institutions">
            {combinedInstitutions.map((inst) => (
              <option key={inst} value={inst} />
            ))}
          </datalist>
        </div>

        <div>
          <label className="text-[10px] text-slate-400 block mb-1">Account Display Name</label>
          <input
            type="text"
            value={accountName}
            onChange={(e) => onAccountNameChange(e.target.value)}
            placeholder="e.g. ANZ Freedom"
            className="w-full px-2.5 py-1.5 bg-background border border-border rounded text-xs text-slate-100 focus:outline-none focus:border-amber-500"
          />
        </div>

        <div>
          <label className="text-[10px] text-slate-400 block mb-1">Account Type</label>
          <select
            value={accountType}
            onChange={(e) => onAccountTypeChange(e.target.value)}
            className="w-full px-2.5 py-1.5 bg-background border border-border rounded text-xs text-slate-100 focus:outline-none focus:border-amber-500"
          >
            {ACCOUNT_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-[10px] text-slate-400 block mb-1">Currency</label>
          <input
            type="text"
            maxLength={3}
            value={currency}
            onChange={(e) => onCurrencyChange(e.target.value.toUpperCase())}
            placeholder="NZD, SGD, USD"
            list="common-currencies"
            className="w-full px-2.5 py-1.5 bg-background border border-border rounded text-xs text-slate-100 font-mono uppercase focus:outline-none focus:border-amber-500"
          />
          <datalist id="common-currencies">
            {COMMON_CURRENCIES.map((code) => (
              <option key={code} value={code} />
            ))}
          </datalist>
        </div>
      </div>

      <div>
        <label className="text-[10px] text-slate-400 block mb-1">
          Asset Tier (Telemetry Placement)
        </label>
        <div className="grid grid-cols-3 gap-1.5">
          {TIER_PILLS.map((pill) => (
            <button
              key={pill.id}
              type="button"
              onClick={() => onTierChange(pill.id)}
              className={`flex items-center justify-center space-x-1 px-2 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                tier === pill.id
                  ? pill.activeClass
                  : 'bg-card border-border text-slate-400 hover:text-slate-200'
              }`}
            >
              {pill.icon}
              <span>{pill.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
