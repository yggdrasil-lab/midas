import React, { useEffect, useState } from 'react';
import { AlertBanner, Button, LoadingState, Modal, StatusBadge } from '@yggdrasil-lab/ui';
import { fetchReceipt, updateReceiptItem } from '../../services/api';
import { Receipt, ReceiptDocumentType } from '../../types';
import {
  formatReceiptAmount,
  formatReceiptSummarySubtext,
  getReceiptStatusMeta,
  isPayslipDocument,
} from '../../utils/receipts';
import { ReceiptCandidatesPanel } from './ReceiptCandidatesPanel';
import { ReceiptItemsEditor } from './ReceiptItemsEditor';

interface ReceiptDetailModalProps {
  receiptId: number | null;
  documentType?: ReceiptDocumentType | null;
  isOpen: boolean;
  onClose: () => void;
  onReceiptUpdated?: () => void;
}

function resolveModalTitle(
  receipt: Receipt | null,
  isPayslip: boolean
): string {
  if (receipt) {
    return isPayslip ? `Payslip: ${receipt.merchant}` : `Receipt: ${receipt.merchant}`;
  }
  return isPayslip ? 'Payslip Details' : 'Receipt Details';
}

function resolveLoadingLabel(effectiveDocType?: ReceiptDocumentType | null): string {
  if (effectiveDocType === 'payslip') {
    return 'Loading payslip details & PDF...';
  }
  if (effectiveDocType === 'receipt') {
    return 'Loading receipt items & photo...';
  }
  return 'Loading document details...';
}

function formatReceiptLoadError(err: unknown, documentType?: ReceiptDocumentType | null): string {
  console.error(err);
  if (err instanceof Error) return err.message;
  return isPayslipDocument(documentType)
    ? 'Failed to load payslip details'
    : 'Failed to load receipt details';
}

function applyUpdatedReceiptItem(
  prev: Receipt | null,
  itemId: number,
  updated: Receipt['items'][number]
): Receipt | null {
  if (!prev) return prev;
  return { ...prev, items: prev.items.map((it) => (it.id === itemId ? updated : it)) };
}

function useReceiptDetailState({
  receiptId,
  documentType,
  isOpen,
  onReceiptUpdated,
}: {
  receiptId: number | null;
  documentType?: ReceiptDocumentType | null;
  isOpen: boolean;
  onReceiptUpdated?: () => void;
}) {
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [loading, setLoading] = useState(false);
  const [updatingItemId, setUpdatingItemId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || receiptId == null) {
      setReceipt(null);
      setError(null);
      return;
    }
    let active = true;
    setLoading(true);
    setError(null);
    fetchReceipt(receiptId)
      .then((res) => active && setReceipt(res))
      .catch((err) => active && setError(formatReceiptLoadError(err, documentType)))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [isOpen, receiptId, documentType]);

  const handleUpdateItem = async (
    rId: number,
    itemId: number,
    patch: { category?: string; tags?: string[] }
  ) => {
    setUpdatingItemId(itemId);
    setError(null);
    try {
      const updated = await updateReceiptItem(rId, itemId, patch);
      setReceipt((prev) => applyUpdatedReceiptItem(prev, itemId, updated));
      onReceiptUpdated?.();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to update receipt item');
    } finally {
      setUpdatingItemId(null);
    }
  };

  return { receipt, setReceipt, loading, updatingItemId, error, handleUpdateItem };
}

/**
 * Modal opened from a transaction or receipt link to inspect the stored receipt photo/PDF,
 * review status, link candidate ledger transactions, and edit line-item categories/tags.
 */
export const ReceiptDetailModal: React.FC<ReceiptDetailModalProps> = ({
  receiptId,
  documentType,
  isOpen,
  onClose,
  onReceiptUpdated,
}) => {
  const state = useReceiptDetailState({ receiptId, documentType, isOpen, onReceiptUpdated });
  const effectiveDocType = state.receipt ? state.receipt.document_type : documentType;
  const isPayslip = isPayslipDocument(effectiveDocType);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={resolveModalTitle(state.receipt, isPayslip)}
      className="sm:max-w-2xl"
    >
      <div className="space-y-4" data-testid="receipt-detail-modal">
        {state.error && <AlertBanner variant="error">{state.error}</AlertBanner>}
        {state.loading ? (
          <LoadingState label={resolveLoadingLabel(effectiveDocType)} variant="amber" />
        ) : state.receipt ? (
          <ReceiptDetailBody
            receipt={state.receipt}
            isPayslip={isPayslip}
            updatingItemId={state.updatingItemId}
            onLinked={(updated) => {
              state.setReceipt(updated);
              onReceiptUpdated?.();
            }}
            onUpdateItem={state.handleUpdateItem}
          />
        ) : null}
        <div className="pt-2 flex justify-end">
          <Button variant="outline" size="sm" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </Modal>
  );
};

function ReceiptDetailBody({
  receipt,
  isPayslip,
  updatingItemId,
  onLinked,
  onUpdateItem,
}: {
  receipt: Receipt;
  isPayslip: boolean;
  updatingItemId: number | null;
  onLinked: (updated: Receipt) => void;
  onUpdateItem: (rId: number, itemId: number, patch: { category?: string; tags?: string[] }) => Promise<void>;
}) {
  const statusMeta = getReceiptStatusMeta(receipt.status);
  return (
    <>
      <ReceiptDetailSummaryCard receipt={receipt} isPayslip={isPayslip} statusMeta={statusMeta} />
      {receipt.transaction_id == null && (
        <ReceiptCandidatesPanel receipt={receipt} onLinked={onLinked} />
      )}
      <div className="max-h-[46vh] sm:max-h-[60vh] overflow-y-auto pr-1">
        <ReceiptItemsEditor
          receipt={receipt}
          updatingItemId={updatingItemId}
          onUpdateItem={onUpdateItem}
        />
      </div>
    </>
  );
}

function ReceiptDetailSummaryCard({
  receipt,
  isPayslip,
  statusMeta,
}: {
  receipt: Receipt;
  isPayslip: boolean;
  statusMeta: ReturnType<typeof getReceiptStatusMeta>;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3 bg-card/60 rounded-xl border border-border">
      <div className="space-y-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-mono text-slate-400">{receipt.receipt_date}</span>
          {isPayslip && <StatusBadge label="Payslip" variant="info" className="px-1.5 py-0.5 text-[10px]" />}
          <StatusBadge label={statusMeta.label} variant={statusMeta.variant} className="px-1.5 py-0.5 text-[10px]" />
        </div>
        <div className="text-sm font-semibold text-slate-100 truncate">{receipt.merchant}</div>
        {Boolean(receipt.order_number) && (
          <div data-testid="receipt-detail-order-number" className="text-[11px] font-mono text-slate-400">
            {isPayslip ? `Pay Period: ${receipt.order_number}` : `Order #${receipt.order_number}`}
          </div>
        )}
      </div>
      <div className="flex items-baseline justify-between gap-2 sm:block sm:text-right shrink-0">
        <div className="text-sm font-bold font-mono text-slate-100">
          {formatReceiptAmount(Number(receipt.total_amount), receipt.currency)}
        </div>
        <div data-testid="receipt-detail-summary-subtext" className="text-[11px] text-slate-400">
          {formatReceiptSummarySubtext(receipt)}
        </div>
      </div>
    </div>
  );
}
