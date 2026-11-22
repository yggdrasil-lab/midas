import React, { useMemo, useState } from 'react';
import { EmptyState, LoadingState } from '@yggdrasil-lab/ui';
import { LoanItem, ReceiptDocumentType, RecurrenceType, Transaction } from '../types';
import { collapsePairedTransfers } from '../utils/transfers';
import { ReceiptDetailModal } from './receipts/ReceiptDetailModal';
import { TransactionRow } from './TransactionRow';
import { TransactionSplitModal } from './TransactionSplitModal';

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
  loans?: LoanItem[];
  onLoanChange?: (
    txId: number,
    loanId: number | null,
    loanPaymentAmount?: number | null
  ) => void;
  onCreateRule: (tx: Transaction) => void;
  onReceiptUpdated?: () => void;
  onSplitsUpdated?: (updatedTx: Transaction) => void;
  showAccountBadge?: boolean;
  fallbackCurrency?: string;
  scrollable?: boolean;
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
  loans,
  onLoanChange,
  onCreateRule,
  onReceiptUpdated,
  onSplitsUpdated,
  showAccountBadge = true,
  fallbackCurrency,
  scrollable = true,
  listTestId,
  getRowTestId,
  getSelectTestId,
  getRuleBtnTestId,
}) => {
  const [selectedReceipt, setSelectedReceipt] = useState<{
    id: number;
    documentType?: ReceiptDocumentType | null;
  } | null>(null);
  const [splittingTx, setSplittingTx] = useState<Transaction | null>(null);
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
      <div
        className={
          scrollable ? 'space-y-2 max-h-[50vh] overflow-y-auto pr-1' : 'space-y-2'
        }
        data-testid={listTestId}
      >
        {displayTransactions.map((tx) => (
          <TransactionRow
            key={tx.id}
            transaction={tx}
            categories={categories}
            updating={updatingId === tx.id}
            onCategoryChange={onCategoryChange}
            onTagsChange={onTagsChange}
            onRecurrenceChange={onRecurrenceChange}
            loans={loans}
            onLoanChange={onLoanChange}
            onCreateRule={onCreateRule}
            onOpenReceipt={(receiptId, documentType) =>
              setSelectedReceipt({ id: receiptId, documentType })
            }
            onOpenSplit={(rowTx) => setSplittingTx(rowTx)}
            showAccountBadge={showAccountBadge}
            fallbackCurrency={fallbackCurrency}
            rowTestId={getRowTestId?.(tx)}
            selectTestId={getSelectTestId?.(tx)}
            ruleBtnTestId={getRuleBtnTestId?.(tx)}
          />
        ))}
      </div>

      <ReceiptDetailModal
        receiptId={selectedReceipt?.id ?? null}
        documentType={selectedReceipt?.documentType}
        isOpen={selectedReceipt !== null}
        onClose={() => setSelectedReceipt(null)}
        onReceiptUpdated={onReceiptUpdated}
      />

      <TransactionSplitModal
        transaction={splittingTx}
        isOpen={splittingTx !== null}
        onClose={() => setSplittingTx(null)}
        categories={categories}
        loans={loans || []}
        onSaved={(updatedTx) => {
          onSplitsUpdated?.(updatedTx);
          onReceiptUpdated?.();
        }}
      />
    </>
  );
};
