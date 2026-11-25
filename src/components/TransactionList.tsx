import React, { useMemo, useState } from 'react';
import { EmptyState, LoadingState } from '@yggdrasil-lab/ui';
import { Account, LoanItem, ReceiptDocumentType, RecurrenceType, Transaction } from '../types';
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
  accounts?: Account[];
  onCounterpartChange?: (txId: number, counterpartAccountId: number | null) => void;
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

interface TransactionListModalsProps {
  selectedReceipt: { id: number; documentType?: ReceiptDocumentType | null } | null;
  splittingTx: Transaction | null;
  categories: readonly string[];
  loans: LoanItem[];
  onCloseReceipt: () => void;
  onCloseSplit: () => void;
  onReceiptUpdated?: () => void;
  onSplitsUpdated?: (updatedTx: Transaction) => void;
}

const TransactionListModals: React.FC<TransactionListModalsProps> = ({
  selectedReceipt,
  splittingTx,
  categories,
  loans,
  onCloseReceipt,
  onCloseSplit,
  onReceiptUpdated,
  onSplitsUpdated,
}) => (
  <>
    <ReceiptDetailModal
      receiptId={selectedReceipt?.id ?? null}
      documentType={selectedReceipt?.documentType}
      isOpen={selectedReceipt !== null}
      onClose={onCloseReceipt}
      onReceiptUpdated={onReceiptUpdated}
    />
    <TransactionSplitModal
      transaction={splittingTx}
      isOpen={splittingTx !== null}
      onClose={onCloseSplit}
      categories={categories}
      loans={loans}
      onSaved={(updatedTx) => {
        onSplitsUpdated?.(updatedTx);
        onReceiptUpdated?.();
      }}
    />
  </>
);

/**
 * Scrollable transaction list wrapper with unified loading, empty, and row states.
 */
export const TransactionList: React.FC<TransactionListProps> = (props) => {
  const {
    transactions,
    categories,
    loading,
    loadingLabel = 'Loading transactions...',
    emptyTitle,
    emptyDescription,
    updatingId,
    loans,
    accounts,
    scrollable = true,
    listTestId,
    getRowTestId,
    getSelectTestId,
    getRuleBtnTestId,
  } = props;
  const [selectedReceipt, setSelectedReceipt] = useState<{
    id: number;
    documentType?: ReceiptDocumentType | null;
  } | null>(null);
  const [splittingTx, setSplittingTx] = useState<Transaction | null>(null);
  const displayTransactions = useMemo(
    () => collapsePairedTransfers(transactions),
    [transactions]
  );

  if (loading) return <LoadingState label={loadingLabel} variant="brand" />;
  if (displayTransactions.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} variant="dashed" />;
  }

  return (
    <>
      <div
        className={scrollable ? 'space-y-2 max-h-[50vh] overflow-y-auto pr-1' : 'space-y-2'}
        data-testid={listTestId}
      >
        {displayTransactions.map((tx) => (
          <TransactionRow
            key={tx.id}
            transaction={tx}
            categories={categories}
            updating={updatingId === tx.id}
            onCategoryChange={props.onCategoryChange}
            onTagsChange={props.onTagsChange}
            onRecurrenceChange={props.onRecurrenceChange}
            loans={loans}
            onLoanChange={props.onLoanChange}
            accounts={accounts}
            onCounterpartChange={props.onCounterpartChange}
            onCreateRule={props.onCreateRule}
            onOpenReceipt={(receiptId, documentType) => setSelectedReceipt({ id: receiptId, documentType })}
            onOpenSplit={setSplittingTx}
            showAccountBadge={props.showAccountBadge ?? true}
            fallbackCurrency={props.fallbackCurrency}
            rowTestId={getRowTestId?.(tx)}
            selectTestId={getSelectTestId?.(tx)}
            ruleBtnTestId={getRuleBtnTestId?.(tx)}
          />
        ))}
      </div>
      <TransactionListModals
        selectedReceipt={selectedReceipt}
        splittingTx={splittingTx}
        categories={categories}
        loans={loans || []}
        onCloseReceipt={() => setSelectedReceipt(null)}
        onCloseSplit={() => setSplittingTx(null)}
        onReceiptUpdated={props.onReceiptUpdated}
        onSplitsUpdated={props.onSplitsUpdated}
      />
    </>
  );
};
