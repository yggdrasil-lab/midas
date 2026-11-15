import React from 'react';
import {
  ArrowRightLeft,
  Receipt as ReceiptIcon,
  RefreshCw,
  SlidersHorizontal,
} from 'lucide-react';
import { Transaction } from '../types';
import { isTransferCategory } from '../constants/categories';
import { formatMoney, formatSignedTransactionAmount } from '../utils/format';

interface TransactionRowProps {
  transaction: Transaction;
  categories: readonly string[];
  updating: boolean;
  onCategoryChange: (txId: number, category: string) => void;
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
  const txCurrency = tx.currency || fallbackCurrency;
  const formattedAmt = formatSignedTransactionAmount(amt, txCurrency);
  const hasLinkedTransfer = tx.linked_transaction_id != null;
  const hasFxRate = Boolean(tx.exchange_rate && tx.exchange_rate !== 1.0);

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
              title={`Transfer Fee: ${formatMoney(Number(tx.fee_amount), { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            >
              Fee: {formatMoney(Number(tx.fee_amount), { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
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
