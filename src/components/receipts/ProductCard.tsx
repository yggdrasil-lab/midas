import React, { useState } from 'react';
import {
  Calendar,
  ChevronDown,
  ChevronUp,
  Clock,
  Edit3,
  Save,
  Star,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { Button, TagPillList } from '@yggdrasil-lab/ui';
import { Product } from '../../types';
import { formatMoney } from '../../utils/format';

interface ProductCardProps {
  product: Product;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onToggleFavorite: (product: Product) => Promise<void>;
  onSaveNote: (productId: number, note: string) => Promise<void>;
  onAddTag: (productId: number, tag: string) => Promise<void>;
  onRemoveTag: (productId: number, tag: string) => Promise<void>;
}

const DOMAIN_LABELS: Record<string, string> = {
  '02-skin': 'Skin',
  '01-health': 'Health',
};

/**
 * Product inventory card with favorite star, tags, longevity projection,
 * inline notes editor, and expandable price history timeline.
 */
export const ProductCard: React.FC<ProductCardProps> = ({
  product: p,
  isExpanded,
  onToggleExpand,
  onToggleFavorite,
  onSaveNote,
  onAddTag,
  onRemoveTag,
}) => {
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [noteDraft, setNoteDraft] = useState(p.notes || '');
  const [savingNote, setSavingNote] = useState(false);

  const hasPriceChange =
    p.price_change_latest !== null && p.price_change_latest !== undefined;
  const isPriceUp = hasPriceChange && (p.price_change_latest || 0) > 0;
  const isPriceDown = hasPriceChange && (p.price_change_latest || 0) < 0;

  const submitNote = async () => {
    setSavingNote(true);
    try {
      await onSaveNote(p.id, noteDraft);
      setIsEditingNote(false);
    } finally {
      setSavingNote(false);
    }
  };

  return (
    <div className="p-3 bg-card/60 hover:bg-card/80 border border-border rounded-xl space-y-2.5 transition-all">
      {/* Product Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-0.5 min-w-0">
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => void onToggleFavorite(p)}
              className="text-slate-400 hover:text-amber-400 transition-colors"
              title={p.is_favorite ? 'Favorited' : 'Add to favorites'}
            >
              <Star
                className={`w-3.5 h-3.5 ${
                  p.is_favorite ? 'fill-amber-400 text-amber-400' : 'text-slate-500'
                }`}
              />
            </button>
            <span className="text-xs font-bold text-slate-100 truncate">{p.name}</span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-slate-400">
            {p.brand && <span className="font-semibold text-slate-300">{p.brand}</span>}
            {p.volume_ml && <span className="text-slate-400">({p.volume_ml})</span>}
            {p.domain && (
              <span className="px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20 font-medium">
                {DOMAIN_LABELS[p.domain] || p.domain}
              </span>
            )}
            <span>
              • {p.purchase_count} {p.purchase_count === 1 ? 'purchase' : 'purchases'}
            </span>
          </div>
        </div>

        {/* Price & Fluctuation Badge */}
        <div className="text-right shrink-0 space-y-0.5">
          <div className="flex items-center justify-end space-x-1.5">
            <span className="text-xs font-bold font-mono text-slate-100">
              {formatMoney(p.latest_price ?? 0, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
            {hasPriceChange && (
              <span
                className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold flex items-center border ${
                  isPriceUp
                    ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                    : isPriceDown
                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                    : 'bg-slate-700 text-slate-300 border-slate-600'
                }`}
              >
                {isPriceUp ? (
                  <TrendingUp className="w-2.5 h-2.5 mr-0.5 text-rose-400" />
                ) : (
                  <TrendingDown className="w-2.5 h-2.5 mr-0.5 text-emerald-400" />
                )}
                {isPriceUp
                  ? `+${p.price_change_latest?.toFixed(2)}`
                  : p.price_change_latest?.toFixed(2)}
              </span>
            )}
          </div>
          <div className="text-[10px] text-slate-400 font-mono">
            Total Spent:{' '}
            {formatMoney(p.total_spent, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </div>
        </div>
      </div>

      {/* Tag Pill Badges & Add Tag */}
      <TagPillList
        tags={p.tags}
        variant="slate"
        placeholder="tag..."
        onAddTag={(tag) => onAddTag(p.id, tag)}
        onRemoveTag={(tag) => onRemoveTag(p.id, tag)}
        className="pt-0.5"
      />

      {/* Longevity & Restock Projection */}
      <div className="p-2 bg-background/80 rounded-lg border border-border/60 flex flex-col sm:flex-row sm:items-center justify-between text-[11px] gap-2">
        <div className="flex items-center space-x-1.5 text-slate-300">
          <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span>
            {p.avg_days_between_purchases
              ? `Usage Longevity: ~${p.avg_days_between_purchases} days per unit`
              : p.first_purchased
              ? `First recorded: ${p.first_purchased}`
              : 'Single purchase recorded'}
          </span>
        </div>

        {p.estimated_depletion_date && (
          <div className="flex items-center space-x-1.5 text-emerald-300 font-medium">
            <Calendar className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>Est. Restock: {p.estimated_depletion_date}</span>
          </div>
        )}
      </div>

      {/* User Notes & Observations */}
      <div className="p-2 bg-card/40 rounded-lg border border-border/50 text-xs space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">
            Notes & Observations
          </span>
          {!isEditingNote && (
            <button
              type="button"
              onClick={() => {
                setNoteDraft(p.notes || '');
                setIsEditingNote(true);
              }}
              className="text-[11px] text-amber-400 hover:text-amber-300 flex items-center space-x-1"
            >
              <Edit3 className="w-3 h-3" />
              <span>{p.notes ? 'Edit' : 'Add Note'}</span>
            </button>
          )}
        </div>

        {isEditingNote ? (
          <div className="space-y-2 pt-1">
            <textarea
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
              placeholder="Write impressions, skin reactions, usage instructions, or reasons for buying..."
              rows={2}
              className="w-full p-2 text-xs bg-background border border-amber-500/40 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none"
            />
            <div className="flex justify-end space-x-2">
              <Button
                variant="outline"
                size="xs"
                onClick={() => setIsEditingNote(false)}
                disabled={savingNote}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="xs"
                onClick={() => void submitNote()}
                disabled={savingNote}
                icon={<Save className="w-3 h-3" />}
              >
                {savingNote ? 'Saving...' : 'Save Note'}
              </Button>
            </div>
          </div>
        ) : p.notes ? (
          <p className="text-slate-300 text-xs italic bg-background/40 p-2 rounded border border-border/40">
            {p.notes}
          </p>
        ) : (
          <p className="text-slate-500 text-[11px] italic">
            No notes added yet. Click &quot;Add Note&quot; to keep observations about this product.
          </p>
        )}
      </div>

      {/* Expandable Price History Timeline */}
      {p.price_history && p.price_history.length > 0 && (
        <div>
          <button
            type="button"
            onClick={onToggleExpand}
            className="text-[11px] text-slate-400 hover:text-slate-200 flex items-center space-x-1 transition-colors"
          >
            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            <span>
              {isExpanded
                ? 'Hide Price Timeline'
                : `View Price History (${p.price_history.length} purchases)`}
            </span>
          </button>

          {isExpanded && (
            <div className="mt-2 space-y-1.5 pt-2 border-t border-border/40 animate-in fade-in">
              {p.price_history.map((pt, idx) => (
                <div
                  key={idx}
                  className="p-1.5 bg-background/60 rounded border border-border/40 flex items-center justify-between text-[11px]"
                >
                  <div className="space-y-0.5">
                    <div className="font-mono text-slate-300 font-medium">{pt.date}</div>
                    <div className="text-slate-400 text-[10px]">{pt.merchant}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono font-bold text-slate-100">
                      {formatMoney(pt.unit_price, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </div>
                    {pt.discount_amount && Number(pt.discount_amount) > 0 && (
                      <div className="text-[10px] text-emerald-400 font-mono">
                        -
                        {formatMoney(Number(pt.discount_amount), {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}{' '}
                        disc. (paid{' '}
                        {formatMoney(pt.total_price, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                        )
                      </div>
                    )}
                    {pt.quantity > 1 && (
                      <div className="text-[10px] text-slate-400">
                        Qty: {pt.quantity} (
                        {formatMoney(pt.total_price, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                        )
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
