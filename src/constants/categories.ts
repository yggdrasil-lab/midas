import { SegmentedControlOption } from '@yggdrasil-lab/ui';
import { Account, PeriodType, RecurrenceType, Transaction } from '../types';

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

/** Canonical transaction and rule categories across Midas. */
export const CATEGORY_CHOICES = [
  'Groceries',
  'Food',
  'Transport',
  'Vehicle',
  'Utilities',
  'Health',
  'Personal Care',
  'Supplements',
  'Clothing',
  'Tech',
  'Household',
  'Shopping',
  'Leisure',
  'Insurance',
  'Travel',
  'Housing',
  'Family',
  'Transfers',
  'Income',
  'General',
] as const;

/** OOP-style category inheritance: subclass -> base class. */
export const CATEGORY_PARENTS: Record<string, string> = {
  Groceries: 'Food',
  Supplements: 'Health',
  'Personal Care': 'Health',
  Vehicle: 'Transport',
  Household: 'Housing',
  Clothing: 'Shopping',
  Tech: 'Shopping',
};

/** Expense categories eligible for budget guardrail targets. */
export const BUDGET_CATEGORY_CHOICES = CATEGORY_CHOICES.filter(
  (category) => category !== 'Transfers' && category !== 'Income'
);

/** Default categories displayed in the Quick Log expense keypad modal. */
export const QUICK_LOG_CATEGORIES = [
  'Food',
  'Coffee',
  'Groceries',
  'Transport',
  'Tech',
  'Health',
  'Leisure',
  'Utilities',
];

/** Shared time-period selector options for inspection modals and dashboards. */
export const PERIOD_OPTIONS: SegmentedControlOption<PeriodType>[] = [
  { id: 'week', label: 'This Week' },
  { id: 'last_week', label: 'Last Week' },
  { id: 'month', label: 'This Month' },
  { id: 'last_month', label: 'Last Month' },
  { id: 'all', label: 'All Time' },
];

/** Known financial institutions for statement ingestion autocomplete. */
export const COMMON_INSTITUTIONS = [
  'ANZ',
  'ASB',
  'BNZ',
  'Westpac',
  'Kiwibank',
  'Rabobank',
  'TSB',
  'Sharesies',
  'Simplicity',
  'Kernel',
  'Milford',
  'InvestNow',
  'Hatch',
  'Interactive Brokers',
  'DBS Bank',
  'BDO Unibank',
  'BPI',
  'Wise',
] as const;

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
export const ACCOUNT_TYPE_OPTIONS: Array<{ value: Account['account_type']; label: string }> = [
  { value: 'checking', label: 'Checking (Everyday)' },
  { value: 'savings', label: 'Savings (Interest / Cash Floor)' },
  { value: 'brokerage', label: 'Brokerage (Equities / Growth)' },
  { value: 'kiwisaver', label: 'KiwiSaver (Pension / Locked)' },
  { value: 'crypto', label: 'Crypto' },
  { value: 'credit_card', label: 'Credit Card' },
];

/** Metadata describing the three financial freedom tiers. */
export const ACCOUNT_TIER_META: Record<
  Account['tier'],
  {
    shortLabel: string;
    sectionTitle: string;
    sectionDescription: string;
    cardVariant: 'blue' | 'emerald' | 'amber';
    badgeVariant: 'info' | 'success' | 'warning';
    totalTextColor: string;
    iconBgClass: string;
  }
> = {
  cash: {
    shortLabel: 'Cash Floor',
    sectionTitle: 'Tier 1: Cash Floor (Liquid Reserves)',
    sectionDescription: 'Checking accounts and emergency cash covering immediate living expenses',
    cardVariant: 'blue',
    badgeVariant: 'info',
    totalTextColor: 'text-sky-300',
    iconBgClass: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
  },
  growth: {
    shortLabel: 'Growth',
    sectionTitle: 'Tier 2: Growth Assets (Compounding Investments)',
    sectionDescription: 'Brokerage, index funds, stocks, and crypto generating compounding returns',
    cardVariant: 'emerald',
    badgeVariant: 'success',
    totalTextColor: 'text-emerald-300',
    iconBgClass: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  },
  locked: {
    shortLabel: 'Locked',
    sectionTitle: 'Tier 3: Locked Reserve (Preserved Capital)',
    sectionDescription: 'KiwiSaver and restricted retirement funds preserved until maturity',
    cardVariant: 'amber',
    badgeVariant: 'warning',
    totalTextColor: 'text-amber-300',
    iconBgClass: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  },
};

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
