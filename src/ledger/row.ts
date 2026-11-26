import { isTransferCategory } from '../taxonomy';
import { Account, LoanItem, LoanType, Transaction, TransactionSplitItem } from '../types';
import { formatMoney, getTransactionNzdAmount } from '../utils/format';
import {
  areLegacyPositiveOutflowSplits,
  getSplitPrecision,
  hasValidSplitLines,
  isDebtLoansCategory,
  resolveParentTransactionAmount,
} from './splits';

const RECURRENCE_UNIT_LABELS: Record<string, string> = {
  annual: 'yr',
  quarterly: 'qtr',
  monthly: 'mo',
  fortnightly: '2w',
  weekly: 'wk',
};

export interface EffectiveTransactionSplit extends TransactionSplitItem {
  signedAmount: number;
}

export interface SplitLoanEntry {
  key: string;
  loanName: string;
  loanType: LoanType;
  paymentAmount: number;
  flowSignAmt: number;
}

export interface RowMeta {
  amt: number;
  isDebit: boolean;
  txCurrency: string;
  parentAmt: number;
  isTransfer: boolean;
  isAmortized: boolean;
  isExcluded: boolean;
  hasLinkedTransfer: boolean;
  isSplit: boolean;
  effectiveSplits: EffectiveTransactionSplit[];
  showLoanSelector: boolean;
  splitLoanEntries: SplitLoanEntry[];
}

/**
 * Ensures the transaction's assigned category remains selectable even when absent
 * from the active spending categories list (e.g. non-expense inflow categories).
 */
export function buildCategoryOptions(
  categories: readonly string[],
  currentCategory: string
): readonly string[] {
  const trimmed = (currentCategory || '').trim();
  if (!trimmed || categories.includes(trimmed)) {
    return categories;
  }
  return [trimmed, ...categories];
}

/**
 * Formats a recurrence key into a title-cased display label.
 */
export function formatRecurrenceLabel(recurrence?: string | null): string {
  const normalized = (recurrence || '').trim().toLowerCase();
  if (!normalized) return 'Recurring';
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

/**
 * Builds the origin cycle summary line for an amortized recurring commitment row.
 */
export function buildAmortizedOriginSummary(
  tx: Transaction,
  txCurrency: string,
  amt: number
): string {
  const originUnit =
    RECURRENCE_UNIT_LABELS[(tx.recurrence || '').trim().toLowerCase()] || 'cycle';
  if (txCurrency.toUpperCase() !== 'NZD') {
    const nzd = formatMoney(getTransactionNzdAmount(tx), {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return `From ${txCurrency.toUpperCase()} ${Math.abs(amt).toFixed(2)} (${nzd} NZD/${originUnit})`;
  }
  const nzd = formatMoney(Math.abs(amt), {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `From ${nzd} NZD/${originUnit}`;
}

/**
 * Formats an FX exchange rate with adaptive precision for badge titles and labels.
 */
export function formatFxRateLabel(exchangeRate: number): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: exchangeRate >= 100 ? 2 : 0,
    maximumFractionDigits: exchangeRate >= 100 ? 2 : 6,
  }).format(exchangeRate);
}

/**
 * Derives display-ready loan flow entries from signed split lines.
 */
export function deriveSplitLoanEntries(
  effectiveSplits: Array<{
    id: number;
    signedAmount: number;
    loan_id?: number | null;
    loan_name?: string | null;
    loan_type?: LoanType | null;
  }>,
  loans?: LoanItem[]
): SplitLoanEntry[] {
  return effectiveSplits
    .map((s) => {
      const matchedLoan =
        s.loan_id != null ? loans?.find((l) => l.id === s.loan_id) : undefined;
      const resolvedName = s.loan_name || matchedLoan?.name || null;
      const resolvedType = s.loan_type || matchedLoan?.loan_type || 'borrowed';
      if (s.loan_id == null || !resolvedName) return null;
      return {
        key: `split-${s.id}`,
        loanName: resolvedName,
        loanType: resolvedType,
        paymentAmount: Math.abs(s.signedAmount),
        flowSignAmt: s.signedAmount,
      };
    })
    .filter((entry): entry is SplitLoanEntry => entry !== null);
}

/**
 * Computes derived ledger flags, normalized split lines, and loan flow metadata for a row.
 */
export function deriveRowMeta(
  tx: Transaction,
  loans?: LoanItem[],
  fallbackCurrency?: string
): RowMeta {
  const amt = Number(tx.amount);
  const txCurrency = tx.currency || fallbackCurrency || 'NZD';
  const { decimals } = getSplitPrecision(txCurrency);
  const isAmortized = Boolean(
    tx.is_amortized_commitment && tx.amortized_period_amount_nzd != null
  );
  const hasLinkedTransfer = tx.linked_transaction_id != null;
  const isSplit = hasValidSplitLines(tx);
  const legacyPositive = areLegacyPositiveOutflowSplits(tx);
  const effectiveSplits: EffectiveTransactionSplit[] = isSplit
    ? (tx.splits || []).map((s) => ({
        ...s,
        signedAmount: legacyPositive ? -Math.abs(Number(s.amount)) : Number(s.amount),
      }))
    : [];
  const showLoanSelector = Boolean(
    !isSplit &&
      loans &&
      loans.length > 0 &&
      !hasLinkedTransfer &&
      (isDebtLoansCategory(tx.category || '') || tx.loan_id != null)
  );
  return {
    amt,
    isDebit: amt < 0,
    txCurrency,
    parentAmt: resolveParentTransactionAmount(tx, decimals),
    isTransfer: isTransferCategory(tx.category, tx),
    isAmortized,
    isExcluded: Boolean(tx.excluded_from_period_budget && !isAmortized),
    hasLinkedTransfer,
    isSplit,
    effectiveSplits,
    showLoanSelector,
    splitLoanEntries: isSplit ? deriveSplitLoanEntries(effectiveSplits, loans) : [],
  };
}

/**
 * Returns active accounts (plus any currently linked counterpart) eligible as counterpart accounts.
 */
export function getSelectableCounterparts(
  tx: Transaction,
  accounts?: Account[]
): Account[] {
  if (!accounts || accounts.length === 0) return [];
  return accounts.filter(
    (acc) => acc.id !== tx.account_id && (acc.is_active || acc.id === tx.counterpart_account_id)
  );
}
