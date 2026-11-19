import React, { useMemo, useState } from 'react';
import { EmptyState, LoadingState } from '@yggdrasil-lab/ui';
import { RecurrenceType, Transaction } from '../types';
import { collapsePairedTransfers } from '../utils/transfers';
import { ReceiptDetailModal } from './receipts/ReceiptDetailModal';
import { TransactionRow } from './TransactionRow';

interface TransactionListProps {
  transactions: Transaction[];
  categories: readonly string[];
  loading: boolean;
  loadingLabel?: string;
  emptyTitle: string;
  emptyDescription?: string;
  updatingId: number | null;
  onCategoryChange: (txId: number, category: string) => void;
  onTagsChange?: (txId: number, tags: string[]) => void;
  onRecurrenceChange?: (txId: number, recurrence: RecurrenceType | null) => void;
  onCreateRule: (tx: Transaction) => void;
  onReceiptUpdated?: () => void;
  showAccountBadge?: boolean;
  fallbackCurrency?: string;
  listTestId?: string;
  getRowTestId?: (tx: Transaction) => string;
  getSelectTestId?: (tx: Transaction) => string;
  getRuleBtnTestId?: (tx: Transaction) => string;
}

/**
 * Scrollable transaction list wrapper with unified loading, empty, and row states.
 */
export const TransactionList: React.FC<TransactionListProps> = ({
  transactions,
  categories,
  loading,
  loadingLabel = 'Loading transactions...',
  emptyTitle,
  emptyDescription,
  updatingId,
  onCategoryChange,
  onTagsChange,
  onRecurrenceChange,
  onCreateRule,
  onReceiptUpdated,
  showAccountBadge = true,
  fallbackCurrency,
  listTestId,
  getRowTestId,
  getSelectTestId,
  getRuleBtnTestId,
}) => {
  const [selectedReceiptId, setSelectedReceiptId] = useState<number | null>(null);
  const displayTransactions = useMemo(
    () => collapsePairedTransfers(transactions),
    [transactions]
  );

  if (loading) {
    return <LoadingState label={loadingLabel} variant="amber" />;
  }

  if (displayTransactions.length === 0) {
    return (
      <EmptyState
        title={emptyTitle}
        description={emptyDescription}
        variant="dashed"
      />
    );
  }

  return (
    <>
      <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1" data-testid={listTestId}>
        {displayTransactions.map((tx) => (
          <TransactionRow
            key={tx.id}
            transaction={tx}
            categories={categories}
            updating={updatingId === tx.id}
            onCategoryChange={onCategoryChange}
            onTagsChange={onTagsChange}
            onRecurrenceChange={onRecurrenceChange}
            onCreateRule={onCreateRule}
            onOpenReceipt={(receiptId) => setSelectedReceiptId(receiptId)}
            showAccountBadge={showAccountBadge}
            fallbackCurrency={fallbackCurrency}
            rowTestId={getRowTestId?.(tx)}
            selectTestId={getSelectTestId?.(tx)}
            ruleBtnTestId={getRuleBtnTestId?.(tx)}
          />
        ))}
      </div>

      <ReceiptDetailModal
        receiptId={selectedReceiptId}
        isOpen={selectedReceiptId !== null}
        onClose={() => setSelectedReceiptId(null)}
        onReceiptUpdated={onReceiptUpdated}
      />
    </>
  );
};
