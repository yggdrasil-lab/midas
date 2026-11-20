import { Transaction } from '../types';

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
  const absSum = splits.reduce((sum, s) => sum + Number(s.amount), 0);
  return Math.abs(absSum - Math.abs(Number(tx.amount))) <= 0.01;
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
