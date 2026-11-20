import React, { useState } from 'react';
import {
  ArrowRight,
  ArrowRightLeft,
  Car,
  Landmark,
  Receipt as ReceiptIcon,
  RefreshCw,
  Repeat,
  SlidersHorizontal,
  Split,
} from 'lucide-react';
import { TagPillList } from '@yggdrasil-lab/ui';
import { LoanItem, RecurrenceType, Transaction } from '../types';
import { isTransferCategory, RECURRENCE_OPTIONS } from '../constants/categories';
import {
  formatMoney,
  formatSignedTransactionAmount,
  formatTransactionFee,
  getTransactionNzdAmount,
  isCryptoCurrency,
} from '../utils/format';
import {
  areLegacyPositiveOutflowSplits,
  hasValidSplitLines,
  resolveParentTransactionAmount,
} from '../utils/splits';

const RECURRENCE_UNIT_LABELS: Record<string, string> = {
  annual: 'yr',
  quarterly: 'qtr',
  monthly: 'mo',
  fortnightly: '2w',
  weekly: 'wk',
};

function formatRecurrenceLabel(recurrence?: string | null): string {
  const normalized = (recurrence || '').trim().toLowerCase();
  if (!normalized) return 'Recurring';
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

interface TransactionRowProps {
  transaction: Transaction;
  categories: readonly string[];
  updating: boolean;
  onCategoryChange: (txId: number, category: string) => void;
  onTagsChange?: (txId: number, tags: string[]) => void;
  onRecurrenceChange?: (txId: number, recurrence: RecurrenceType | null) => void;
  loans?: LoanItem[];
  onLoanChange?: (
    txId: number,
    loanId: number | null,
    loanPaymentAmount?: number | null
  ) => void;
  onCreateRule: (tx: Transaction) => void;
  onOpenReceipt?: (receiptId: number) => void;
  onOpenSplit?: (tx: Transaction) => void;
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
  loans,
  onLoanChange,
  onCreateRule,
  onOpenReceipt,
  onOpenSplit,
  showAccountBadge = true,
  fallbackCurrency,
  rowTestId,
  selectTestId,
  ruleBtnTestId,
}) => {
  const isTransfer = isTransferCategory(tx.category, tx);
  const isAmortized = Boolean(
    tx.is_amortized_commitment && tx.amortized_period_amount_nzd != null
  );
  const isExcluded = Boolean(tx.excluded_from_period_budget && !isAmortized);
  const amt = Number(tx.amount);
  const isDebit = amt < 0;
  const txCurrency = tx.currency || fallbackCurrency || 'NZD';
  const parentAmt = resolveParentTransactionAmount(
    tx,
    isCryptoCurrency(txCurrency) ? 8 : 2
  );
  const formattedAmt = formatSignedTransactionAmount(amt, txCurrency);
  const amortizedUnit = tx.amortized_cadence === 'week' ? 'wk' : 'mo';
  const amortizedAmtFormatted = isAmortized
    ? `-${formatMoney(Math.abs(Number(tx.amortized_period_amount_nzd)), {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })} NZD/${amortizedUnit}`
    : '';
  const originUnit =
    RECURRENCE_UNIT_LABELS[(tx.recurrence || '').trim().toLowerCase()] || 'cycle';
  const originSummary = isAmortized
    ? txCurrency.toUpperCase() !== 'NZD'
      ? `From ${txCurrency.toUpperCase()} ${Math.abs(amt).toFixed(2)} (${formatMoney(
          getTransactionNzdAmount(tx),
          { minimumFractionDigits: 2, maximumFractionDigits: 2 }
        )} NZD/${originUnit})`
      : `From ${formatMoney(Math.abs(amt), {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })} NZD/${originUnit}`
    : '';
  const hasLinkedTransfer = tx.linked_transaction_id != null;
  const hasFxRate = Boolean(tx.exchange_rate && tx.exchange_rate !== 1.0);
  const formattedFxRate = hasFxRate
    ? new Intl.NumberFormat('en-US', {
        minimumFractionDigits: Number(tx.exchange_rate) >= 100 ? 2 : 0,
        maximumFractionDigits: Number(tx.exchange_rate) >= 100 ? 2 : 6,
      }).format(Number(tx.exchange_rate))
    : '';
  const linkedCounterpartName = tx.linked_account_name || tx.counterpart_account_name;
  const transferFromAccount = isDebit
    ? tx.account_name || 'Source Account'
    : linkedCounterpartName || 'Source Account';
  const transferToAccount = isDebit
    ? linkedCounterpartName || 'Destination Account'
    : tx.account_name || 'Destination Account';
  const hasCrossCurrencyLeg =
    hasLinkedTransfer &&
    tx.linked_amount != null &&
    tx.linked_currency &&
    tx.linked_currency !== txCurrency;
  const isLinkedBtc = (tx.linked_currency || '').toUpperCase() === 'BTC';
  const isDebtAndLoansCategory = (tx.category || '').trim().toLowerCase() === 'debt & loans';
  const isSplit = hasValidSplitLines(tx);
  const rawSplits = tx.splits || [];
  const legacyPositiveOutflowSplits = areLegacyPositiveOutflowSplits(tx);
  const effectiveSplits = isSplit
    ? rawSplits.map((s) => ({
        ...s,
        signedAmount: legacyPositiveOutflowSplits
          ? -Math.abs(Number(s.amount))
          : Number(s.amount),
      }))
    : [];
  const hasMixedSplitSigns =
    effectiveSplits.some((s) => s.signedAmount > 0) &&
    effectiveSplits.some((s) => s.signedAmount < 0);
  const selectableLoans = (loans || []).filter((loan) => {
    if (!loan.is_active && loan.id !== tx.loan_id) return false;
    if (amt < 0) return true;
    return loan.loan_type === 'lent' || loan.id === tx.loan_id;
  });
  const showLoanSelector = Boolean(
    !isSplit &&
      onLoanChange &&
      loans &&
      loans.length > 0 &&
      !hasLinkedTransfer &&
      (isDebtAndLoansCategory || tx.loan_id != null)
  );
  const splitLoanEntries = isSplit
    ? effectiveSplits
        .map((s) => {
          const matchedLoan = s.loan_id != null ? loans?.find((l) => l.id === s.loan_id) : undefined;
          const resolvedName = s.loan_name || matchedLoan?.name || null;
          const resolvedType = s.loan_type || matchedLoan?.loan_type || 'borrowed';
          if (s.loan_id == null || !resolvedName) return null;
          return {
            key: `split-${s.id}`,
            loanName: resolvedName,
            loanType: resolvedType,
            paymentAmount: Math.abs(s.signedAmount),
            flowSignAmt: s.signedAmount,
          };
        })
        .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
    : [];
  const stackControls = showLoanSelector || isSplit;
  const [editingLoanAmt, setEditingLoanAmt] = useState(false);
  const [loanAmtDraft, setLoanAmtDraft] = useState('');
  const resolvedLoanType =
    tx.loan_type || loans?.find((l) => l.id === tx.loan_id)?.loan_type || 'borrowed';
  const tags = tx.tags || [];

  const renderLoanFlowPill = (
    key: string,
    testId: string,
    loanName: string,
    loanType: 'borrowed' | 'lent',
    paymentAmount: number | null | undefined,
    flowSignAmt: number = amt
  ) => {
    const isLent = loanType === 'lent';
    const isRepayment = isLent && flowSignAmt > 0;
    const isDisbursement = isLent && flowSignAmt < 0;
    const isCrypto = isCryptoCurrency(txCurrency);
    const maxDigits = isCrypto ? 8 : 2;
    const currencySymbol = isCrypto ? '' : '$';
    const amtNum = Number(paymentAmount);
    const exceedsNetParent =
      paymentAmount != null && Math.abs(amtNum) > Math.abs(parentAmt) + 0.005;
    return (
      <div
        key={key}
        className={`inline-flex items-center gap-1.5 flex-wrap px-2 py-1 rounded-lg border text-[11px] ${
          isRepayment
            ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-200'
            : isDisbursement
              ? 'bg-amber-500/10 border-amber-500/25 text-amber-200'
              : 'bg-rose-500/10 border-rose-500/25 text-rose-200'
        }`}
        data-testid={testId}
      >
        {isLent ? (
          <Landmark
            className={`w-3 h-3 shrink-0 ${
              isRepayment ? 'text-emerald-400' : 'text-amber-400'
            }`}
          />
        ) : (
          <Car className="w-3 h-3 text-rose-400 shrink-0" />
        )}
        <span
          className="font-semibold truncate max-w-[160px]"
          title={isRepayment ? loanName : tx.account_name || 'Account'}
        >
          {isRepayment ? loanName : tx.account_name || 'Account'}
        </span>
        <ArrowRight
          className={`w-3 h-3 shrink-0 ${
            isRepayment
              ? 'text-emerald-400'
              : isDisbursement
                ? 'text-amber-400'
                : 'text-rose-400'
          }`}
        />
        <span
          className="font-semibold truncate max-w-[160px]"
          title={isRepayment ? tx.account_name || 'Account' : loanName}
        >
          {isRepayment ? tx.account_name || 'Account' : loanName}
        </span>
        <span
          className={`text-[10px] px-1 py-0.2 rounded border font-medium whitespace-nowrap ${
            isRepayment
              ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-200'
              : isDisbursement
                ? 'bg-amber-500/20 border-amber-500/30 text-amber-200'
                : 'bg-rose-500/20 border-rose-500/30 text-rose-200'
          }`}
        >
          {isRepayment ? 'Repayment' : isDisbursement ? 'Lent' : 'Loan'}
        </span>
        {paymentAmount != null && (
          <span
            className={`text-[10px] font-mono whitespace-nowrap ${
              isRepayment
                ? 'text-emerald-300/90'
                : isDisbursement
                  ? 'text-amber-300/90'
                  : 'text-rose-300/90'
            }`}
          >
            {exceedsNetParent ? (
              <>
                {formatMoney(amtNum, {
                  currency: currencySymbol,
                  minimumFractionDigits: 2,
                  maximumFractionDigits: maxDigits,
                })}{' '}
                (from{' '}
                {formatMoney(parentAmt, {
                  currency: currencySymbol,
                  minimumFractionDigits: 2,
                  maximumFractionDigits: maxDigits,
                  showPlusSign: true,
                })}{' '}
                net)
              </>
            ) : (
              <>
                (
                {formatMoney(amtNum, {
                  currency: currencySymbol,
                  minimumFractionDigits: 2,
                  maximumFractionDigits: maxDigits,
                })}{' '}
                of{' '}
                {formatMoney(Math.abs(parentAmt), {
                  currency: currencySymbol,
                  minimumFractionDigits: 2,
                  maximumFractionDigits: maxDigits,
                })}
                )
              </>
            )}
          </span>
        )}
      </div>
    );
  };

  const rowContainerClasses = isAmortized
    ? 'bg-sky-950/15 hover:bg-sky-950/25 border-sky-500/30'
    : isExcluded
      ? 'bg-card/30 hover:bg-card/50 border-border/60 opacity-80'
      : hasLinkedTransfer
        ? 'bg-sky-950/20 hover:bg-sky-950/30 border-sky-500/30'
        : 'bg-card/60 hover:bg-card/80 border-border';

  return (
    <div
      data-testid={rowTestId}
      className={`p-3 rounded-xl flex flex-col ${
        stackControls ? 'gap-2.5' : 'sm:flex-row sm:items-center justify-between gap-3'
      } transition-colors border ${rowContainerClasses}`}
    >
      {/* Left: Date, badges, merchant */}
      <div className="space-y-1 min-w-0 flex-1">
        <div className="flex items-center space-x-2 flex-wrap gap-y-1">
          <span className="text-[11px] font-mono text-slate-400">
            {isAmortized ? `Last charged ${tx.transaction_date}` : tx.transaction_date}
          </span>
          {showAccountBadge && tx.account_name && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 font-medium">
              {tx.account_name}
            </span>
          )}
          {isAmortized && (
            <span
              data-testid={`amortized-badge-${tx.id}`}
              className="text-[10px] px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-300 border border-sky-500/30 font-medium flex items-center space-x-1"
              title="Recurring commitment amortized into this period's spending breakdown"
            >
              <Repeat className="w-2.5 h-2.5" />
              <span>{formatRecurrenceLabel(tx.recurrence)} amortized</span>
            </span>
          )}
          {isExcluded && (
            <span
              data-testid={`excluded-budget-badge-${tx.id}`}
              className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800/90 text-slate-400 border border-slate-700 font-medium"
              title="Excluded from this period's category budget total"
            >
              {tx.recurrence === 'one-off' ? 'One-off (excluded)' : 'Excluded from budget'}
            </span>
          )}
          {Boolean(tx.has_receipt) && (
            tx.receipt_id && onOpenReceipt ? (
              <button
                type="button"
                onClick={() => onOpenReceipt(tx.receipt_id!)}
                data-testid={`open-receipt-${tx.id}`}
                className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 font-medium flex items-center space-x-1 transition-colors cursor-pointer whitespace-nowrap"
                title="Inspect receipt items, categories, tags & photo"
              >
                <ReceiptIcon className="w-2.5 h-2.5" />
                <span>{tx.is_receipt_split ? 'Receipt Split' : 'Receipt'}</span>
              </button>
            ) : (
              <span
                className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 font-medium flex items-center space-x-1 whitespace-nowrap"
                title="Matched Itemized Receipt"
              >
                <ReceiptIcon className="w-2.5 h-2.5" />
                <span>{tx.is_receipt_split ? 'Receipt Split' : 'Receipt'}</span>
              </span>
            )
          )}
          {isSplit &&
            (onOpenSplit ? (
              <button
                type="button"
                onClick={() => onOpenSplit(tx)}
                data-testid={`open-split-badge-${tx.id}`}
                className="text-[10px] px-1.5 py-0.5 rounded bg-violet-500/15 hover:bg-violet-500/25 text-violet-300 border border-violet-500/30 font-medium flex items-center space-x-1 transition-colors cursor-pointer whitespace-nowrap"
                title="Inspect or edit manual transaction splits"
              >
                <Split className="w-2.5 h-2.5" />
                <span>Split ({tx.splits!.length})</span>
              </button>
            ) : (
              <span
                data-testid={`open-split-badge-${tx.id}`}
                className="text-[10px] px-1.5 py-0.5 rounded bg-violet-500/15 text-violet-300 border border-violet-500/30 font-medium flex items-center space-x-1 whitespace-nowrap"
              >
                <Split className="w-2.5 h-2.5" />
                <span>Split ({tx.splits!.length})</span>
              </span>
            ))}
          {(hasLinkedTransfer || isTransfer) && (
            <span
              className="text-[10px] px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30 font-medium flex items-center space-x-1"
              title={
                hasLinkedTransfer
                  ? hasFxRate
                    ? `Linked Transfer (Rate: ${formattedFxRate})`
                    : 'Linked Account Transfer'
                  : 'Inter-Account Transfer'
              }
            >
              <ArrowRightLeft className="w-2.5 h-2.5" />
              <span>
                {hasLinkedTransfer
                  ? hasFxRate
                    ? `FX (${formattedFxRate})`
                    : 'Transfer Linked'
                  : 'Transfer'}
              </span>
            </span>
          )}
          {tx.fee_amount != null && Number(tx.fee_amount) > 0 && (
            <span
              data-testid={`tx-fee-${tx.id}`}
              className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 font-medium"
              title={`Transfer Fee: ${formatTransactionFee(Number(tx.fee_amount), txCurrency, true)}`}
            >
              Fee: {formatTransactionFee(Number(tx.fee_amount), txCurrency)}
            </span>
          )}
        </div>

        {tx.has_receipt && tx.receipt_id && onOpenReceipt ? (
          <button
            type="button"
            onClick={() => onOpenReceipt(tx.receipt_id!)}
            className="text-xs font-semibold text-slate-200 hover:text-amber-300 truncate text-left transition-colors cursor-pointer block max-w-full"
            title="Click to inspect receipt items & photo"
          >
            {tx.merchant}
          </button>
        ) : (
          <div
            className="text-xs font-semibold text-slate-200 truncate"
            title={tx.raw_description || tx.merchant}
          >
            {tx.merchant}
          </div>
        )}
        {tx.raw_description && tx.raw_description !== tx.merchant && (
          <div className="text-[11px] text-slate-500 truncate max-w-sm">
            {tx.raw_description}
          </div>
        )}
        {isAmortized && originSummary && (
          <div className="text-[11px] font-mono text-sky-300/80 truncate">
            {originSummary}
          </div>
        )}
        {isSplit && (
          <div
            data-testid={`split-summary-${tx.id}`}
            className="text-[11px] text-violet-200/90 flex items-center flex-wrap gap-x-1.5 gap-y-0.5"
          >
            {effectiveSplits.map((s, idx) => {
              const isCrypto = isCryptoCurrency(txCurrency);
              const amountColorClass = hasMixedSplitSigns
                ? s.signedAmount > 0
                  ? 'text-emerald-400'
                  : s.signedAmount < 0
                    ? 'text-rose-400'
                    : 'text-slate-200'
                : 'text-slate-200';
              return (
                <React.Fragment key={s.id || idx}>
                  {idx > 0 && <span className="text-slate-500">|</span>}
                  <span className="inline-flex items-center gap-1 whitespace-nowrap">
                    <span className="font-medium text-violet-300">{s.category}</span>
                    <span className={`font-mono ${amountColorClass}`}>
                      {formatMoney(s.signedAmount, {
                        currency: isCrypto ? '' : '$',
                        minimumFractionDigits: 2,
                        maximumFractionDigits: isCrypto ? 8 : 2,
                        showPlusSign: true,
                      })}
                    </span>
                    {Boolean(s.notes) && (
                      <span className="text-slate-400 truncate max-w-[120px]">({s.notes})</span>
                    )}
                  </span>
                </React.Fragment>
              );
            })}
          </div>
        )}
        {hasLinkedTransfer && Boolean(linkedCounterpartName) && (
          <div
            className="inline-flex items-center gap-1.5 flex-wrap px-2 py-1 rounded-lg bg-sky-500/10 border border-sky-500/25 text-[11px] text-sky-200"
            data-testid={`transfer-flow-${tx.id}`}
          >
            <ArrowRightLeft className="w-3 h-3 text-sky-400 shrink-0" />
            <span className="font-semibold truncate max-w-[140px]" title={transferFromAccount}>
              {transferFromAccount}
            </span>
            <ArrowRight className="w-3 h-3 text-sky-400 shrink-0" />
            <span className="font-semibold truncate max-w-[140px]" title={transferToAccount}>
              {transferToAccount}
            </span>
            {hasCrossCurrencyLeg && (
              <span className="text-[10px] font-mono text-sky-300/90">
                (
                {isLinkedBtc
                  ? new Intl.NumberFormat('en-US', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 8,
                    }).format(Math.abs(Number(tx.linked_amount)))
                  : formatMoney(Math.abs(Number(tx.linked_amount)), {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}{' '}
                {tx.linked_currency})
              </span>
            )}
          </div>
        )}
        {!hasLinkedTransfer && Boolean(tx.counterpart_account_name) && (
          <div
            className={`inline-flex items-center gap-1.5 flex-wrap px-2 py-1 rounded-lg border text-[11px] ${
              amt > 0
                ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-200'
                : 'bg-amber-500/10 border-amber-500/25 text-amber-200'
            }`}
            data-testid={`counterpart-flow-${tx.id}`}
          >
            <Landmark
              className={`w-3 h-3 shrink-0 ${
                amt > 0 ? 'text-emerald-400' : 'text-amber-400'
              }`}
            />
            <span
              className="font-semibold truncate max-w-[140px]"
              title={amt > 0 ? tx.counterpart_account_name || '' : tx.account_name || 'Account'}
            >
              {amt > 0 ? tx.counterpart_account_name : tx.account_name || 'Account'}
            </span>
            <ArrowRight
              className={`w-3 h-3 shrink-0 ${
                amt > 0 ? 'text-emerald-400' : 'text-amber-400'
              }`}
            />
            <span
              className="font-semibold truncate max-w-[140px]"
              title={amt > 0 ? tx.account_name || 'Account' : tx.counterpart_account_name || ''}
            >
              {amt > 0 ? tx.account_name || 'Account' : tx.counterpart_account_name}
            </span>
          </div>
        )}
        {splitLoanEntries.length > 0
          ? splitLoanEntries.map((entry, idx) =>
              renderLoanFlowPill(
                entry.key,
                idx === 0 ? `loan-flow-${tx.id}` : `loan-flow-${tx.id}-${idx}`,
                entry.loanName,
                entry.loanType,
                entry.paymentAmount,
                entry.flowSignAmt
              )
            )
          : !isSplit &&
            Boolean(tx.loan_name) &&
            renderLoanFlowPill(
              `loan-${tx.id}`,
              `loan-flow-${tx.id}`,
              tx.loan_name!,
              resolvedLoanType,
              tx.loan_payment_amount,
              amt
            )}
        <TagPillList
          tags={tags}
          disabled={updating}
          variant="amber"
          placeholder="badminton"
          addButtonTestId={`add-tag-btn-${tx.id}`}
          inputTestId={`tag-input-${tx.id}`}
          onAddTag={onTagsChange ? (tag) => onTagsChange(tx.id, [...tags, tag]) : undefined}
          onRemoveTag={
            onTagsChange
              ? (target) =>
                  onTagsChange(
                    tx.id,
                    tags.filter((t) => t !== target)
                  )
              : undefined
          }
          className="pt-0.5"
        />
      </div>

      {/* Right: Amount & inline category selector */}
      <div
        className={
          stackControls
            ? 'flex items-center justify-between flex-wrap gap-2 pt-2 border-t border-border/40'
            : 'flex items-center justify-between sm:justify-end space-x-3 shrink-0'
        }
      >
        {isAmortized ? (
          <span
            data-testid={`amortized-amount-${tx.id}`}
            className="text-xs font-semibold font-mono text-sky-300 whitespace-nowrap"
          >
            {amortizedAmtFormatted}
          </span>
        ) : (
          <span
            data-testid={`tx-amount-${tx.id}`}
            className={`text-xs font-semibold font-mono whitespace-nowrap ${
              isTransfer ? 'text-sky-300' : isDebit ? 'text-rose-400' : 'text-emerald-400'
            }`}
          >
            {formattedAmt}
          </span>
        )}

        <div className="flex items-center flex-wrap justify-end gap-1.5">
          {showLoanSelector && (
            <>
              <select
                value={tx.loan_id != null ? String(tx.loan_id) : ''}
                onChange={(e) => {
                  const nextId = e.target.value ? Number(e.target.value) : null;
                  if (nextId === null) {
                    setEditingLoanAmt(false);
                    setLoanAmtDraft('');
                    onLoanChange!(tx.id, null, null);
                  } else {
                    onLoanChange!(tx.id, nextId);
                  }
                }}
                disabled={updating}
                aria-label={`Financing loan for ${tx.merchant}`}
                data-testid={`modal-select-loan-${tx.id}`}
                title="Link or unlink financing loan repayment"
                className="text-base sm:text-xs px-1.5 py-1 max-w-[145px] bg-background border border-border hover:border-rose-500/50 rounded-lg text-slate-300 focus:outline-none focus:border-rose-500 transition-colors disabled:opacity-50"
              >
                <option value="">No loan</option>
                {selectableLoans.map((loan) => (
                  <option key={loan.id} value={String(loan.id)}>
                    {loan.loan_type === 'lent' ? `${loan.name} (Lent)` : loan.name}
                  </option>
                ))}
              </select>
              {tx.loan_id != null && (
                <button
                  type="button"
                  disabled={updating}
                  data-testid={`modal-loan-split-btn-${tx.id}`}
                  onClick={() => {
                    if (!editingLoanAmt) {
                      setLoanAmtDraft(
                        tx.loan_payment_amount != null ? String(tx.loan_payment_amount) : ''
                      );
                    }
                    setEditingLoanAmt((prev) => !prev);
                  }}
                  className="text-[11px] px-2 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 border border-border text-slate-200 whitespace-nowrap transition-colors disabled:opacity-50"
                  title="Set partial amount applied to this loan"
                >
                  {tx.loan_payment_amount != null
                    ? `Applied: ${formatMoney(Number(tx.loan_payment_amount), {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}`
                    : 'Split'}
                </button>
              )}
              {tx.loan_id != null && editingLoanAmt && (
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    max={Math.abs(amt)}
                    value={loanAmtDraft}
                    onChange={(e) => setLoanAmtDraft(e.target.value)}
                    placeholder={Math.abs(amt).toFixed(2)}
                    aria-label={`Applied loan amount for ${tx.merchant}`}
                    data-testid={`modal-loan-amount-input-${tx.id}`}
                    className="w-24 text-base sm:text-xs px-2 py-1 bg-background border border-border rounded-lg text-slate-200 font-mono focus:outline-none focus:border-emerald-500"
                  />
                  <button
                    type="button"
                    disabled={updating}
                    data-testid={`modal-loan-amount-save-${tx.id}`}
                    onClick={() => {
                      const parsed = parseFloat(loanAmtDraft);
                      if (!Number.isFinite(parsed) || parsed <= 0 || parsed > Math.abs(amt)) {
                        return;
                      }
                      onLoanChange!(tx.id, tx.loan_id!, Math.round(parsed * 100) / 100);
                      setEditingLoanAmt(false);
                    }}
                    className="text-[11px] px-2 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-200 font-medium whitespace-nowrap disabled:opacity-50"
                  >
                    Apply
                  </button>
                  <button
                    type="button"
                    disabled={updating}
                    data-testid={`modal-loan-amount-clear-${tx.id}`}
                    onClick={() => {
                      onLoanChange!(tx.id, tx.loan_id!, null);
                      setLoanAmtDraft('');
                      setEditingLoanAmt(false);
                    }}
                    className="text-[11px] px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-border text-slate-300 whitespace-nowrap disabled:opacity-50"
                  >
                    Clear
                  </button>
                </div>
              )}
            </>
          )}
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
            <div className="flex items-center gap-0.5 shrink-0">
              {Boolean(onOpenSplit && !hasLinkedTransfer && !isAmortized) && (
                <button
                  type="button"
                  onClick={() => onOpenSplit!(tx)}
                  className={`p-1 rounded transition-colors ${
                    isSplit
                      ? 'text-violet-300 bg-violet-500/15 hover:bg-violet-500/25'
                      : 'text-slate-400 hover:text-violet-300 hover:bg-violet-500/10'
                  }`}
                  title={isSplit ? 'Edit transaction splits' : 'Split transaction across categories or loans'}
                  aria-label={`Split ${tx.merchant}`}
                  data-testid={`split-tx-btn-${tx.id}`}
                >
                  <Split className="w-3.5 h-3.5" />
                </button>
              )}
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
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
