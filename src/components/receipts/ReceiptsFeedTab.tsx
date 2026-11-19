import React, { useState } from 'react';
import { ChevronDown, ChevronUp, ExternalLink, RefreshCw, Trash2 } from 'lucide-react';
import { Button, EmptyState, FileDropzone, LoadingState, StatusBadge } from '@yggdrasil-lab/ui';
import { getReceiptImageUrl } from '../../services/api';
import { Receipt } from '../../types';
import { formatMoney } from '../../utils/format';

interface ReceiptsFeedTabProps {
  receipts: Receipt[];
  loading: boolean;
  uploading: boolean;
  deletingId: number | null;
  reprocessingId: number | null;
  expandedReceiptId: number | null;
  onToggleExpand: (id: number) => void;
  onUploadFile: (file: File) => Promise<void>;
  onDeleteReceipt: (id: number) => Promise<void>;
  onReprocessReceipt: (id: number) => Promise<void>;
}

const DOMAIN_BADGE_LABELS: Record<string, string> = {
  '02-skin': 'Skin',
  '01-health': 'Health',
};

/**
 * Receipts upload dropzone and expandable itemized receipt feed tab.
 */
export const ReceiptsFeedTab: React.FC<ReceiptsFeedTabProps> = ({
  receipts,
  loading,
  uploading,
  deletingId,
  reprocessingId,
  expandedReceiptId,
  onToggleExpand,
  onUploadFile,
  onDeleteReceipt,
  onReprocessReceipt,
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

                    {r.has_image && (
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                          <span>Stored Receipt Image</span>
                          <a
                            href={getReceiptImageUrl(r.id)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-amber-400 hover:text-amber-300 normal-case"
                          >
                            <span>Open full size</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                        {(!r.image_mime_type || r.image_mime_type.startsWith('image/')) && (
                          <div className="rounded-lg border border-border/60 bg-background/60 overflow-hidden max-h-48 flex items-center justify-center">
                            <img
                              src={getReceiptImageUrl(r.id)}
                              alt={r.image_filename || `${r.merchant} receipt`}
                              className="max-h-48 w-auto object-contain"
                              loading="lazy"
                            />
                          </div>
                        )}
                      </div>
                    )}

                    {r.items && r.items.length > 0 && (
                      <>
                        <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                          Itemized Breakdown
                        </div>
                        <div className="space-y-1.5">
                          {r.items.map((item) => (
                            <div
                              key={item.id}
                              className="p-2 bg-background/60 rounded-lg border border-border/50 flex items-center justify-between text-xs"
                            >
                              <div className="space-y-0.5 min-w-0 pr-2">
                                <div className="font-medium text-slate-200 truncate">
                                  {item.item_name}
                                </div>
                                <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-slate-400">
                                  {item.brand && (
                                    <span className="font-semibold text-slate-300">{item.brand}</span>
                                  )}
                                  {item.volume_ml && (
                                    <span className="px-1 rounded bg-slate-800 text-slate-300">
                                      {item.volume_ml}
                                    </span>
                                  )}
                                  {item.domain && (
                                    <span className="px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20">
                                      {DOMAIN_BADGE_LABELS[item.domain] || item.domain}
                                    </span>
                                  )}
                                  {item.tags && item.tags.length > 0 && (
                                    <div className="flex items-center gap-1">
                                      {item.tags.map((t) => (
                                        <span key={t} className="text-amber-400/80">
                                          #{t}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                              <div className="text-right shrink-0">
                                <div className="font-mono font-medium text-slate-100">
                                  {formatMoney(Number(item.total_price), {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })}
                                </div>
                                {item.quantity > 1 && (
                                  <div className="text-[10px] text-slate-400">
                                    {item.quantity}x @{' '}
                                    {formatMoney(Number(item.unit_price), {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2,
                                    })}
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
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
