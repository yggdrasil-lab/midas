import React, { useEffect, useState } from 'react';
import { AlertBanner, Button, LoadingState, Modal, StatusBadge } from '@yggdrasil-lab/ui';
import { fetchReceipt, updateReceiptItem } from '../../services/api';
import { Receipt } from '../../types';
import { formatReceiptAmount, getReceiptStatusMeta } from '../../utils/receipts';
import { ReceiptCandidatesPanel } from './ReceiptCandidatesPanel';
import { ReceiptItemsEditor } from './ReceiptItemsEditor';

interface ReceiptDetailModalProps {
  receiptId: number | null;
  isOpen: boolean;
  onClose: () => void;
  onReceiptUpdated?: () => void;
}

/**
 * Modal opened from a transaction or receipt link to inspect the stored receipt photo,
 * review status, link candidate ledger transactions, and edit line-item categories/tags.
 */
export const ReceiptDetailModal: React.FC<ReceiptDetailModalProps> = ({
  receiptId,
  isOpen,
  onClose,
  onReceiptUpdated,
}) => {
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
      .then((res) => {
        if (active) setReceipt(res);
      })
      .catch((err) => {
        console.error(err);
        if (active) {
          setError(err instanceof Error ? err.message : 'Failed to load receipt details');
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [isOpen, receiptId]);

  const handleUpdateItem = async (
    rId: number,
    itemId: number,
    patch: { category?: string; tags?: string[] }
  ) => {
    setUpdatingItemId(itemId);
    setError(null);
    try {
      const updated = await updateReceiptItem(rId, itemId, patch);
      setReceipt((prev) =>
        prev
          ? {
              ...prev,
              items: prev.items.map((it) => (it.id === itemId ? updated : it)),
            }
          : prev
      );
      onReceiptUpdated?.();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to update receipt item');
    } finally {
      setUpdatingItemId(null);
    }
  };

  const statusMeta = receipt ? getReceiptStatusMeta(receipt.status) : null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={receipt ? `Receipt: ${receipt.merchant}` : 'Receipt Details'}
      className="sm:max-w-2xl"
    >
      <div className="space-y-4" data-testid="receipt-detail-modal">
        {error && <AlertBanner variant="error">{error}</AlertBanner>}

        {loading ? (
          <LoadingState label="Loading receipt items & photo..." variant="amber" />
        ) : receipt ? (
          <>
            <div className="flex items-center justify-between gap-2 p-3 bg-card/60 rounded-xl border border-border flex-wrap">
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-mono text-slate-400">{receipt.receipt_date}</span>
                  {statusMeta && (
                    <StatusBadge
                      label={statusMeta.label}
                      variant={statusMeta.variant}
                      className="px-1.5 py-0.5 text-[10px]"
                    />
                  )}
                </div>
                <div className="text-sm font-semibold text-slate-100 truncate">
                  {receipt.merchant}
                </div>
                {receipt.order_number && (
                  <div
                    data-testid="receipt-detail-order-number"
                    className="text-[11px] font-mono text-slate-400"
                  >
                    Order #{receipt.order_number}
                  </div>
                )}
              </div>
              <div className="text-right shrink-0">
                <div className="text-sm font-bold font-mono text-slate-100">
                  {formatReceiptAmount(Number(receipt.total_amount), receipt.currency)}
                </div>
                <div className="text-[11px] text-slate-400">
                  {receipt.items.length} {receipt.items.length === 1 ? 'item' : 'items'}
                </div>
              </div>
            </div>

            {receipt.transaction_id == null && (
              <ReceiptCandidatesPanel
                receipt={receipt}
                onLinked={(updated) => {
                  setReceipt(updated);
                  onReceiptUpdated?.();
                }}
              />
            )}

            <div className="max-h-[46vh] sm:max-h-[60vh] overflow-y-auto pr-1">
              <ReceiptItemsEditor
                receipt={receipt}
                updatingItemId={updatingItemId}
                onUpdateItem={handleUpdateItem}
              />
            </div>
          </>
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
