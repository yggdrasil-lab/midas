import { LoanItem, Transaction, TransactionSplitInput } from '../types';
import { isCryptoCurrency } from '../utils/format';
import { parseTagsCsv } from './tags';

export interface SplitPrecision {
  decimals: number;
  tolerance: number;
}

export interface SplitDraftRow {
  sign: 1 | -1;
  amount: string;
  category: string;
  loanId: string;
  notes: string;
  tagsText: string;
}

export interface SplitAllocationSummary {
  allocatedSum: number;
  remaining: number;
  isBalanced: boolean;
  validRowsCount: number;
  hasInvalidRows: boolean;
  isReadyToSave: boolean;
}

export interface AutoRemainderOptions {
  txAmount: number;
  decimals: number;
  defaultSign: 1 | -1;
  row2ManuallyEdited: boolean;
  loans: LoanItem[];
}

export interface ParsedSignedAmountInput {
  explicitSign: 1 | -1 | null;
  cleanAmount: string;
}

/**
 * Returns decimal precision and balance tolerance for fiat vs crypto split amounts.
 */
export function getSplitPrecision(currency?: string | null): SplitPrecision {
  if (isCryptoCurrency(currency)) {
    return { decimals: 8, tolerance: 1e-8 };
  }
  return { decimals: 2, tolerance: 0.01 };
}

/**
 * Rounds a numeric value to the specified decimal precision.
 */
export function roundToDecimals(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

/**
 * Returns true when a transaction has two or more persisted split lines.
 */
export function hasValidSplitLines(tx: Transaction): boolean {
  return Boolean(tx.is_split && tx.splits && tx.splits.length >= 2);
}

/**
 * Detects legacy outflow splits that stored all-positive line amounts summing
 * to the absolute value of a negative parent transaction.
 */
export function areLegacyPositiveOutflowSplits(tx: Transaction): boolean {
  const splits = tx.splits || [];
  if (Number(tx.amount) >= 0 || splits.length < 2) {
    return false;
  }
  const allPositive = splits.every((s) => Number(s.amount) > 0);
  if (!allPositive) {
    return false;
  }
  const { tolerance } = getSplitPrecision(tx.currency);
  const absSum = splits.reduce((sum, s) => sum + Number(s.amount), 0);
  return Math.abs(absSum - Math.abs(Number(tx.amount))) <= tolerance;
}

/**
 * Resolves the true signed parent bank amount for a transaction, reconstructing
 * it from the full splits list when a category or tag endpoint returns a sliced
 * tx.amount.
 */
export function resolveParentTransactionAmount(
  tx: Transaction,
  decimals: number
): number {
  if (hasValidSplitLines(tx)) {
    if (areLegacyPositiveOutflowSplits(tx)) {
      return Number(tx.amount);
    }
    const splitsSum = (tx.splits || []).reduce(
      (sum, s) => sum + Number(s.amount),
      0
    );
    return roundToDecimals(splitsSum, decimals);
  }
  return Number(tx.amount);
}

/**
 * Returns true when a category name targets the Debt & Loans tracking bucket.
 */
export function isDebtLoansCategory(category: string): boolean {
  return category.trim().toLowerCase() === 'debt & loans';
}

/**
 * Builds initial draft split rows from an existing split transaction or two blank lines.
 */
export function createInitialSplitRows(
  tx: Transaction,
  defaultCategory: string,
  decimals: number
): SplitDraftRow[] {
  const defaultSign: 1 | -1 =
    resolveParentTransactionAmount(tx, decimals) >= 0 ? 1 : -1;
  if (hasValidSplitLines(tx)) {
    const forceNegative = areLegacyPositiveOutflowSplits(tx);
    return tx.splits!.map((s) => ({
      sign: forceNegative ? -1 : Number(s.amount) >= 0 ? 1 : -1,
      amount: Math.abs(Number(s.amount)).toFixed(decimals),
      category: s.category || defaultCategory,
      loanId: s.loan_id != null ? String(s.loan_id) : '',
      notes: s.notes || '',
      tagsText: (s.tags || []).join(', '),
    }));
  }
  const baseCat = tx.category || defaultCategory;
  return [
    {
      sign: defaultSign,
      amount: '',
      category: baseCat,
      loanId: isDebtLoansCategory(baseCat) && tx.loan_id != null ? String(tx.loan_id) : '',
      notes: '',
      tagsText: '',
    },
    {
      sign: defaultSign,
      amount: '',
      category: baseCat,
      loanId: '',
      notes: '',
      tagsText: '',
    },
  ];
}

/**
 * Computes signed-netted allocation totals, remainder, and save readiness across draft rows.
 */
export function computeSplitAllocation(
  rows: SplitDraftRow[],
  txAmount: number,
  precision: SplitPrecision
): SplitAllocationSummary {
  const parsedSignedAmounts = rows.map((r) => {
    const n = parseFloat(r.amount);
    return Number.isFinite(n) && n > 0 ? r.sign * n : 0;
  });
  const allocatedSum = roundToDecimals(
    parsedSignedAmounts.reduce((sum, val) => sum + val, 0),
    precision.decimals
  );
  const remaining = roundToDecimals(txAmount - allocatedSum, precision.decimals);
  const isBalanced = Math.abs(remaining) <= precision.tolerance;
  const validRowsCount = rows.filter((r) => {
    const n = parseFloat(r.amount);
    return Number.isFinite(n) && n > 0 && r.category.trim().length > 0;
  }).length;
  const hasInvalidRows = validRowsCount < rows.length;
  const isReadyToSave = isBalanced && rows.length >= 2 && !hasInvalidRows;

  return {
    allocatedSum,
    remaining,
    isBalanced,
    validRowsCount,
    hasInvalidRows,
    isReadyToSave,
  };
}

/**
 * Filters selectable loans by active status and sign direction (inflows permit lent loans only).
 */
export function getFilteredLoans(
  loans: LoanItem[],
  rowSign: 1 | -1,
  currentLoanId: string
): LoanItem[] {
  return loans.filter((loan) => {
    if (!loan.is_active && String(loan.id) !== currentLoanId) return false;
    if (rowSign > 0) {
      return loan.loan_type === 'lent' || String(loan.id) === currentLoanId;
    }
    return true;
  });
}

/**
 * Clears an incompatible borrowed loan selection when a line switches to an inflow (+).
 */
export function resolveLoanIdForSign(
  loans: LoanItem[],
  nextSign: 1 | -1,
  currentLoanId: string
): string {
  if (!currentLoanId || nextSign < 0) return currentLoanId;
  const matched = loans.find((l) => String(l.id) === currentLoanId);
  if (matched && matched.loan_type !== 'lent') {
    return '';
  }
  return currentLoanId;
}

/**
 * Auto-populates Row 2 with the signed remainder when editing Row 1 on a two-row draft.
 */
export function applyAutoRemainder(
  rows: SplitDraftRow[],
  opts: AutoRemainderOptions
): SplitDraftRow[] {
  if (opts.row2ManuallyEdited || rows.length !== 2) {
    return rows;
  }
  const [row0, row1] = rows;
  const trimmed = row0.amount.trim();
  if (!trimmed) {
    return [
      row0,
      {
        ...row1,
        sign: opts.defaultSign,
        amount: '',
        loanId: resolveLoanIdForSign(opts.loans, opts.defaultSign, row1.loanId),
      },
    ];
  }
  const parsed = parseFloat(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return rows;
  }
  const remainder = roundToDecimals(opts.txAmount - row0.sign * parsed, opts.decimals);
  const nextSign: 1 | -1 = remainder < 0 ? -1 : remainder > 0 ? 1 : opts.defaultSign;
  return [
    row0,
    {
      ...row1,
      sign: nextSign,
      amount: Math.abs(remainder).toFixed(opts.decimals),
      loanId: resolveLoanIdForSign(opts.loans, nextSign, row1.loanId),
    },
  ];
}

/**
 * Parses an inline signed decimal string (+/- prefix) and rejects non-numeric edits.
 */
export function parseSignedAmountInput(rawValue: string): ParsedSignedAmountInput | null {
  let explicitSign: 1 | -1 | null = null;
  let cleanAmount = rawValue;
  if (rawValue.startsWith('-')) {
    explicitSign = -1;
    cleanAmount = rawValue.slice(1);
  } else if (rawValue.startsWith('+')) {
    explicitSign = 1;
    cleanAmount = rawValue.slice(1);
  }
  if (cleanAmount !== '' && !/^\d*\.?\d*$/.test(cleanAmount)) {
    return null;
  }
  return { explicitSign, cleanAmount };
}

/**
 * Serializes validated draft rows into the API split payload format.
 */
export function buildSplitPayload(
  rows: SplitDraftRow[],
  decimals: number
): TransactionSplitInput[] {
  return rows.map((r) => {
    const parsedAmt = roundToDecimals(r.sign * parseFloat(r.amount), decimals);
    const loanId =
      isDebtLoansCategory(r.category) && r.loanId.trim()
        ? Number(r.loanId)
        : null;
    return {
      amount: parsedAmt,
      category: r.category.trim(),
      tags: parseTagsCsv(r.tagsText),
      loan_id: loanId,
      notes: r.notes.trim() ? r.notes.trim() : null,
    };
  });
}
