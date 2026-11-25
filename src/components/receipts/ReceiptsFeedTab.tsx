import React, { useMemo, useState } from 'react';
import { RefreshCw, Trash2 } from 'lucide-react';
import {
  AlertBanner,
  Button,
  CollapsibleSection,
  EmptyState,
  FileDropzone,
  FilterChipBar,
  type FilterChipOption,
  KeyValueList,
  LoadingState,
  StatusBadge,
} from '@yggdrasil-lab/ui';
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
        variant="brand"
        className="p-4"
      >
        {uploading && <LoadingState label="Parsing receipt with Hydrogen Vision..." variant="brand" />}
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
  const options: FilterChipOption[] = [
    { id: 'all', label: 'All', count: counts.all, testId: 'receipt-filter-all' },
    { id: 'pending', label: 'Pending', count: counts.pending, testId: 'receipt-filter-pending' },
    {
      id: 'needs_review',
      label: 'Needs Review',
      count: counts.needs_review,
      highlight: counts.needs_review > 0,
      testId: 'receipt-filter-needs_review',
    },
    { id: 'matched', label: 'Matched', count: counts.matched, testId: 'receipt-filter-matched' },
  ];

  return (
    <FilterChipBar
      data-testid="receipt-status-filters"
      options={options}
      selectedId={statusFilter}
      onSelect={(id) => onChangeStatusFilter(id as ReceiptFeedFilter)}
      variant="brand"
      size="xs"
    />
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
    return <LoadingState label="Loading receipts..." variant="brand" />;
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

  const deleteBtn = (
    <button
      type="button"
      onClick={() => void onDeleteReceipt(r.id)}
      disabled={deletingId === r.id}
      data-testid={`delete-receipt-${r.id}`}
      aria-label={`Delete ${isPayslip ? 'payslip' : 'receipt'} ${r.merchant}`}
      title={isPayslip ? 'Delete payslip' : 'Delete receipt'}
      className="p-1.5 min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors disabled:opacity-50"
    >
      <Trash2 className="w-3.5 h-3.5" />
    </button>
  );

  const rowTitle = (
    <div className="flex items-center justify-between gap-2 whitespace-normal">
      <ReceiptFeedRowMeta receipt={r} isPayslip={isPayslip} />
      <span className="text-xs font-bold font-mono text-slate-100 whitespace-nowrap shrink-0">
        {formatReceiptAmount(Number(r.total_amount), r.currency)}
      </span>
    </div>
  );

  return (
    <CollapsibleSection
      variant="card"
      open={isExpanded}
      onOpenChange={() => onToggleExpand(r.id)}
      toggleTestId={`receipt-row-${r.id}`}
      title={rowTitle}
      expandLabel="▼"
      collapseLabel="▲"
      headerActions={deleteBtn}
      className={`!p-3 !rounded-xl transition-all ${borderClass}`}
      contentClassName="space-y-3 animate-in fade-in"
    >
      <ReceiptFeedRowDetails
        receipt={r}
        isPayslip={isPayslip}
        reprocessingId={reprocessingId}
        updatingItemId={updatingItemId}
        onReprocessReceipt={onReprocessReceipt}
        onReceiptLinked={onReceiptLinked}
        onUpdateReceiptItem={onUpdateReceiptItem}
      />
    </CollapsibleSection>
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
    <div data-testid={testId}>
      <KeyValueList items={[{ id: testId, label, value, mono: true }]} />
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
    <AlertBanner
      variant="warning"
      action={
        <Button
          variant="outline"
          size="xs"
          onClick={() => void onReprocessReceipt(receiptId)}
          disabled={isParsing}
          icon={<RefreshCw className={`w-3 h-3 text-amber-400 ${isParsing ? 'animate-spin' : ''}`} />}
        >
          {isParsing ? 'Parsing...' : 'Retry Parse'}
        </Button>
      }
    >
      Original photo saved; vision parsing pending.
    </AlertBanner>
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
    <div className="space-y-3">
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
