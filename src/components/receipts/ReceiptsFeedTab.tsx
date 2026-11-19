import React, { useState } from 'react';
import { ChevronDown, ChevronUp, RefreshCw, Trash2 } from 'lucide-react';
import { Button, EmptyState, FileDropzone, LoadingState, StatusBadge } from '@yggdrasil-lab/ui';
import { Receipt } from '../../types';
import { formatMoney } from '../../utils/format';
import { ReceiptItemsEditor } from './ReceiptItemsEditor';

interface ReceiptsFeedTabProps {
  receipts: Receipt[];
  loading: boolean;
  uploading: boolean;
  deletingId: number | null;
  reprocessingId: number | null;
  updatingItemId?: number | null;
  expandedReceiptId: number | null;
  onToggleExpand: (id: number) => void;
  onUploadFile: (file: File) => Promise<void>;
  onDeleteReceipt: (id: number) => Promise<void>;
  onReprocessReceipt: (id: number) => Promise<void>;
  onUpdateReceiptItem?: (
    receiptId: number,
    itemId: number,
    patch: { category?: string; tags?: string[] }
  ) => Promise<void>;
}

/**
 * Receipts upload dropzone and expandable itemized receipt feed tab.
 */
export const ReceiptsFeedTab: React.FC<ReceiptsFeedTabProps> = ({
  receipts,
  loading,
  uploading,
  deletingId,
  reprocessingId,
  updatingItemId,
  expandedReceiptId,
  onToggleExpand,
  onUploadFile,
  onDeleteReceipt,
  onReprocessReceipt,
  onUpdateReceiptItem,
}) => {
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  const handleFileChange = async (file: File | null) => {
    setPendingFile(file);
    if (!file) return;
    try {
      await onUploadFile(file);
    } finally {
      setPendingFile(null);
    }
  };

  return (
    <div className="space-y-3.5">
      <FileDropzone
        file={pendingFile}
        onFileChange={handleFileChange}
        acceptedFormats="image/*,application/pdf"
        title={
          uploading
            ? 'Parsing receipt with Hydrogen Vision...'
            : 'Drop receipt photo or PDF here, or browse'
        }
        description="Extracts merchant, items, volume, and matches credit card statements"
        variant="amber"
        className="p-4"
      >
        {uploading && <LoadingState label="Parsing receipt with Hydrogen Vision..." variant="amber" />}
      </FileDropzone>

      {loading && !receipts.length ? (
        <LoadingState label="Loading receipts..." variant="amber" />
      ) : receipts.length === 0 ? (
        <EmptyState
          title="No receipts recorded yet"
          description="Upload a photo or PDF to parse granular line items."
          variant="dashed"
        />
      ) : (
        <div className="space-y-2 max-h-[45vh] overflow-y-auto pr-1">
          {receipts.map((r) => {
            const isExpanded = expandedReceiptId === r.id;
            const isMatched = r.status === 'matched' || r.status === 'verified';

            return (
              <div
                key={r.id}
                className="p-3 bg-card/60 hover:bg-card/80 border border-border rounded-xl transition-all"
              >
                <div
                  className="flex items-center justify-between cursor-pointer"
                  onClick={() => onToggleExpand(r.id)}
                  role="button"
                  tabIndex={0}
                  data-testid={`receipt-row-${r.id}`}
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="text-[11px] font-mono text-slate-400 whitespace-nowrap shrink-0">
                        {r.receipt_date}
                      </span>
                      <StatusBadge
                        label={isMatched ? 'Matched to Ledger' : 'Unlinked'}
                        variant={isMatched ? 'success' : 'warning'}
                        className="px-1.5 py-0.5 text-[10px] shrink-0"
                      />
                      {r.is_processed === false && (
                        <StatusBadge
                          label="Unprocessed"
                          variant="idle"
                          className="px-1.5 py-0.5 text-[10px] shrink-0"
                        />
                      )}
                      {r.items && r.items.length > 0 && (
                        <span className="text-[10px] text-slate-400 whitespace-nowrap shrink-0">
                          ({r.items.length} {r.items.length === 1 ? 'item' : 'items'})
                        </span>
                      )}
                    </div>
                    <div className="text-xs font-semibold text-slate-200 truncate">
                      {r.merchant}
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 shrink-0">
                    <span className="text-xs font-bold font-mono text-slate-100">
                      {formatMoney(Number(r.total_amount), {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        void onDeleteReceipt(r.id);
                      }}
                      disabled={deletingId === r.id}
                      data-testid={`delete-receipt-${r.id}`}
                      aria-label={`Delete receipt ${r.merchant}`}
                      title="Delete receipt"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors disabled:opacity-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-slate-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    )}
                  </div>
                </div>

                {isExpanded && (
                  <div className="mt-3 pt-3 border-t border-border/60 space-y-3 animate-in fade-in">
                    {r.is_processed === false && r.has_image && (
                      <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-200">
                        <span>Original photo saved; vision parsing pending.</span>
                        <Button
                          variant="outline"
                          size="xs"
                          onClick={() => void onReprocessReceipt(r.id)}
                          disabled={reprocessingId === r.id}
                          icon={
                            <RefreshCw
                              className={`w-3 h-3 text-amber-400 ${reprocessingId === r.id ? 'animate-spin' : ''}`}
                            />
                          }
                        >
                          {reprocessingId === r.id ? 'Parsing...' : 'Retry Parse'}
                        </Button>
                      </div>
                    )}

                    <ReceiptItemsEditor
                      receipt={r}
                      updatingItemId={updatingItemId}
                      onUpdateItem={onUpdateReceiptItem}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
