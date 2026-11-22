import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, RefreshCw, Trash2 } from 'lucide-react';
import { Button, EmptyState, FileDropzone, LoadingState, StatusBadge } from '@yggdrasil-lab/ui';
import { Receipt } from '../../types';
import {
  computeReceiptFeedCounts,
  filterReceiptsByStatus,
  formatReceiptAmount,
  getReceiptStatusMeta,
  isPayslipDocument,
  type ReceiptFeedCounts,
  type ReceiptFeedFilter,
} from '../../utils/receipts';
import { ReceiptCandidatesPanel } from './ReceiptCandidatesPanel';
import { ReceiptItemsEditor } from './ReceiptItemsEditor';

interface ReceiptsFeedTabProps {
  receipts: Receipt[];
  loading: boolean;
  uploading: boolean;
  deletingId: number | null;
  reprocessingId: number | null;
  updatingItemId?: number | null;
  expandedReceiptId: number | null;
  statusFilter: ReceiptFeedFilter;
  onChangeStatusFilter: (filter: ReceiptFeedFilter) => void;
  onToggleExpand: (id: number) => void;
  onUploadFile: (file: File) => Promise<void>;
  onDeleteReceipt: (id: number) => Promise<void>;
  onReprocessReceipt: (id: number) => Promise<void>;
  onReceiptLinked?: (updatedReceipt: Receipt) => void | Promise<void>;
  onUpdateReceiptItem?: (
    receiptId: number,
    itemId: number,
    patch: { category?: string; tags?: string[] }
  ) => Promise<void>;
}

/**
 * Receipts upload dropzone, status filters, candidate linking drawer, and itemized feed tab.
 */
export const ReceiptsFeedTab: React.FC<ReceiptsFeedTabProps> = ({
  receipts,
  loading,
  uploading,
  deletingId,
  reprocessingId,
  updatingItemId,
  expandedReceiptId,
  statusFilter,
  onChangeStatusFilter,
  onToggleExpand,
  onUploadFile,
  onDeleteReceipt,
  onReprocessReceipt,
  onReceiptLinked,
  onUpdateReceiptItem,
}) => {
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const counts = useMemo(() => computeReceiptFeedCounts(receipts), [receipts]);
  const filteredReceipts = useMemo(
    () => filterReceiptsByStatus(receipts, statusFilter),
    [receipts, statusFilter]
  );

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
        title={uploading ? 'Parsing receipt with Hydrogen Vision...' : 'Drop receipt photo or PDF here, or browse'}
        description="Extracts merchant, items, volume, and matches credit card statements"
        variant="amber"
        className="p-4"
      >
        {uploading && <LoadingState label="Parsing receipt with Hydrogen Vision..." variant="amber" />}
      </FileDropzone>

      {receipts.length > 0 && (
        <ReceiptStatusFilterBar
          counts={counts}
          statusFilter={statusFilter}
          onChangeStatusFilter={onChangeStatusFilter}
        />
      )}

      <ReceiptFeedList
        receipts={receipts}
        filteredReceipts={filteredReceipts}
        loading={loading}
        expandedReceiptId={expandedReceiptId}
        deletingId={deletingId}
        reprocessingId={reprocessingId}
        updatingItemId={updatingItemId}
        onToggleExpand={onToggleExpand}
        onDeleteReceipt={onDeleteReceipt}
        onReprocessReceipt={onReprocessReceipt}
        onReceiptLinked={onReceiptLinked}
        onUpdateReceiptItem={onUpdateReceiptItem}
      />
    </div>
  );
};

function ReceiptStatusFilterBar({
  counts,
  statusFilter,
  onChangeStatusFilter,
}: {
  counts: ReceiptFeedCounts;
  statusFilter: ReceiptFeedFilter;
  onChangeStatusFilter: (filter: ReceiptFeedFilter) => void;
}) {
  const options: Array<{ id: ReceiptFeedFilter; label: string; count: number; highlightAmber?: boolean }> = [
    { id: 'all', label: 'All', count: counts.all },
    { id: 'pending', label: 'Pending', count: counts.pending },
    { id: 'needs_review', label: 'Needs Review', count: counts.needs_review, highlightAmber: counts.needs_review > 0 },
    { id: 'matched', label: 'Matched', count: counts.matched },
  ];

  return (
    <div className="flex flex-wrap items-center gap-1.5" data-testid="receipt-status-filters">
      {options.map((opt) => {
        const isSelected = statusFilter === opt.id;
        const tone = isSelected
          ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 font-semibold'
          : opt.highlightAmber
            ? 'bg-amber-500/10 text-amber-200 border-amber-500/25 hover:border-amber-500/40'
            : 'bg-card/40 text-slate-400 hover:text-slate-200 border-border/60';
        return (
          <button
            key={opt.id}
            type="button"
            data-testid={`receipt-filter-${opt.id}`}
            onClick={() => onChangeStatusFilter(opt.id)}
            className={`px-2.5 py-1 text-[11px] rounded-lg border transition-colors inline-flex items-center gap-1.5 ${tone}`}
          >
            <span>{opt.label}</span>
            <span className="font-mono text-[10px] px-1 py-0.2 rounded bg-background/60 text-slate-300">
              {opt.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}

interface ReceiptFeedListProps {
  receipts: Receipt[];
  filteredReceipts: Receipt[];
  loading: boolean;
  expandedReceiptId: number | null;
  deletingId: number | null;
  reprocessingId: number | null;
  updatingItemId?: number | null;
  onToggleExpand: (id: number) => void;
  onDeleteReceipt: (id: number) => Promise<void>;
  onReprocessReceipt: (id: number) => Promise<void>;
  onReceiptLinked?: (updatedReceipt: Receipt) => void | Promise<void>;
  onUpdateReceiptItem?: ReceiptsFeedTabProps['onUpdateReceiptItem'];
}

function ReceiptFeedList({
  receipts,
  filteredReceipts,
  loading,
  expandedReceiptId,
  deletingId,
  reprocessingId,
  updatingItemId,
  onToggleExpand,
  onDeleteReceipt,
  onReprocessReceipt,
  onReceiptLinked,
  onUpdateReceiptItem,
}: ReceiptFeedListProps) {
  if (loading && !receipts.length) {
    return <LoadingState label="Loading receipts..." variant="amber" />;
  }
  if (receipts.length === 0) {
    return (
      <EmptyState
        title="No receipts recorded yet"
        description="Upload a photo or PDF to parse granular line items."
        variant="dashed"
      />
    );
  }
  if (filteredReceipts.length === 0) {
    return (
      <EmptyState
        title="No receipts match this filter"
        description="Switch back to All to inspect every recorded receipt."
        variant="dashed"
      />
    );
  }
  return (
    <div className="space-y-2 max-h-[45vh] overflow-y-auto pr-1">
      {filteredReceipts.map((r) => (
        <ReceiptFeedRow
          key={r.id}
          receipt={r}
          isExpanded={expandedReceiptId === r.id}
          deletingId={deletingId}
          reprocessingId={reprocessingId}
          updatingItemId={updatingItemId}
          onToggleExpand={onToggleExpand}
          onDeleteReceipt={onDeleteReceipt}
          onReprocessReceipt={onReprocessReceipt}
          onReceiptLinked={onReceiptLinked}
          onUpdateReceiptItem={onUpdateReceiptItem}
        />
      ))}
    </div>
  );
}

interface ReceiptFeedRowProps {
  receipt: Receipt;
  isExpanded: boolean;
  deletingId: number | null;
  reprocessingId: number | null;
  updatingItemId?: number | null;
  onToggleExpand: (id: number) => void;
  onDeleteReceipt: (id: number) => Promise<void>;
  onReprocessReceipt: (id: number) => Promise<void>;
  onReceiptLinked?: (updatedReceipt: Receipt) => void | Promise<void>;
  onUpdateReceiptItem?: (
    receiptId: number,
    itemId: number,
    patch: { category?: string; tags?: string[] }
  ) => Promise<void>;
}

function ReceiptFeedRow({
  receipt: r,
  isExpanded,
  deletingId,
  reprocessingId,
  updatingItemId,
  onToggleExpand,
  onDeleteReceipt,
  onReprocessReceipt,
  onReceiptLinked,
  onUpdateReceiptItem,
}: ReceiptFeedRowProps) {
  const isPayslip = isPayslipDocument(r.document_type);
  const borderClass =
    r.status === 'needs_review'
      ? 'bg-amber-500/[0.04] hover:bg-amber-500/[0.07] border-amber-500/35'
      : 'bg-card/60 hover:bg-card/80 border-border';

  return (
    <div className={`p-3 rounded-xl border transition-all ${borderClass}`}>
      <ReceiptFeedRowHeader
        receipt={r}
        isPayslip={isPayslip}
        isExpanded={isExpanded}
        deletingId={deletingId}
        onToggleExpand={onToggleExpand}
        onDeleteReceipt={onDeleteReceipt}
      />
      {isExpanded && (
        <ReceiptFeedRowDetails
          receipt={r}
          isPayslip={isPayslip}
          reprocessingId={reprocessingId}
          updatingItemId={updatingItemId}
          onReprocessReceipt={onReprocessReceipt}
          onReceiptLinked={onReceiptLinked}
          onUpdateReceiptItem={onUpdateReceiptItem}
        />
      )}
    </div>
  );
}

function ReceiptFeedRowHeader({
  receipt: r,
  isPayslip,
  isExpanded,
  deletingId,
  onToggleExpand,
  onDeleteReceipt,
}: {
  receipt: Receipt;
  isPayslip: boolean;
  isExpanded: boolean;
  deletingId: number | null;
  onToggleExpand: (id: number) => void;
  onDeleteReceipt: (id: number) => Promise<void>;
}) {
  return (
    <div
      className="flex items-center justify-between gap-2 cursor-pointer"
      onClick={() => onToggleExpand(r.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onToggleExpand(r.id);
        }
      }}
      role="button"
      tabIndex={0}
      data-testid={`receipt-row-${r.id}`}
    >
      <ReceiptFeedRowMeta receipt={r} isPayslip={isPayslip} />
      <ReceiptFeedRowActions
        receipt={r}
        isPayslip={isPayslip}
        isExpanded={isExpanded}
        deletingId={deletingId}
        onDeleteReceipt={onDeleteReceipt}
      />
    </div>
  );
}

function ReceiptFeedRowMeta({ receipt: r, isPayslip }: { receipt: Receipt; isPayslip: boolean }) {
  const statusMeta = getReceiptStatusMeta(r.status);
  return (
    <div className="space-y-1 min-w-0">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="text-[11px] font-mono text-slate-400 whitespace-nowrap shrink-0">
          {r.receipt_date}
        </span>
        {isPayslip && <StatusBadge label="Payslip" variant="info" className="px-1.5 py-0.5 text-[10px] shrink-0" />}
        <StatusBadge label={statusMeta.label} variant={statusMeta.variant} className="px-1.5 py-0.5 text-[10px] shrink-0" />
        {r.is_processed === false && <StatusBadge label="Unprocessed" variant="idle" className="px-1.5 py-0.5 text-[10px] shrink-0" />}
        {r.items && r.items.length > 0 && (
          <span className="text-[10px] text-slate-400 whitespace-nowrap shrink-0">
            ({r.items.length} {r.items.length === 1 ? 'item' : 'items'})
          </span>
        )}
      </div>
      <div className="text-xs font-semibold text-slate-200 truncate">{r.merchant}</div>
    </div>
  );
}

function ReceiptFeedRowActions({
  receipt: r,
  isPayslip,
  isExpanded,
  deletingId,
  onDeleteReceipt,
}: {
  receipt: Receipt;
  isPayslip: boolean;
  isExpanded: boolean;
  deletingId: number | null;
  onDeleteReceipt: (id: number) => Promise<void>;
}) {
  return (
    <div className="flex items-center space-x-2 shrink-0">
      <span className="text-xs font-bold font-mono text-slate-100 whitespace-nowrap">
        {formatReceiptAmount(Number(r.total_amount), r.currency)}
      </span>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          void onDeleteReceipt(r.id);
        }}
        disabled={deletingId === r.id}
        data-testid={`delete-receipt-${r.id}`}
        aria-label={`Delete ${isPayslip ? 'payslip' : 'receipt'} ${r.merchant}`}
        title={isPayslip ? 'Delete payslip' : 'Delete receipt'}
        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors disabled:opacity-50"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
      {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
    </div>
  );
}

function ReceiptFeedMetadataRow({
  testId,
  label,
  value,
}: {
  testId: string;
  label: string;
  value: string;
}) {
  return (
    <div
      data-testid={testId}
      className="flex items-center justify-between gap-2 text-[11px] text-slate-400 bg-background/40 px-2.5 py-1.5 rounded-lg border border-border/50"
    >
      <span className="uppercase tracking-wider text-[10px] font-medium">{label}</span>
      <span className="font-mono text-slate-200 truncate">{value}</span>
    </div>
  );
}

function ReceiptRetryParseBanner({
  receiptId,
  isParsing,
  onReprocessReceipt,
}: {
  receiptId: number;
  isParsing: boolean;
  onReprocessReceipt: (id: number) => Promise<void>;
}) {
  return (
    <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-200">
      <span>Original photo saved; vision parsing pending.</span>
      <Button
        variant="outline"
        size="xs"
        onClick={() => void onReprocessReceipt(receiptId)}
        disabled={isParsing}
        icon={<RefreshCw className={`w-3 h-3 text-amber-400 ${isParsing ? 'animate-spin' : ''}`} />}
      >
        {isParsing ? 'Parsing...' : 'Retry Parse'}
      </Button>
    </div>
  );
}

function ReceiptFeedRowDetails({
  receipt: r,
  isPayslip,
  reprocessingId,
  updatingItemId,
  onReprocessReceipt,
  onReceiptLinked,
  onUpdateReceiptItem,
}: {
  receipt: Receipt;
  isPayslip: boolean;
  reprocessingId: number | null;
  updatingItemId?: number | null;
  onReprocessReceipt: (id: number) => Promise<void>;
  onReceiptLinked?: (updatedReceipt: Receipt) => void | Promise<void>;
  onUpdateReceiptItem?: ReceiptFeedRowProps['onUpdateReceiptItem'];
}) {
  const orderNumber = r.order_number;
  const showPaye = isPayslip && r.tax_amount != null && Number(r.tax_amount) > 0;
  return (
    <div className="mt-3 pt-3 border-t border-border/60 space-y-3 animate-in fade-in">
      {Boolean(orderNumber) && orderNumber && (
        <ReceiptFeedMetadataRow
          testId={`receipt-order-${r.id}`}
          label={isPayslip ? 'Pay Period' : 'Order Ref'}
          value={orderNumber}
        />
      )}
      {showPaye && (
        <ReceiptFeedMetadataRow
          testId={`receipt-paye-${r.id}`}
          label="PAYE Tax"
          value={formatReceiptAmount(Number(r.tax_amount), r.currency)}
        />
      )}
      {r.is_processed === false && r.has_image && (
        <ReceiptRetryParseBanner
          receiptId={r.id}
          isParsing={reprocessingId === r.id}
          onReprocessReceipt={onReprocessReceipt}
        />
      )}
      {r.transaction_id == null && <ReceiptCandidatesPanel receipt={r} onLinked={onReceiptLinked} />}
      <ReceiptItemsEditor receipt={r} updatingItemId={updatingItemId} onUpdateItem={onUpdateReceiptItem} />
    </div>
  );
}
