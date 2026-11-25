import React from 'react';
import { ExternalLink, FileText, RefreshCw } from 'lucide-react';
import { TagPillList } from '@yggdrasil-lab/ui';
import { useCategories } from '../../hooks/useCategories';
import { getReceiptImageUrl } from '../../transport';
import { Receipt, ReceiptItem } from '../../types';
import { formatReceiptAmount, isPayslipDocument } from '../../utils/receipts';

type UpdateReceiptItemFn = (
  receiptId: number,
  itemId: number,
  patch: { category?: string; tags?: string[] }
) => Promise<void>;

interface ReceiptItemsEditorProps {
  receipt: Receipt;
  updatingItemId?: number | null;
  onUpdateItem?: UpdateReceiptItemFn;
}

const DOMAIN_BADGE_LABELS: Record<string, string> = {
  '02-skin': 'Skin',
  '01-health': 'Health',
};

/**
 * Shared receipt attachment preview (image or PDF card) and itemized line-item editor.
 */
export const ReceiptItemsEditor: React.FC<ReceiptItemsEditorProps> = ({
  receipt: r,
  updatingItemId,
  onUpdateItem,
}) => {
  const { categoryNames } = useCategories();

  return (
    <div className="space-y-3">
      {Boolean(r.has_image) && <ReceiptAttachmentPreview receipt={r} />}

      {r.items && r.items.length > 0 && (
        <div className="space-y-2">
          <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
            Itemized Breakdown
          </div>
          <div className="space-y-1.5">
            {r.items.map((item) => (
              <ReceiptItemRow
                key={item.id}
                receiptId={r.id}
                currency={r.currency}
                item={item}
                categoryNames={categoryNames}
                isUpdating={updatingItemId === item.id}
                onUpdateItem={onUpdateItem}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

function resolveAttachmentHeader(isPdf: boolean, isPayslip: boolean): string {
  if (isPdf) {
    return isPayslip ? 'Stored Payslip Document' : 'Stored Receipt Document';
  }
  return isPayslip ? 'Stored Payslip Image' : 'Stored Receipt Image';
}

function ReceiptAttachmentPreview({ receipt: r }: { receipt: Receipt }) {
  const isPdf =
    r.image_mime_type === 'application/pdf' ||
    Boolean(r.image_filename?.toLowerCase().endsWith('.pdf'));
  const isPayslip = isPayslipDocument(r.document_type);
  const attachmentUrl = getReceiptImageUrl(r.id);
  const canRenderImage =
    !isPdf && (!r.image_mime_type || r.image_mime_type.startsWith('image/'));

  return (
    <div className="space-y-1.5" data-testid={`receipt-attachment-preview-${r.id}`}>
      <div className="flex items-center justify-between gap-2 text-[11px] font-medium text-slate-400 uppercase tracking-wider">
        <span>{resolveAttachmentHeader(isPdf, isPayslip)}</span>
        <a
          href={attachmentUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-amber-400 hover:text-amber-300 normal-case shrink-0"
        >
          <span>{isPdf ? 'Open PDF' : 'Open full size'}</span>
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>
      {isPdf ? (
        <PdfReceiptCard url={attachmentUrl} filename={r.image_filename} isPayslip={isPayslip} />
      ) : (
        canRenderImage && (
          <div className="rounded-lg border border-border/60 bg-background/60 overflow-hidden max-h-56 flex items-center justify-center">
            <img
              src={attachmentUrl}
              alt={r.image_filename || `${r.merchant} ${isPayslip ? 'payslip' : 'receipt'}`}
              className="max-h-56 w-auto object-contain"
              loading="lazy"
            />
          </div>
        )
      )}
    </div>
  );
}

function PdfReceiptCard({
  url,
  filename,
  isPayslip = false,
}: {
  url: string;
  filename?: string | null;
  isPayslip?: boolean;
}) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      data-testid="receipt-pdf-card"
      className="flex items-center justify-between gap-3 p-3 min-h-[44px] rounded-lg border border-border/70 bg-background/60 hover:bg-card/80 hover:border-amber-500/40 transition-colors group"
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="w-9 h-9 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0 text-amber-400">
          <FileText className="w-4 h-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-xs font-medium text-slate-100 truncate">
            {filename || (isPayslip ? 'Payslip PDF' : 'Receipt PDF')}
          </div>
          <div className="text-[11px] text-slate-400">PDF Document</div>
        </div>
      </div>
      <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-amber-400 shrink-0 transition-colors" />
    </a>
  );
}

interface ReceiptItemRowProps {
  receiptId: number;
  currency: string;
  item: ReceiptItem;
  categoryNames: string[];
  isUpdating: boolean;
  onUpdateItem?: UpdateReceiptItemFn;
}

function ReceiptItemRow({
  receiptId,
  currency,
  item,
  categoryNames,
  isUpdating,
  onUpdateItem,
}: ReceiptItemRowProps) {
  return (
    <div
      data-testid={`receipt-item-row-${item.id}`}
      className="p-2.5 bg-background/60 rounded-lg border border-border/50 space-y-2 text-xs"
    >
      <ReceiptItemHeader item={item} currency={currency} />
      <ReceiptItemFooter
        receiptId={receiptId}
        item={item}
        categoryNames={categoryNames}
        isUpdating={isUpdating}
        onUpdateItem={onUpdateItem}
      />
    </div>
  );
}

function ReceiptItemHeader({ item, currency }: { item: ReceiptItem; currency: string }) {
  const hasDiscount = Boolean(item.discount_amount && Number(item.discount_amount) > 0);
  return (
    <div className="flex items-start justify-between gap-2">
      <div className="space-y-1 min-w-0 flex-1">
        <div className="font-medium text-slate-200 truncate">{item.item_name}</div>
        <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-slate-400">
          {Boolean(item.brand) && <span className="font-semibold text-slate-300">{item.brand}</span>}
          {Boolean(item.volume_ml) && (
            <span className="px-1 rounded bg-slate-800 text-slate-300">{item.volume_ml}</span>
          )}
          {Boolean(item.domain) && (
            <span className="px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20">
              {DOMAIN_BADGE_LABELS[item.domain!] || item.domain}
            </span>
          )}
        </div>
      </div>
      <ReceiptItemPrice item={item} currency={currency} hasDiscount={hasDiscount} />
    </div>
  );
}

function ReceiptItemPrice({
  item,
  currency,
  hasDiscount,
}: {
  item: ReceiptItem;
  currency: string;
  hasDiscount: boolean;
}) {
  return (
    <div className="text-right shrink-0">
      <div className="font-mono font-medium text-slate-100">
        {formatReceiptAmount(Number(item.total_price), currency)}
      </div>
      {hasDiscount ? (
        <div className="text-[10px] text-emerald-400 font-mono">
          Reg. {formatReceiptAmount(Number(item.unit_price), currency)} (-
          {formatReceiptAmount(Number(item.discount_amount), currency)})
        </div>
      ) : (
        item.quantity > 1 && (
          <div className="text-[10px] text-slate-400">
            {item.quantity}x @ {formatReceiptAmount(Number(item.unit_price), currency)}
          </div>
        )
      )}
    </div>
  );
}

type ReceiptItemFooterProps = Omit<ReceiptItemRowProps, 'currency'>;

function ReceiptItemFooter({
  receiptId,
  item,
  categoryNames,
  isUpdating,
  onUpdateItem,
}: ReceiptItemFooterProps) {
  return (
    <div className="flex items-center justify-between gap-2 flex-wrap pt-1 border-t border-border/40">
      <ReceiptItemTags
        receiptId={receiptId}
        item={item}
        isUpdating={isUpdating}
        onUpdateItem={onUpdateItem}
      />
      {onUpdateItem && (
        <ReceiptItemCategorySelect
          receiptId={receiptId}
          item={item}
          categoryNames={categoryNames}
          isUpdating={isUpdating}
          onUpdateItem={onUpdateItem}
        />
      )}
    </div>
  );
}

type ReceiptItemTagsProps = Omit<ReceiptItemRowProps, 'currency' | 'categoryNames'>;

function ReceiptItemTags({ receiptId, item, isUpdating, onUpdateItem }: ReceiptItemTagsProps) {
  const itemTags = item.tags || [];
  const inheritedTags = (item.inherited_tags || []).filter((t) => !itemTags.includes(t));
  const handleAdd = onUpdateItem
    ? (tag: string) => void onUpdateItem(receiptId, item.id, { tags: [...itemTags, tag] })
    : undefined;
  const handleRemove = onUpdateItem
    ? (target: string) =>
        void onUpdateItem(receiptId, item.id, { tags: itemTags.filter((t) => t !== target) })
    : undefined;

  return (
    <div className="flex flex-wrap items-center gap-1 min-w-0 flex-1">
      {inheritedTags.map((tag) => (
        <span
          key={`inherited-${tag}`}
          title="Inherited from main transaction"
          data-testid={`inherited-item-tag-${item.id}-${tag}`}
          className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-slate-800/90 text-slate-300 border border-slate-600/60"
        >
          #{tag}
        </span>
      ))}
      <TagPillList
        tags={itemTags}
        disabled={isUpdating || !onUpdateItem}
        variant="amber"
        placeholder="tag"
        addButtonTestId={`add-item-tag-btn-${item.id}`}
        inputTestId={`item-tag-input-${item.id}`}
        onAddTag={handleAdd}
        onRemoveTag={handleRemove}
      />
    </div>
  );
}

function ReceiptItemCategorySelect({
  receiptId,
  item,
  categoryNames,
  isUpdating,
  onUpdateItem,
}: Omit<ReceiptItemRowProps, 'currency' | 'onUpdateItem'> & {
  onUpdateItem: UpdateReceiptItemFn;
}) {
  const categories = categoryNames.includes(item.category)
    ? categoryNames
    : [item.category, ...categoryNames];

  return (
    <div className="flex items-center space-x-1.5 shrink-0">
      <select
        value={item.category}
        onChange={(e) => void onUpdateItem(receiptId, item.id, { category: e.target.value })}
        disabled={isUpdating}
        aria-label={`Category for ${item.item_name}`}
        data-testid={`receipt-item-category-${item.id}`}
        className="text-[11px] px-2 py-1 bg-card border border-border hover:border-amber-500/50 rounded-lg text-slate-200 focus:outline-none focus:border-amber-500 transition-colors disabled:opacity-50"
      >
        {categories.map((choice) => (
          <option key={choice} value={choice}>
            {choice}
          </option>
        ))}
      </select>
      {isUpdating && <RefreshCw className="w-3 h-3 animate-spin text-amber-400 shrink-0" />}
    </div>
  );
}
