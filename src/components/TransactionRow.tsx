import React, { useState } from 'react';
import {
  ArrowRightLeft,
  Plus,
  Receipt as ReceiptIcon,
  RefreshCw,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { RecurrenceType, Transaction } from '../types';
import { isTransferCategory, RECURRENCE_OPTIONS } from '../constants/categories';
import { formatMoney, formatSignedTransactionAmount } from '../utils/format';

interface TransactionRowProps {
  transaction: Transaction;
  categories: readonly string[];
  updating: boolean;
  onCategoryChange: (txId: number, category: string) => void;
  onTagsChange?: (txId: number, tags: string[]) => void;
  onRecurrenceChange?: (txId: number, recurrence: RecurrenceType | null) => void;
  onCreateRule: (tx: Transaction) => void;
  showAccountBadge?: boolean;
  fallbackCurrency?: string;
  rowTestId?: string;
  selectTestId?: string;
  ruleBtnTestId?: string;
}

/**
 * Shared transaction row displaying date, account/receipt/transfer badges,
 * formatted amount, inline category selector, and rule builder trigger.
 */
export const TransactionRow: React.FC<TransactionRowProps> = ({
  transaction: tx,
  categories,
  updating,
  onCategoryChange,
  onTagsChange,
  onRecurrenceChange,
  onCreateRule,
  showAccountBadge = true,
  fallbackCurrency,
  rowTestId,
  selectTestId,
  ruleBtnTestId,
}) => {
  const isTransfer = isTransferCategory(tx.category, tx);
  const amt = Number(tx.amount);
  const isDebit = amt < 0;
  const txCurrency = tx.currency || fallbackCurrency || 'NZD';
  const formattedAmt = formatSignedTransactionAmount(amt, txCurrency);
  const hasLinkedTransfer = tx.linked_transaction_id != null;
  const hasFxRate = Boolean(tx.exchange_rate && tx.exchange_rate !== 1.0);
  const [addingTag, setAddingTag] = useState(false);
  const [tagDraft, setTagDraft] = useState('');
  const tags = tx.tags || [];

  const handleCommitTag = () => {
    const cleaned = tagDraft.trim().toLowerCase().replace(/^#+/, '').replace(/\s+/g, '-');
    if (cleaned && !tags.includes(cleaned) && onTagsChange) {
      onTagsChange(tx.id, [...tags, cleaned]);
    }
    setTagDraft('');
    setAddingTag(false);
  };

  const handleRemoveTag = (target: string) => {
    if (!onTagsChange) return;
    onTagsChange(
      tx.id,
      tags.filter((t) => t !== target)
    );
  };

  return (
    <div
      data-testid={rowTestId}
      className="p-3 bg-card/60 hover:bg-card/80 border border-border rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors"
    >
      {/* Left: Date, badges, merchant */}
      <div className="space-y-1 min-w-0 flex-1">
        <div className="flex items-center space-x-2 flex-wrap gap-y-1">
          <span className="text-[11px] font-mono text-slate-400">
            {tx.transaction_date}
          </span>
          {showAccountBadge && tx.account_name && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 font-medium">
              {tx.account_name}
            </span>
          )}
          {Boolean(tx.has_receipt) && (
            <span
              className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 font-medium flex items-center space-x-1"
              title="Matched Itemized Receipt"
            >
              <ReceiptIcon className="w-2.5 h-2.5" />
              <span>Receipt</span>
            </span>
          )}
          {(hasLinkedTransfer || isTransfer) && (
            <span
              className="text-[10px] px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30 font-medium flex items-center space-x-1"
              title={
                hasLinkedTransfer
                  ? hasFxRate
                    ? `Linked Transfer (Rate: ${tx.exchange_rate})`
                    : 'Linked Account Transfer'
                  : 'Inter-Account Transfer'
              }
            >
              <ArrowRightLeft className="w-2.5 h-2.5" />
              <span>
                {hasLinkedTransfer
                  ? hasFxRate
                    ? `FX (${tx.exchange_rate})`
                    : 'Transfer Linked'
                  : 'Transfer'}
              </span>
            </span>
          )}
          {Boolean(tx.fee_amount) && (
            <span
              className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 font-medium"
              title={`Transfer Fee: ${formatMoney(Number(tx.fee_amount), { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${txCurrency}`}
            >
              Fee: {formatMoney(Number(tx.fee_amount), { minimumFractionDigits: 0, maximumFractionDigits: 2 })} {txCurrency}
            </span>
          )}
        </div>

        <div
          className="text-xs font-semibold text-slate-200 truncate"
          title={tx.raw_description || tx.merchant}
        >
          {tx.merchant}
        </div>
        {tx.raw_description && tx.raw_description !== tx.merchant && (
          <div className="text-[11px] text-slate-500 truncate max-w-sm">
            {tx.raw_description}
          </div>
        )}
        {(tags.length > 0 || onTagsChange) && (
          <div className="flex items-center flex-wrap gap-1 pt-0.5">
            {tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20 text-[10px] font-medium"
              >
                <span>#{tag}</span>
                {onTagsChange && (
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(tag)}
                    disabled={updating}
                    aria-label={`Remove tag ${tag}`}
                    className="text-amber-400/70 hover:text-amber-200 transition-colors"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                )}
              </span>
            ))}
            {onTagsChange && !addingTag && (
              <button
                type="button"
                onClick={() => setAddingTag(true)}
                disabled={updating}
                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-slate-800/70 hover:bg-slate-800 text-slate-400 hover:text-amber-300 border border-border/70 text-[10px] transition-colors"
                data-testid={`add-tag-btn-${tx.id}`}
              >
                <Plus className="w-2.5 h-2.5" />
                <span>tag</span>
              </button>
            )}
            {onTagsChange && addingTag && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleCommitTag();
                }}
                className="inline-flex items-center gap-1"
              >
                <input
                  type="text"
                  value={tagDraft}
                  onChange={(e) => setTagDraft(e.target.value)}
                  onBlur={handleCommitTag}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      setTagDraft('');
                      setAddingTag(false);
                    }
                  }}
                  placeholder="badminton"
                  autoFocus
                  className="w-24 px-1.5 py-0.5 text-[10px] rounded bg-background border border-amber-500/50 text-slate-200 focus:outline-none"
                  data-testid={`tag-input-${tx.id}`}
                />
              </form>
            )}
          </div>
        )}
      </div>

      {/* Right: Amount & inline category selector */}
      <div className="flex items-center justify-between sm:justify-end space-x-3 shrink-0">
        <span
          className={`text-xs font-semibold font-mono ${
            isTransfer ? 'text-sky-300' : isDebit ? 'text-rose-400' : 'text-emerald-400'
          }`}
        >
          {formattedAmt}
        </span>

        <div className="flex items-center space-x-1.5">
          {onRecurrenceChange && (
            <select
              value={tx.recurrence || ''}
              onChange={(e) =>
                onRecurrenceChange(
                  tx.id,
                  (e.target.value || null) as RecurrenceType | null
                )
              }
              disabled={updating}
              aria-label={`Recurrence for ${tx.merchant}`}
              title="Payment frequency for weekly budget and runway burn"
              className="text-[11px] px-1.5 py-1 bg-background border border-border hover:border-amber-500/50 rounded-lg text-slate-300 focus:outline-none focus:border-amber-500 transition-colors disabled:opacity-50"
            >
              {RECURRENCE_OPTIONS.map((opt) => (
                <option key={opt.label} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          )}
          <select
            value={tx.category}
            onChange={(e) => onCategoryChange(tx.id, e.target.value)}
            disabled={updating}
            aria-label={`Category for ${tx.merchant}`}
            data-testid={selectTestId}
            className="text-[11px] px-2 py-1 bg-background border border-border hover:border-amber-500/50 rounded-lg text-slate-200 focus:outline-none focus:border-amber-500 transition-colors disabled:opacity-50"
          >
            {categories.map((choice) => (
              <option key={choice} value={choice}>
                {choice}
              </option>
            ))}
          </select>
          {updating ? (
            <RefreshCw className="w-3 h-3 animate-spin text-amber-400 shrink-0" />
          ) : (
            <button
              type="button"
              onClick={() => onCreateRule(tx)}
              className="p-1 rounded text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 transition-colors"
              title="Create categorization rule from this transaction"
              aria-label={`Create rule for ${tx.merchant}`}
              data-testid={ruleBtnTestId}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
