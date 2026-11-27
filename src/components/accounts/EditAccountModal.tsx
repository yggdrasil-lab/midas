import React, { useEffect, useState } from 'react';
import { AlertBanner, Button, FormField, Modal, SelectInput, TextInput } from '@yggdrasil-lab/ui';
import { ACCOUNT_TYPE_OPTIONS, isRevolvingCreditAccount } from '../../taxonomy';
import { updateAccount } from '../../transport';
import { Account, AccountType, AccountUpdatePayload } from '../../types';

interface EditAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  account: Account | null;
  onSaved: (updated: Account) => Promise<void> | void;
}

const TIER_OPTIONS: Array<{ value: Account['tier']; label: string }> = [
  { value: 'cash', label: 'Tier 1: Cash Floor' },
  { value: 'growth', label: 'Tier 2: Growth' },
  { value: 'locked', label: 'Tier 3: Locked' },
];

function parseCreditLimitInput(rawValue: string): { valid: boolean; value: number | null; error?: string } {
  const trimmed = rawValue.trim();
  if (!trimmed) return { valid: true, value: null };
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return { valid: false, value: null, error: 'Credit limit must be a positive number greater than 0.' };
  }
  return { valid: true, value: parsed };
}

function buildUpdatePayload(opts: {
  name: string;
  accountType: AccountType;
  tier: Account['tier'];
  creditLimit: string;
  isActive: boolean;
}): { payload?: AccountUpdatePayload; error?: string } {
  const trimmedName = opts.name.trim();
  if (!trimmedName) return { error: 'Account name is required.' };
  const showLimit = isRevolvingCreditAccount(opts.accountType);
  const parsedLimit = showLimit ? parseCreditLimitInput(opts.creditLimit) : null;
  if (parsedLimit && !parsedLimit.valid) {
    return { error: parsedLimit.error ?? 'Invalid credit limit.' };
  }
  return {
    payload: {
      name: trimmedName,
      account_type: opts.accountType,
      tier: opts.tier,
      is_active: opts.isActive,
      ...(parsedLimit ? { credit_limit: parsedLimit.value } : {}),
    },
  };
}

function useEditAccountForm(opts: EditAccountModalProps) {
  const { isOpen, onClose, account, onSaved } = opts;
  const [name, setName] = useState('');
  const [accountType, setAccountType] = useState<AccountType>('checking');
  const [tier, setTier] = useState<Account['tier']>('cash');
  const [creditLimit, setCreditLimit] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !account) return;
    setName(account.name);
    setAccountType(account.account_type);
    setTier(account.tier);
    setCreditLimit(account.credit_limit != null ? String(account.credit_limit) : '');
    setIsActive(account.is_active);
    setError(null);
  }, [isOpen, account]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!account) return;
    const built = buildUpdatePayload({ name, accountType, tier, creditLimit, isActive });
    if (!built.payload) {
      setError(built.error ?? 'Invalid account details.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const updated = await updateAccount(account.id, built.payload);
      await onSaved(updated);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update account.');
    } finally {
      setSaving(false);
    }
  };

  return {
    name, setName, accountType, setAccountType, tier, setTier,
    creditLimit, setCreditLimit, isActive, setIsActive,
    showCreditLimit: isRevolvingCreditAccount(accountType),
    saving, error, handleSubmit,
  };
}

const EditAccountFields: React.FC<{
  form: ReturnType<typeof useEditAccountForm>;
  currency: string;
}> = ({ form, currency }) => (
  <>
    <FormField label="Account Name" required>
      <TextInput type="text" value={form.name} onChange={(e) => form.setName(e.target.value)} variant="brand" data-testid="edit-account-name-input" required />
    </FormField>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <FormField label="Account Type">
        <SelectInput value={form.accountType} onChange={(e) => form.setAccountType(e.target.value as AccountType)} options={ACCOUNT_TYPE_OPTIONS} variant="brand" data-testid="edit-account-type-select" />
      </FormField>
      <FormField label="Freedom Tier">
        <SelectInput value={form.tier} onChange={(e) => form.setTier(e.target.value as Account['tier'])} options={TIER_OPTIONS} variant="brand" data-testid="edit-account-tier-select" />
      </FormField>
    </div>
    {form.showCreditLimit && (
      <FormField label={`Credit Limit (${currency})`} hint="Leave blank to clear the credit limit.">
        <TextInput type="number" step="0.01" value={form.creditLimit} onChange={(e) => form.setCreditLimit(e.target.value)} placeholder="e.g. 10000" variant="brand" className="font-mono" data-testid="edit-account-credit-limit-input" />
      </FormField>
    )}
    <label className="flex items-center gap-2.5 text-xs text-slate-200 cursor-pointer select-none pt-1">
      <input type="checkbox" checked={form.isActive} onChange={(e) => form.setIsActive(e.target.checked)} className="h-4 w-4 rounded border-border bg-background text-amber-500 focus:ring-amber-500/40" data-testid="edit-account-active-checkbox" />
      <span>Account is active in portfolio and backstop calculations</span>
    </label>
  </>
);

/**
 * Modal for editing account classification, tier, active status, and revolving credit limit.
 */
export const EditAccountModal: React.FC<EditAccountModalProps> = (props) => {
  const f = useEditAccountForm(props);
  const { isOpen, onClose, account } = props;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={account ? `Edit Account: ${account.name}` : 'Edit Account'}
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onClose} data-testid="edit-account-cancel-btn">Cancel</Button>
          <Button type="submit" form="edit-account-form" variant="brand" size="sm" loading={f.saving} data-testid="edit-account-save-btn">Save Changes</Button>
        </div>
      }
    >
      <form id="edit-account-form" onSubmit={(e) => void f.handleSubmit(e)} className="space-y-4 pt-1" data-testid="edit-account-modal">
        {Boolean(f.error) && <AlertBanner variant="error" data-testid="edit-account-error">{f.error}</AlertBanner>}
        <EditAccountFields form={f} currency={account?.currency || 'NZD'} />
      </form>
    </Modal>
  );
};
