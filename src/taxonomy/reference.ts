import { SegmentedControlOption } from '@yggdrasil-lab/ui';
import { AccountType, PeriodType, RecurrenceType, Transaction } from '../types';

/** Recurrence frequency options for amortized weekly budget and runway burn. */
export const RECURRENCE_OPTIONS: ReadonlyArray<{
  value: RecurrenceType | '';
  label: string;
}> = [
  { value: '', label: 'Variable' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'fortnightly', label: 'Fortnightly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'annual', label: 'Annual' },
  { value: 'one-off', label: 'One-off' },
];

/** Shared time-period selector options for inspection modals and dashboards. */
export const PERIOD_OPTIONS: SegmentedControlOption<PeriodType>[] = [
  { id: 'week', label: 'This Week' },
  { id: 'last_week', label: 'Last Week' },
  { id: 'month', label: 'This Month' },
  { id: 'last_month', label: 'Last Month' },
  { id: 'all', label: 'All Time' },
];

/** Common ISO 4217 currency codes supported across portfolio accounts. */
export const COMMON_CURRENCIES = [
  'NZD',
  'SGD',
  'USD',
  'AUD',
  'PHP',
  'EUR',
  'GBP',
  'JPY',
  'HKD',
  'CAD',
] as const;

/** Account type selector options for statement ingestion and account creation. */
export const ACCOUNT_TYPE_OPTIONS: Array<{ value: AccountType; label: string }> = [
  { value: 'checking', label: 'Checking (Everyday)' },
  { value: 'savings', label: 'Savings (Interest / Cash Floor)' },
  { value: 'brokerage', label: 'Brokerage (Equities / Growth)' },
  { value: 'kiwisaver', label: 'KiwiSaver (Pension / Locked)' },
  { value: 'private_note', label: 'Private Note' },
  { value: 'crypto', label: 'Crypto' },
  { value: 'credit_card', label: 'Credit Card' },
  { value: 'credit_line', label: 'Credit Line (Revolving / No Grace Period)' },
];

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  checking: 'Checking',
  savings: 'Savings',
  brokerage: 'Brokerage',
  kiwisaver: 'KiwiSaver',
  private_note: 'Private Note',
  crypto: 'Crypto',
  credit_card: 'Credit Card',
  credit_line: 'Credit Line',
};

/** Returns true if an account_type represents a revolving credit facility. */
export function isRevolvingCreditAccount(accountType?: string | null): boolean {
  const normalized = (accountType || '').trim().toLowerCase();
  return normalized === 'credit_card' || normalized === 'credit_line';
}

/** Formats an account_type enum (including snake_case values) for display. */
export function formatAccountTypeLabel(accountType?: string | null): string {
  const normalized = (accountType || '').trim().toLowerCase();
  if (!normalized) return 'Account';
  if (ACCOUNT_TYPE_LABELS[normalized]) return ACCOUNT_TYPE_LABELS[normalized];
  return normalized
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

/** Returns true if a transaction represents an internal account transfer. */
export function isTransferCategory(category: string, tx?: Transaction): boolean {
  const lower = (category || '').toLowerCase();
  return lower === 'transfer' || lower === 'transfers' || Boolean(tx?.linked_transaction_id);
}

/** Formats a period enum into a human-readable label. */
export function formatPeriodLabel(period: PeriodType, startDate?: string, endDate?: string): string {
  if (period === 'annual') {
    return 'Trailing 52 Weeks (365d)';
  }
  if (period === 'all') {
    return 'All Time';
  }
  if (period === 'custom') {
    if (startDate && endDate) return `${startDate} to ${endDate}`;
    return 'Custom Range';
  }
  const found = PERIOD_OPTIONS.find((opt) => opt.id === period);
  return found ? found.label : 'This Month';
}
