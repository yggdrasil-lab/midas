import type { StatusBadgeVariant } from '@yggdrasil-lab/ui';
import type { Receipt } from '../types';
import { formatMoney } from './format';

export type ReceiptFeedFilter = 'all' | 'pending' | 'needs_review' | 'matched';

/**
 * Returns true when the receipt document discriminator marks a payroll payslip.
 */
export function isPayslipDocument(docType?: string | null): boolean {
  return docType === 'payslip';
}

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
 * Positive inflows keep a leading `+` prefix (`+$4,250.50 NZD`, `+AUD 500.00`), while
 * negative and zero amounts preserve unsigned currency formatting (`$195.40 NZD`).
 */
export function formatCandidateLedgerAmount(
  amount: number,
  currency?: string | null
): string {
  const code = (currency || 'NZD').trim().toUpperCase();
  const numeric = Number(amount);
  const safeNumeric = Number.isFinite(numeric) ? numeric : 0;
  const prefix = safeNumeric > 0 ? '+' : '';
  const absAmount = Math.abs(safeNumeric);
  if (code === 'NZD') {
    return `${prefix}${formatMoney(absAmount, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} NZD`;
  }
  return `${prefix}${formatReceiptAmount(absAmount, code)}`;
}

/**
 * Formats the secondary summary subtext in ReceiptDetailModal without emitting "0 items" for payslips.
 */
export function formatReceiptSummarySubtext(
  receipt: Pick<Receipt, 'document_type' | 'items' | 'tax_amount' | 'currency'>
): string {
  if (isPayslipDocument(receipt.document_type) && receipt.items.length === 0) {
    if (receipt.tax_amount != null && Number(receipt.tax_amount) > 0) {
      return `PAYE Tax: ${formatReceiptAmount(Number(receipt.tax_amount), receipt.currency)}`;
    }
    return 'Payslip PDF';
  }
  const count = receipt.items.length;
  return `${count} ${count === 1 ? 'item' : 'items'}`;
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
