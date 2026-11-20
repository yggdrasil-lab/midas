import type { StatusBadgeVariant } from '@yggdrasil-lab/ui';
import type { Receipt } from '../types';
import { formatMoney } from './format';

export type ReceiptFeedFilter = 'all' | 'pending' | 'needs_review' | 'matched';

/**
 * Formats a receipt or candidate amount cleanly with currency awareness.
 * NZD amounts render with standard `$xx.xx`, while foreign currencies show `CODE xx.xx`.
 */
export function formatReceiptAmount(
  amount: number,
  currency?: string | null
): string {
  const code = (currency || 'NZD').trim().toUpperCase();
  if (code === 'NZD') {
    return formatMoney(Number(amount), {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }
  return formatMoney(Number(amount), {
    currency: `${code} `,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Formats a bank ledger transaction amount for cross-currency candidate comparisons.
 * Always displays the currency suffix for NZD (`$195.40 NZD`) and `CODE xx.xx` for foreign accounts.
 */
export function formatCandidateLedgerAmount(
  amount: number,
  currency?: string | null
): string {
  const code = (currency || 'NZD').trim().toUpperCase();
  const absAmount = Math.abs(Number(amount) || 0);
  if (code === 'NZD') {
    return `${formatMoney(absAmount, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} NZD`;
  }
  return formatReceiptAmount(absAmount, code);
}

/**
 * Maps receipt workflow statuses to StatusBadge labels and visual variants.
 */
export function getReceiptStatusMeta(
  status: Receipt['status']
): { label: string; variant: StatusBadgeVariant } {
  switch (status) {
    case 'matched':
    case 'verified':
      return { label: 'Matched to Ledger', variant: 'success' };
    case 'needs_review':
      return { label: 'Needs Review', variant: 'warning' };
    case 'unlinked':
    default:
      return { label: 'Unlinked', variant: 'idle' };
  }
}

/**
 * Returns true when a receipt is still awaiting ledger reconciliation.
 */
export function isReceiptPending(
  receipt: Pick<Receipt, 'status'>
): boolean {
  return receipt.status === 'needs_review' || receipt.status === 'unlinked';
}

/**
 * Converts a 0..1 float (or 0..100 integer) confidence score into a clamped percentage string.
 */
export function formatConfidencePercent(confidence: number): string {
  const numeric = Number(confidence);
  if (!Number.isFinite(numeric)) return '0%';
  const pct = numeric <= 1 ? Math.round(numeric * 100) : Math.round(numeric);
  return `${Math.max(0, Math.min(100, pct))}%`;
}
