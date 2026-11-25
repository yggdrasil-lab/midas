import React from 'react';
import { Check, RefreshCw, SlidersHorizontal } from 'lucide-react';
import { Button, FormField, SelectInput, TextInput } from '@yggdrasil-lab/ui';
import { RECURRENCE_OPTIONS } from '../../constants/categories';
import { useCategories } from '../../hooks/useCategories';
import { Account, LoanItem, RecurrenceType, RuleDirection } from '../../types';

export interface RuleFormDraft {
  name: string;
  descriptionPattern: string;
  matchType: 'contains' | 'exact' | 'starts_with';
  amountEquals: string;
  minAmount: string;
  maxAmount: string;
  direction: RuleDirection | '';
  targetCategory: string;
  targetTags: string;
  targetRecurrence: RecurrenceType | '';
  renameMerchant: string;
  counterpartAccountId: string;
  loanId: string;
  priority: number;
  applyRetroactively: boolean;
}

export const DEFAULT_RULE_DRAFT: RuleFormDraft = {
  name: '',
  descriptionPattern: '',
  matchType: 'contains',
  amountEquals: '',
  minAmount: '',
  maxAmount: '',
  direction: '',
  targetCategory: 'General',
  targetTags: '',
  targetRecurrence: '',
  renameMerchant: '',
  counterpartAccountId: '',
  loanId: '',
  priority: 10,
  applyRetroactively: true,
};

interface RuleEditorFormProps {
  draft: RuleFormDraft;
  accounts: Account[];
  loans: LoanItem[];
  isEditing: boolean;
  saving: boolean;
  onChange: (updater: (prev: RuleFormDraft) => RuleFormDraft) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
}

type UpdateFieldFn = <K extends keyof RuleFormDraft>(key: K, value: RuleFormDraft[K]) => void;

const RuleMatcherFields: React.FC<{ draft: RuleFormDraft; updateField: UpdateFieldFn }> = ({
  draft,
  updateField,
}) => (
  <>
    <FormField label="Rule Name" required>
      <TextInput
        type="text"
        required
        placeholder="e.g. Regular Utilities Transfer"
        value={draft.name}
        onChange={(e) => updateField('name', e.target.value)}
        data-testid="rule-name-input"
        variant="amber"
      />
    </FormField>

    <FormField label="Priority" hint="Lower runs first">
      <TextInput
        type="number"
        min="1"
        max="100"
        value={draft.priority}
        onChange={(e) => updateField('priority', parseInt(e.target.value, 10) || 10)}
        variant="amber"
      />
    </FormField>

    <FormField label="Description Pattern" required>
      <TextInput
        type="text"
        required
        placeholder="e.g. 12-0323 or WISE"
        value={draft.descriptionPattern}
        onChange={(e) => updateField('descriptionPattern', e.target.value)}
        data-testid="rule-pattern-input"
        variant="amber"
        className="font-mono"
      />
    </FormField>

    <FormField label="Pattern Match Type">
      <SelectInput
        value={draft.matchType}
        onChange={(e) => updateField('matchType', e.target.value as RuleFormDraft['matchType'])}
        variant="amber"
        options={[
          { value: 'contains', label: 'Contains' },
          { value: 'starts_with', label: 'Starts with' },
          { value: 'exact', label: 'Exact match' },
        ]}
      />
    </FormField>

    <FormField label="Exact Amount ($)" hint="Optional">
      <TextInput
        type="number"
        step="0.01"
        min="0"
        placeholder="e.g. 400.00"
        value={draft.amountEquals}
        onChange={(e) => updateField('amountEquals', e.target.value)}
        data-testid="rule-amount-equals-input"
        leftIcon={<span className="text-xs">$</span>}
        variant="amber"
        className="font-mono"
      />
    </FormField>

    <FormField label="Direction" hint="Optional">
      <SelectInput
        aria-label="Direction"
        value={draft.direction}
        onChange={(e) => updateField('direction', e.target.value as RuleFormDraft['direction'])}
        data-testid="rule-direction-select"
        variant="amber"
        options={[
          { value: '', label: 'Any' },
          { value: 'outflow', label: 'Outflow' },
          { value: 'inflow', label: 'Inflow' },
        ]}
      />
    </FormField>

    <div className="sm:col-span-2 grid grid-cols-2 gap-2.5">
      <FormField label="Min Amount ($)">
        <TextInput
          type="number"
          step="0.01"
          min="0"
          aria-label="Min Amount ($)"
          placeholder="e.g. 30.00"
          value={draft.minAmount}
          onChange={(e) => updateField('minAmount', e.target.value)}
          data-testid="rule-min-amount-input"
          leftIcon={<span className="text-xs">$</span>}
          variant="amber"
          className="font-mono"
        />
      </FormField>

      <FormField label="Max Amount ($)">
        <TextInput
          type="number"
          step="0.01"
          min="0"
          aria-label="Max Amount ($)"
          placeholder="e.g. 29.99"
          value={draft.maxAmount}
          onChange={(e) => updateField('maxAmount', e.target.value)}
          data-testid="rule-max-amount-input"
          leftIcon={<span className="text-xs">$</span>}
          variant="amber"
          className="font-mono"
        />
      </FormField>
    </div>
  </>
);

const RuleActionFields: React.FC<{
  draft: RuleFormDraft;
  selectableCategories: string[];
  updateField: UpdateFieldFn;
  onCategoryChange: (nextCategory: string) => void;
}> = ({ draft, selectableCategories, updateField, onCategoryChange }) => (
  <>
    <FormField label="Target Category">
      <SelectInput
        value={draft.targetCategory}
        onChange={(e) => onCategoryChange(e.target.value)}
        data-testid="rule-category-select"
        variant="amber"
      >
        {selectableCategories.map((cat) => (
          <option key={cat} value={cat}>
            {cat}
          </option>
        ))}
      </SelectInput>
    </FormField>

    <FormField label="Rename Merchant" hint="Optional">
      <TextInput
        type="text"
        placeholder="e.g. Power/Water Utilities"
        value={draft.renameMerchant}
        onChange={(e) => updateField('renameMerchant', e.target.value)}
        variant="amber"
      />
    </FormField>

    <FormField label="Target Tags" hint="Comma-separated">
      <TextInput
        type="text"
        placeholder="e.g. gym, subscription"
        value={draft.targetTags}
        onChange={(e) => updateField('targetTags', e.target.value)}
        data-testid="rule-tags-input"
        variant="amber"
        className="font-mono"
      />
    </FormField>

    <FormField label="Payment Frequency" hint="Optional">
      <SelectInput
        value={draft.targetRecurrence}
        onChange={(e) => updateField('targetRecurrence', e.target.value as RecurrenceType | '')}
        variant="amber"
      >
        {RECURRENCE_OPTIONS.map((opt) => (
          <option key={opt.label} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </SelectInput>
    </FormField>
  </>
);

const RuleTargetAccountFields: React.FC<{
  draft: RuleFormDraft;
  selectableAccounts: Account[];
  selectableLoans: LoanItem[];
  showLoanTarget: boolean;
  updateField: UpdateFieldFn;
}> = ({ draft, selectableAccounts, selectableLoans, showLoanTarget, updateField }) => (
  <>
    <div className="sm:col-span-2">
      <FormField
        label="Counterpart Account"
        htmlFor="rule-counterpart-account-select"
        hint={
          <>
            For <span className="text-sky-300 font-medium">Transfers</span>, auto-mirrors a linked counter-leg onto this account. For{' '}
            <span className="text-emerald-300 font-medium">Income</span> or other categories, attributes the flow (such as dividends or payouts) without creating a duplicate leg.
          </>
        }
      >
        <SelectInput
          id="rule-counterpart-account-select"
          aria-label="Counterpart Account"
          value={draft.counterpartAccountId}
          onChange={(e) => updateField('counterpartAccountId', e.target.value)}
          data-testid="rule-counterpart-account-select"
          variant="amber"
        >
          <option value="">None (No counterpart account)</option>
          {selectableAccounts.map((acc) => (
            <option key={acc.id} value={String(acc.id)}>
              {acc.name} ({acc.currency || 'NZD'})
            </option>
          ))}
        </SelectInput>
      </FormField>
    </div>

    {showLoanTarget && (
      <div className="sm:col-span-2">
        <FormField
          label="Financing / Loan Target"
          htmlFor="rule-loan-select"
          hint={
            <>
              Matching <span className="text-amber-300 font-medium">Debt &amp; Loans</span> transactions automatically link to the selected loan (outflows amortize &quot;I Owe&quot; debt or record &quot;Owed to Me&quot; lending; inflows record repayments) without creating duplicate transfer legs.
            </>
          }
        >
          <SelectInput
            id="rule-loan-select"
            aria-label="Financing / Loan Target"
            value={draft.loanId}
            onChange={(e) => updateField('loanId', e.target.value)}
            data-testid="rule-loan-select"
            variant="amber"
          >
            <option value="">None (No financing loan)</option>
            {selectableLoans.map((loan) => (
              <option key={loan.id} value={String(loan.id)}>
                {loan.name} ({loan.lender}) [{loan.loan_type === 'lent' ? 'Owed to Me' : 'I Owe'}]
              </option>
            ))}
          </SelectInput>
        </FormField>
      </div>
    )}
  </>
);

const RuleEditorFooter: React.FC<{
  applyRetroactively: boolean;
  isEditing: boolean;
  saving: boolean;
  onToggleRetroactive: (checked: boolean) => void;
  onCancel: () => void;
}> = ({ applyRetroactively, isEditing, saving, onToggleRetroactive, onCancel }) => (
  <>
    <div className="pt-1 flex items-center space-x-2">
      <input
        type="checkbox"
        id="apply_retroactively_check"
        checked={applyRetroactively}
        onChange={(e) => onToggleRetroactive(e.target.checked)}
        className="rounded border-border text-amber-500 focus:ring-amber-500"
      />
      <label htmlFor="apply_retroactively_check" className="text-[11px] text-slate-300 cursor-pointer">
        Apply immediately to historical transactions matching this rule
      </label>
    </div>

    <div className="flex items-center justify-end space-x-2 pt-2 border-t border-border/50">
      <Button variant="outline" size="xs" onClick={onCancel} type="button">Cancel</Button>
      <Button
        variant="primary"
        size="xs"
        type="submit"
        disabled={saving}
        data-testid="save-rule-btn"
        icon={saving ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
      >
        {isEditing ? 'Update Rule' : 'Save Rule'}
      </Button>
    </div>
  </>
);

/**
 * Form for creating or updating an Outlook-style transaction categorization rule.
 */
export const RuleEditorForm: React.FC<RuleEditorFormProps> = ({
  draft,
  accounts,
  loans,
  isEditing,
  saving,
  onChange,
  onSubmit,
  onCancel,
}) => {
  const { categoryNames } = useCategories();
  const selectableCategories =
    !draft.targetCategory || categoryNames.includes(draft.targetCategory)
      ? categoryNames
      : [draft.targetCategory, ...categoryNames];
  const selectableAccounts = accounts.filter((acc) => acc.is_active || String(acc.id) === draft.counterpartAccountId);
  const selectableLoans = loans.filter((loan) => loan.is_active || String(loan.id) === draft.loanId);
  const showLoanTarget = draft.targetCategory.trim().toLowerCase() === 'debt & loans' || Boolean(draft.loanId);
  const updateField: UpdateFieldFn = (key, value) => onChange((prev) => ({ ...prev, [key]: value }));

  return (
    <form onSubmit={onSubmit} className="p-3 bg-card/80 border border-amber-500/40 rounded-xl space-y-2.5 animate-in fade-in">
      <div className="flex items-center justify-between border-b border-border/60 pb-2">
        <span className="text-xs font-semibold text-amber-300 flex items-center space-x-1.5">
          <SlidersHorizontal className="w-3.5 h-3.5" />
          <span>{isEditing ? 'Edit Rule' : 'Create Outlook-Style Rule'}</span>
        </span>
        <button type="button" onClick={onCancel} className="text-[11px] text-slate-400 hover:text-slate-200">
          Cancel
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <RuleMatcherFields draft={draft} updateField={updateField} />
        <RuleActionFields
          draft={draft}
          selectableCategories={selectableCategories}
          updateField={updateField}
          onCategoryChange={(nextCategory) =>
            onChange((prev) => ({
              ...prev,
              targetCategory: nextCategory,
              loanId: nextCategory.trim().toLowerCase() === 'debt & loans' ? prev.loanId : '',
            }))
          }
        />
        <RuleTargetAccountFields
          draft={draft}
          selectableAccounts={selectableAccounts}
          selectableLoans={selectableLoans}
          showLoanTarget={showLoanTarget}
          updateField={updateField}
        />
      </div>

      <RuleEditorFooter
        applyRetroactively={draft.applyRetroactively}
        isEditing={isEditing}
        saving={saving}
        onToggleRetroactive={(checked) => updateField('applyRetroactively', checked)}
        onCancel={onCancel}
      />
    </form>
  );
};
