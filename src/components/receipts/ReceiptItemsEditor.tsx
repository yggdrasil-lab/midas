import React from 'react';
import { ExternalLink, RefreshCw } from 'lucide-react';
import { TagPillList } from '@yggdrasil-lab/ui';
import { CATEGORY_CHOICES } from '../../constants/categories';
import { getReceiptImageUrl } from '../../services/api';
import { Receipt } from '../../types';
import { formatMoney } from '../../utils/format';

interface ReceiptItemsEditorProps {
  receipt: Receipt;
  updatingItemId?: number | null;
  onUpdateItem?: (
    receiptId: number,
    itemId: number,
    patch: { category?: string; tags?: string[] }
  ) => Promise<void>;
}

const DOMAIN_BADGE_LABELS: Record<string, string> = {
  '02-skin': 'Skin',
  '01-health': 'Health',
};

/**
 * Shared receipt image preview and itemized line-item editor (category + interface tags).
 */
export const ReceiptItemsEditor: React.FC<ReceiptItemsEditorProps> = ({
  receipt: r,
  updatingItemId,
  onUpdateItem,
}) => {
  return (
    <div className="space-y-3">
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
            <div className="rounded-lg border border-border/60 bg-background/60 overflow-hidden max-h-56 flex items-center justify-center">
              <img
                src={getReceiptImageUrl(r.id)}
                alt={r.image_filename || `${r.merchant} receipt`}
                className="max-h-56 w-auto object-contain"
                loading="lazy"
              />
            </div>
          )}
        </div>
      )}

      {r.items && r.items.length > 0 && (
        <div className="space-y-2">
          <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
            Itemized Breakdown
          </div>
          <div className="space-y-1.5">
            {r.items.map((item) => {
              const isUpdating = updatingItemId === item.id;
              const itemTags = item.tags || [];
              const inheritedTags = (item.inherited_tags || []).filter(
                (t) => !itemTags.includes(t)
              );
              const categories = CATEGORY_CHOICES.includes(
                item.category as (typeof CATEGORY_CHOICES)[number]
              )
                ? CATEGORY_CHOICES
                : ([item.category, ...CATEGORY_CHOICES] as const);

              return (
                <div
                  key={item.id}
                  data-testid={`receipt-item-row-${item.id}`}
                  className="p-2.5 bg-background/60 rounded-lg border border-border/50 space-y-2 text-xs"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1 min-w-0 flex-1">
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
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="font-mono font-medium text-slate-100">
                        {formatMoney(Number(item.total_price), {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </div>
                      {item.discount_amount && Number(item.discount_amount) > 0 ? (
                        <div className="text-[10px] text-emerald-400 font-mono">
                          Reg.{' '}
                          {formatMoney(Number(item.unit_price), {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}{' '}
                          (-
                          {formatMoney(Number(item.discount_amount), {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                          )
                        </div>
                      ) : (
                        item.quantity > 1 && (
                          <div className="text-[10px] text-slate-400">
                            {item.quantity}x @{' '}
                            {formatMoney(Number(item.unit_price), {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </div>
                        )
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 flex-wrap pt-1 border-t border-border/40">
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
                        onAddTag={
                          onUpdateItem
                            ? (tag) => void onUpdateItem(r.id, item.id, { tags: [...itemTags, tag] })
                            : undefined
                        }
                        onRemoveTag={
                          onUpdateItem
                            ? (target) =>
                                void onUpdateItem(r.id, item.id, {
                                  tags: itemTags.filter((t) => t !== target),
                                })
                            : undefined
                        }
                      />
                    </div>

                    {onUpdateItem && (
                      <div className="flex items-center space-x-1.5 shrink-0">
                        <select
                          value={item.category}
                          onChange={(e) =>
                            void onUpdateItem(r.id, item.id, { category: e.target.value })
                          }
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
                        {isUpdating && (
                          <RefreshCw className="w-3 h-3 animate-spin text-amber-400 shrink-0" />
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
