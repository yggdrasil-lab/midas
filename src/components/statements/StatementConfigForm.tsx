import React from 'react';
import { Lock, ShieldCheck, Sparkles, TrendingUp } from 'lucide-react';
import {
  FormField,
  GlassCard,
  SegmentedControl,
  SelectInput,
  TextInput,
} from '@yggdrasil-lab/ui';
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

const TIER_SEGMENT_OPTIONS = [
  { id: 'cash' as const, label: 'Cash Floor', icon: <ShieldCheck className="w-3 h-3" /> },
  { id: 'growth' as const, label: 'Growth', icon: <TrendingUp className="w-3 h-3" /> },
  { id: 'locked' as const, label: 'Locked', icon: <Lock className="w-3 h-3" /> },
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
    <GlassCard tone="solid" padding="sm" className="bg-card/60 space-y-2.5 shadow-none">
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
        <FormField label="Institution">
          <TextInput
            type="text"
            value={institution}
            onChange={(e) => onInstitutionChange(e.target.value)}
            placeholder="e.g. ANZ, ASB, Sharesies"
            list="known-institutions"
            variant="amber"
          />
          <datalist id="known-institutions">
            {combinedInstitutions.map((inst) => (
              <option key={inst} value={inst} />
            ))}
          </datalist>
        </FormField>

        <FormField label="Account Display Name">
          <TextInput
            type="text"
            value={accountName}
            onChange={(e) => onAccountNameChange(e.target.value)}
            placeholder="e.g. ANZ Freedom"
            variant="amber"
          />
        </FormField>

        <FormField label="Account Type">
          <SelectInput
            value={accountType}
            onChange={(e) => onAccountTypeChange(e.target.value)}
            options={ACCOUNT_TYPE_OPTIONS}
            variant="amber"
          />
        </FormField>

        <FormField label="Currency">
          <TextInput
            type="text"
            maxLength={3}
            value={currency}
            onChange={(e) => onCurrencyChange(e.target.value.toUpperCase())}
            placeholder="NZD, SGD, USD"
            list="common-currencies"
            variant="amber"
            className="font-mono uppercase"
          />
          <datalist id="common-currencies">
            {COMMON_CURRENCIES.map((code) => (
              <option key={code} value={code} />
            ))}
          </datalist>
        </FormField>
      </div>

      <FormField label="Asset Tier (Telemetry Placement)">
        <SegmentedControl<Account['tier']>
          idPrefix="statement-tier"
          fullWidth
          size="sm"
          variant="amber"
          value={tier}
          onChange={onTierChange}
          options={TIER_SEGMENT_OPTIONS}
        />
      </FormField>
    </GlassCard>
  );
};
