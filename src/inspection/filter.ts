import { buildAmortizedOriginSummary, formatRecurrenceLabel } from '../ledger';
import { Transaction, TransactionSplitItem } from '../types';
import { collapsePairedTransfers } from '../utils/transfers';

/**
 * Normalizes a free-text inspection search query (trim, lowercase, strip leading #).
 */
export function normalizeInspectionSearchQuery(query: string): string {
  return query.trim().toLowerCase().replace(/^#+/, '');
}

function includesNormalized(value: string | null | undefined, needle: string): boolean {
  return Boolean(value && value.toLowerCase().includes(needle));
}

function matchesSplitSearch(split: TransactionSplitItem, needle: string): boolean {
  if (
    includesNormalized(split.category, needle) ||
    includesNormalized(split.loan_name, needle) ||
    includesNormalized(split.notes, needle)
  ) {
    return true;
  }
  return (split.tags || []).some((tag) => includesNormalized(tag, needle));
}

function matchesRecurrenceSearch(tx: Transaction, needle: string): boolean {
  if (tx.recurrence) {
    if (
      includesNormalized(tx.recurrence, needle) ||
      includesNormalized(formatRecurrenceLabel(tx.recurrence), needle)
    ) {
      return true;
    }
  }
  if (!tx.is_amortized_commitment) return false;
  const origin = buildAmortizedOriginSummary(tx, tx.currency || 'NZD', Number(tx.amount));
  return includesNormalized(origin, needle);
}

/**
 * Unified split-aware substring search across all 4 inspection scopes
 * (account, cashflow, category, tag). Matches merchant, category, description,
 * notes, tags, accounts, loan name, recurrence/amortized origin, and splits[].
 */
export function matchesInspectionSearch(tx: Transaction, query: string): boolean {
  const needle = normalizeInspectionSearchQuery(query);
  if (!needle) return true;

  const directMatch =
    includesNormalized(tx.merchant, needle) ||
    includesNormalized(tx.category, needle) ||
    includesNormalized(tx.raw_description, needle) ||
    includesNormalized(tx.notes, needle) ||
    includesNormalized(tx.account_name, needle) ||
    includesNormalized(tx.linked_account_name, needle) ||
    includesNormalized(tx.counterpart_account_name, needle) ||
    includesNormalized(tx.loan_name, needle);

  if (directMatch || matchesRecurrenceSearch(tx, needle)) return true;
  if ((tx.tags || []).some((tag) => includesNormalized(tag, needle))) return true;
  return (tx.splits || []).some((split) => matchesSplitSearch(split, needle));
}

/**
 * Checks whether a transaction (or any of its split lines) matches a category filter.
 */
export function matchesInspectionCategory(
  tx: Transaction,
  categoryFilter: string | null
): boolean {
  if (!categoryFilter) return true;
  const target = categoryFilter.toLowerCase();
  if ((tx.category || '').toLowerCase() === target) return true;
  return (tx.splits || []).some((split) => split.category.toLowerCase() === target);
}

/**
 * Filters account inspection transactions by optional category (parent or split)
 * and unified split-aware search query.
 */
export function filterAccountTransactions(
  collapsed: Transaction[],
  categoryFilter: string | null,
  searchQuery: string
): Transaction[] {
  return collapsed.filter(
    (tx) =>
      matchesInspectionCategory(tx, categoryFilter) &&
      matchesInspectionSearch(tx, searchQuery)
  );
}

/**
 * Filters tag inspection transactions by selected category pill (or 'ALL')
 * and unified split-aware search query.
 */
export function filterTagTransactions(
  collapsed: Transaction[],
  selectedCategory: string,
  searchQuery: string
): Transaction[] {
  const target = selectedCategory === 'ALL' ? null : selectedCategory.toLowerCase();
  return collapsed.filter((tx) => {
    if (target) {
      const parentCategory = (tx.category || 'General').toLowerCase();
      const splitMatch = (tx.splits || []).some(
        (split) => split.category.toLowerCase() === target
      );
      if (parentCategory !== target && !splitMatch) return false;
    }
    return matchesInspectionSearch(tx, searchQuery);
  });
}

/**
 * Collapses paired transfer legs once at the inspection pipeline boundary so
 * downstream TransactionList renders can skip redundant collapse passes.
 */
export function collapseInspectionTransfers(transactions: Transaction[]): Transaction[] {
  return collapsePairedTransfers(transactions);
}
