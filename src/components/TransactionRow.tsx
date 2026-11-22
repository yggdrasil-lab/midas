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
import { LoanItem, ReceiptDocumentType, RecurrenceType, Transaction } from '../types';
import { isTransferCategory, RECURRENCE_OPTIONS } from '../constants/categories';
import {
  formatMoney,
  formatSignedTransactionAmount,
  formatTransactionFee,
  getTransactionNzdAmount,
  isCryptoCurrency,
} from '../utils/format';
import { isPayslipDocument } from '../utils/receipts';
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

/**
 * Ensures the transaction's assigned category remains selectable even when absent
 * from the active spending categories list (e.g. non-expense inflow categories).
 */
export function buildCategoryOptions(
  categories: readonly string[],
  currentCategory: string
): readonly string[] {
  const trimmed = (currentCategory || '').trim();
  if (!trimmed || categories.includes(trimmed)) {
    return categories;
  }
  return [trimmed, ...categories];
}

function formatRecurrenceLabel(recurrence?: string | null): string {
  const normalized = (recurrence || '').trim().toLowerCase();
  if (!normalized) return 'Recurring';
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function buildAmortizedOriginSummary(
  tx: Transaction,
  txCurrency: string,
  amt: number
): string {
  const originUnit = RECURRENCE_UNIT_LABELS[(tx.recurrence || '').trim().toLowerCase()] || 'cycle';
  if (txCurrency.toUpperCase() !== 'NZD') {
    const nzd = formatMoney(getTransactionNzdAmount(tx), { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return `From ${txCurrency.toUpperCase()} ${Math.abs(amt).toFixed(2)} (${nzd} NZD/${originUnit})`;
  }
  const nzd = formatMoney(Math.abs(amt), { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `From ${nzd} NZD/${originUnit}`;
}

function formatFxRateLabel(exchangeRate: number): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: exchangeRate >= 100 ? 2 : 0,
    maximumFractionDigits: exchangeRate >= 100 ? 2 : 6,
  }).format(exchangeRate);
}

function deriveSplitLoanEntries(
  effectiveSplits: Array<{ id: number; signedAmount: number; loan_id?: number | null; loan_name?: string | null; loan_type?: 'borrowed' | 'lent' | null }>,
  loans?: LoanItem[]
) {
  return effectiveSplits
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
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null);
}

function deriveRowMeta(tx: Transaction, loans?: LoanItem[], fallbackCurrency?: string) {
  const amt = Number(tx.amount);
  const txCurrency = tx.currency || fallbackCurrency || 'NZD';
  const isAmortized = Boolean(tx.is_amortized_commitment && tx.amortized_period_amount_nzd != null);
  const hasLinkedTransfer = tx.linked_transaction_id != null;
  const isSplit = hasValidSplitLines(tx);
  const legacyPositive = areLegacyPositiveOutflowSplits(tx);
  const effectiveSplits = isSplit
    ? (tx.splits || []).map((s) => ({ ...s, signedAmount: legacyPositive ? -Math.abs(Number(s.amount)) : Number(s.amount) }))
    : [];
  const isDebtCategory = (tx.category || '').trim().toLowerCase() === 'debt & loans';
  const showLoanSelector = Boolean(
    !isSplit && loans && loans.length > 0 && !hasLinkedTransfer && (isDebtCategory || tx.loan_id != null)
  );
  return {
    amt,
    isDebit: amt < 0,
    txCurrency,
    isTransfer: isTransferCategory(tx.category, tx),
    isAmortized,
    isExcluded: Boolean(tx.excluded_from_period_budget && !isAmortized),
    hasLinkedTransfer,
    isSplit,
    effectiveSplits,
    showLoanSelector,
    splitLoanEntries: isSplit ? deriveSplitLoanEntries(effectiveSplits, loans) : [],
  };
}

interface LoanFlowPillProps {
  testId: string;
  accountName?: string | null;
  loanName: string;
  loanType: 'borrowed' | 'lent';
  paymentAmount: number | null | undefined;
  flowSignAmt: number;
  parentAmt: number;
  txCurrency: string;
}

const LoanFlowAmountText: React.FC<{
  paymentAmount: number;
  parentAmt: number;
  txCurrency: string;
  colorClass: string;
}> = ({ paymentAmount, parentAmt, txCurrency, colorClass }) => {
  const isCrypto = isCryptoCurrency(txCurrency);
  const maxDigits = isCrypto ? 8 : 2;
  const currency = isCrypto ? '' : '$';
  const amtNum = Number(paymentAmount);
  const exceedsNetParent = Math.abs(amtNum) > Math.abs(parentAmt) + 0.005;
  const appliedFmt = formatMoney(amtNum, { currency, minimumFractionDigits: 2, maximumFractionDigits: maxDigits });

  return (
    <span className={`text-[10px] font-mono whitespace-nowrap ${colorClass}`}>
      {exceedsNetParent ? (
        <>{appliedFmt} (from {formatMoney(parentAmt, { currency, minimumFractionDigits: 2, maximumFractionDigits: maxDigits, showPlusSign: true })} net)</>
      ) : (
        <>({appliedFmt} of {formatMoney(Math.abs(parentAmt), { currency, minimumFractionDigits: 2, maximumFractionDigits: maxDigits })})</>
      )}
    </span>
  );
};

const LoanFlowPill: React.FC<LoanFlowPillProps> = ({
  testId, accountName, loanName, loanType, paymentAmount, flowSignAmt, parentAmt, txCurrency,
}) => {
  const isLent = loanType === 'lent';
  const isRepayment = isLent && flowSignAmt > 0;
  const isDisbursement = isLent && flowSignAmt < 0;
  const boxCls = isRepayment
    ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-200'
    : isDisbursement ? 'bg-amber-500/10 border-amber-500/25 text-amber-200' : 'bg-rose-500/10 border-rose-500/25 text-rose-200';
  const iconCls = isRepayment ? 'text-emerald-400' : isDisbursement ? 'text-amber-400' : 'text-rose-400';
  const badgeCls = isRepayment
    ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-200'
    : isDisbursement ? 'bg-amber-500/20 border-amber-500/30 text-amber-200' : 'bg-rose-500/20 border-rose-500/30 text-rose-200';
  const amtCls = isRepayment ? 'text-emerald-300/90' : isDisbursement ? 'text-amber-300/90' : 'text-rose-300/90';
  const fromLabel = isRepayment ? loanName : accountName || 'Account';
  const toLabel = isRepayment ? accountName || 'Account' : loanName;

  return (
    <div className={`inline-flex items-center gap-1.5 flex-wrap px-2 py-1 rounded-lg border text-[11px] ${boxCls}`} data-testid={testId}>
      {isLent ? <Landmark className={`w-3 h-3 shrink-0 ${iconCls}`} /> : <Car className="w-3 h-3 text-rose-400 shrink-0" />}
      <span className="font-semibold truncate max-w-[160px]" title={fromLabel}>{fromLabel}</span>
      <ArrowRight className={`w-3 h-3 shrink-0 ${iconCls}`} />
      <span className="font-semibold truncate max-w-[160px]" title={toLabel}>{toLabel}</span>
      <span className={`text-[10px] px-1 py-0.2 rounded border font-medium whitespace-nowrap ${badgeCls}`}>
        {isRepayment ? 'Repayment' : isDisbursement ? 'Lent' : 'Loan'}
      </span>
      {paymentAmount != null && <LoanFlowAmountText paymentAmount={paymentAmount} parentAmt={parentAmt} txCurrency={txCurrency} colorClass={amtCls} />}
    </div>
  );
};

interface TransactionSplitAndTransferBadgesProps {
  tx: Transaction;
  isSplit: boolean;
  hasLinkedTransfer: boolean;
  isTransfer: boolean;
  txCurrency: string;
  onOpenSplit?: (tx: Transaction) => void;
}

const TransactionSplitAndTransferBadges: React.FC<TransactionSplitAndTransferBadgesProps> = ({
  tx, isSplit, hasLinkedTransfer, isTransfer, txCurrency, onOpenSplit,
}) => {
  const hasFxRate = Boolean(tx.exchange_rate && tx.exchange_rate !== 1.0);
  const formattedFxRate = hasFxRate ? formatFxRateLabel(Number(tx.exchange_rate)) : '';
  const transferTitle = hasLinkedTransfer ? (hasFxRate ? `Linked Transfer (Rate: ${formattedFxRate})` : 'Linked Account Transfer') : 'Inter-Account Transfer';
  const transferText = hasLinkedTransfer ? (hasFxRate ? `FX (${formattedFxRate})` : 'Transfer Linked') : 'Transfer';
  const splitCount = tx.splits?.length ?? 0;

  return (
    <>
      {isSplit && (onOpenSplit ? (
        <button type="button" onClick={() => onOpenSplit(tx)} data-testid={`open-split-badge-${tx.id}`} className="text-[10px] px-1.5 py-0.5 rounded bg-violet-500/15 hover:bg-violet-500/25 text-violet-300 border border-violet-500/30 font-medium flex items-center space-x-1 transition-colors cursor-pointer whitespace-nowrap" title="Inspect or edit manual transaction splits">
          <Split className="w-2.5 h-2.5" /><span>Split ({splitCount})</span>
        </button>
      ) : (
        <span data-testid={`open-split-badge-${tx.id}`} className="text-[10px] px-1.5 py-0.5 rounded bg-violet-500/15 text-violet-300 border border-violet-500/30 font-medium flex items-center space-x-1 whitespace-nowrap">
          <Split className="w-2.5 h-2.5" /><span>Split ({splitCount})</span>
        </span>
      ))}
      {(hasLinkedTransfer || isTransfer) && (
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30 font-medium flex items-center space-x-1" title={transferTitle}>
          <ArrowRightLeft className="w-2.5 h-2.5" /><span>{transferText}</span>
        </span>
      )}
      {tx.fee_amount != null && Number(tx.fee_amount) > 0 && (
        <span data-testid={`tx-fee-${tx.id}`} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 font-medium" title={`Transfer Fee: ${formatTransactionFee(Number(tx.fee_amount), txCurrency, true)}`}>
          Fee: {formatTransactionFee(Number(tx.fee_amount), txCurrency)}
        </span>
      )}
    </>
  );
};

interface TransactionStatusBadgesProps {
  tx: Transaction;
  showAccountBadge: boolean;
  isAmortized: boolean;
  isExcluded: boolean;
  isSplit: boolean;
  hasLinkedTransfer: boolean;
  isTransfer: boolean;
  txCurrency: string;
  onOpenReceipt?: (receiptId: number, documentType?: ReceiptDocumentType | null) => void;
  onOpenSplit?: (tx: Transaction) => void;
}

const TransactionStatusBadges: React.FC<TransactionStatusBadgesProps> = ({
  tx, showAccountBadge, isAmortized, isExcluded, isSplit, hasLinkedTransfer, isTransfer, txCurrency, onOpenReceipt, onOpenSplit,
}) => (
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
      <span data-testid={`amortized-badge-${tx.id}`} className="text-[10px] px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-300 border border-sky-500/30 font-medium flex items-center space-x-1" title="Recurring commitment amortized into this period's spending breakdown">
        <Repeat className="w-2.5 h-2.5" /><span>{formatRecurrenceLabel(tx.recurrence)} amortized</span>
      </span>
    )}
    {isExcluded && (
      <span data-testid={`excluded-budget-badge-${tx.id}`} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800/90 text-slate-400 border border-slate-700 font-medium" title="Excluded from this period's category budget total">
        {tx.recurrence === 'one-off' ? 'One-off (excluded)' : 'Excluded from budget'}
      </span>
    )}
    {Boolean(tx.has_receipt) && (
      <TransactionReceiptBadge txId={tx.id} receiptId={tx.receipt_id} isSplit={Boolean(tx.is_receipt_split)} isPayslip={isPayslipDocument(tx.receipt_document_type)} documentType={tx.receipt_document_type} onOpenReceipt={onOpenReceipt} />
    )}
    <TransactionSplitAndTransferBadges tx={tx} isSplit={isSplit} hasLinkedTransfer={hasLinkedTransfer} isTransfer={isTransfer} txCurrency={txCurrency} onOpenSplit={onOpenSplit} />
  </div>
);

interface TransactionMerchantHeaderProps {
  tx: Transaction;
  txCurrency: string;
  isAmortized: boolean;
  onOpenReceipt?: (receiptId: number, documentType?: ReceiptDocumentType | null) => void;
}

const TransactionMerchantHeader: React.FC<TransactionMerchantHeaderProps> = ({
  tx, txCurrency, isAmortized, onOpenReceipt,
}) => {
  const isPayslip = isPayslipDocument(tx.receipt_document_type);
  const openReceiptId = tx.has_receipt ? tx.receipt_id ?? null : null;
  const originSummary = isAmortized ? buildAmortizedOriginSummary(tx, txCurrency, Number(tx.amount)) : '';

  return (
    <>
      {openReceiptId != null && onOpenReceipt ? (
        <button type="button" onClick={() => onOpenReceipt(openReceiptId, tx.receipt_document_type)} className="text-xs font-semibold text-slate-200 hover:text-amber-300 truncate text-left transition-colors cursor-pointer block max-w-full" title={isPayslip ? 'Click to inspect attached payslip PDF' : 'Click to inspect receipt items & photo'}>
          {tx.merchant}
        </button>
      ) : (
        <div className="text-xs font-semibold text-slate-200 truncate" title={tx.raw_description || tx.merchant}>{tx.merchant}</div>
      )}
      {Boolean(tx.raw_description && tx.raw_description !== tx.merchant) && (
        <div className="text-[11px] text-slate-500 truncate max-w-sm">{tx.raw_description}</div>
      )}
      {Boolean(isAmortized && originSummary) && (
        <div className="text-[11px] font-mono text-sky-300/80 truncate">{originSummary}</div>
      )}
    </>
  );
};

interface TransactionSplitSummaryProps {
  txId: number;
  txCurrency: string;
  effectiveSplits: Array<{ id: number; category: string; signedAmount: number; notes?: string | null }>;
}

const TransactionSplitSummary: React.FC<TransactionSplitSummaryProps> = ({
  txId, txCurrency, effectiveSplits,
}) => {
  const hasMixed = effectiveSplits.some((s) => s.signedAmount > 0) && effectiveSplits.some((s) => s.signedAmount < 0);
  const isCrypto = isCryptoCurrency(txCurrency);
  return (
    <div data-testid={`split-summary-${txId}`} className="text-[11px] text-violet-200/90 flex items-center flex-wrap gap-x-1.5 gap-y-0.5">
      {effectiveSplits.map((s, idx) => {
        const amtCls = hasMixed ? (s.signedAmount > 0 ? 'text-emerald-400' : s.signedAmount < 0 ? 'text-rose-400' : 'text-slate-200') : 'text-slate-200';
        const formatted = formatMoney(s.signedAmount, { currency: isCrypto ? '' : '$', minimumFractionDigits: 2, maximumFractionDigits: isCrypto ? 8 : 2, showPlusSign: true });
        return (
          <React.Fragment key={s.id || idx}>
            {idx > 0 && <span className="text-slate-500">|</span>}
            <span className="inline-flex items-center gap-1 whitespace-nowrap">
              <span className="font-medium text-violet-300">{s.category}</span>
              <span className={`font-mono ${amtCls}`}>{formatted}</span>
              {Boolean(s.notes) && <span className="text-slate-400 truncate max-w-[120px]">({s.notes})</span>}
            </span>
          </React.Fragment>
        );
      })}
    </div>
  );
};

interface TransactionTransferPillsProps {
  tx: Transaction;
  amt: number;
  txCurrency: string;
  hasLinkedTransfer: boolean;
}

const LinkedTransferFlowPill: React.FC<{ tx: Transaction; isDebit: boolean; txCurrency: string }> = ({
  tx, isDebit, txCurrency,
}) => {
  const counterpart = tx.linked_account_name || tx.counterpart_account_name;
  if (!counterpart) return null;
  const from = isDebit ? tx.account_name || 'Source Account' : counterpart;
  const to = isDebit ? counterpart : tx.account_name || 'Destination Account';
  const hasCross = tx.linked_amount != null && Boolean(tx.linked_currency) && tx.linked_currency !== txCurrency;
  const isBtc = (tx.linked_currency || '').toUpperCase() === 'BTC';
  const linkedFmt = hasCross
    ? isBtc
      ? new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 8 }).format(Math.abs(Number(tx.linked_amount)))
      : formatMoney(Math.abs(Number(tx.linked_amount)), { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : '';
  return (
    <div className="inline-flex items-center gap-1.5 flex-wrap px-2 py-1 rounded-lg bg-sky-500/10 border border-sky-500/25 text-[11px] text-sky-200" data-testid={`transfer-flow-${tx.id}`}>
      <ArrowRightLeft className="w-3 h-3 text-sky-400 shrink-0" />
      <span className="font-semibold truncate max-w-[140px]" title={from}>{from}</span>
      <ArrowRight className="w-3 h-3 text-sky-400 shrink-0" />
      <span className="font-semibold truncate max-w-[140px]" title={to}>{to}</span>
      {hasCross && <span className="text-[10px] font-mono text-sky-300/90">({linkedFmt} {tx.linked_currency})</span>}
    </div>
  );
};

const TransactionTransferPills: React.FC<TransactionTransferPillsProps> = ({
  tx, amt, txCurrency, hasLinkedTransfer,
}) => {
  if (hasLinkedTransfer) return <LinkedTransferFlowPill tx={tx} isDebit={amt < 0} txCurrency={txCurrency} />;
  if (!tx.counterpart_account_name) return null;
  const isInflow = amt > 0;
  const boxCls = isInflow ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-200' : 'bg-amber-500/10 border-amber-500/25 text-amber-200';
  const iconCls = isInflow ? 'text-emerald-400' : 'text-amber-400';
  const from = isInflow ? tx.counterpart_account_name : tx.account_name || 'Account';
  const to = isInflow ? tx.account_name || 'Account' : tx.counterpart_account_name;
  return (
    <div className={`inline-flex items-center gap-1.5 flex-wrap px-2 py-1 rounded-lg border text-[11px] ${boxCls}`} data-testid={`counterpart-flow-${tx.id}`}>
      <Landmark className={`w-3 h-3 shrink-0 ${iconCls}`} />
      <span className="font-semibold truncate max-w-[140px]" title={from}>{from}</span>
      <ArrowRight className={`w-3 h-3 shrink-0 ${iconCls}`} />
      <span className="font-semibold truncate max-w-[140px]" title={to}>{to}</span>
    </div>
  );
};

interface LoanPartialAmountEditorProps {
  tx: Transaction;
  amt: number;
  updating: boolean;
  loanAmtDraft: string;
  onDraftChange: (v: string) => void;
  onSave: (parsed: number) => void;
  onClear: () => void;
}

const LoanPartialAmountEditor: React.FC<LoanPartialAmountEditorProps> = ({
  tx, amt, updating, loanAmtDraft, onDraftChange, onSave, onClear,
}) => (
  <div className="flex items-center gap-1">
    <input
      type="number" step="0.01" min="0.01" max={Math.abs(amt)} value={loanAmtDraft}
      onChange={(e) => onDraftChange(e.target.value)} placeholder={Math.abs(amt).toFixed(2)}
      aria-label={`Applied loan amount for ${tx.merchant}`} data-testid={`modal-loan-amount-input-${tx.id}`}
      className="w-24 text-base sm:text-xs px-2 py-1 bg-background border border-border rounded-lg text-slate-200 font-mono focus:outline-none focus:border-emerald-500"
    />
    <button
      type="button" disabled={updating} data-testid={`modal-loan-amount-save-${tx.id}`}
      onClick={() => {
        const parsed = parseFloat(loanAmtDraft);
        if (Number.isFinite(parsed) && parsed > 0 && parsed <= Math.abs(amt)) onSave(Math.round(parsed * 100) / 100);
      }}
      className="text-[11px] px-2 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-200 font-medium whitespace-nowrap disabled:opacity-50"
    >
      Apply
    </button>
    <button
      type="button" disabled={updating} data-testid={`modal-loan-amount-clear-${tx.id}`} onClick={onClear}
      className="text-[11px] px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-border text-slate-300 whitespace-nowrap disabled:opacity-50"
    >
      Clear
    </button>
  </div>
);

interface TransactionLoanSelectorProps {
  tx: Transaction;
  amt: number;
  loans: LoanItem[];
  updating: boolean;
  onLoanChange: (txId: number, loanId: number | null, loanPaymentAmount?: number | null) => void;
}

const TransactionLoanSelector: React.FC<TransactionLoanSelectorProps> = ({ tx, amt, loans, updating, onLoanChange }) => {
  const [editingLoanAmt, setEditingLoanAmt] = useState(false);
  const [loanAmtDraft, setLoanAmtDraft] = useState('');
  const selectableLoans = loans.filter((loan) => (loan.is_active || loan.id === tx.loan_id) && (amt < 0 || loan.loan_type === 'lent' || loan.id === tx.loan_id));

  return (
    <>
      <select
        value={tx.loan_id != null ? String(tx.loan_id) : ''} disabled={updating}
        aria-label={`Financing loan for ${tx.merchant}`} data-testid={`modal-select-loan-${tx.id}`} title="Link or unlink financing loan repayment"
        onChange={(e) => {
          const nextId = e.target.value ? Number(e.target.value) : null;
          if (nextId === null) { setEditingLoanAmt(false); setLoanAmtDraft(''); onLoanChange(tx.id, null, null); }
          else { onLoanChange(tx.id, nextId); }
        }}
        className="text-base sm:text-xs px-1.5 py-1 max-w-[145px] bg-background border border-border hover:border-rose-500/50 rounded-lg text-slate-300 focus:outline-none focus:border-rose-500 transition-colors disabled:opacity-50"
      >
        <option value="">No loan</option>
        {selectableLoans.map((loan) => <option key={loan.id} value={String(loan.id)}>{loan.loan_type === 'lent' ? `${loan.name} (Lent)` : loan.name}</option>)}
      </select>
      {tx.loan_id != null && (
        <button
          type="button" disabled={updating} data-testid={`modal-loan-split-btn-${tx.id}`} title="Set partial amount applied to this loan"
          onClick={() => { if (!editingLoanAmt) setLoanAmtDraft(tx.loan_payment_amount != null ? String(tx.loan_payment_amount) : ''); setEditingLoanAmt((p) => !p); }}
          className="text-[11px] px-2 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 border border-border text-slate-200 whitespace-nowrap transition-colors disabled:opacity-50"
        >
          {tx.loan_payment_amount != null ? `Applied: ${formatMoney(Number(tx.loan_payment_amount), { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'Split'}
        </button>
      )}
      {tx.loan_id != null && editingLoanAmt && (
        <LoanPartialAmountEditor
          tx={tx} amt={amt} updating={updating} loanAmtDraft={loanAmtDraft} onDraftChange={setLoanAmtDraft}
          onSave={(val) => { onLoanChange(tx.id, tx.loan_id!, val); setEditingLoanAmt(false); }}
          onClear={() => { onLoanChange(tx.id, tx.loan_id!, null); setLoanAmtDraft(''); setEditingLoanAmt(false); }}
        />
      )}
    </>
  );
};

interface TransactionCategoryAndActionsProps {
  tx: Transaction;
  categories: readonly string[];
  updating: boolean;
  isSplit: boolean;
  hasLinkedTransfer: boolean;
  isAmortized: boolean;
  ruleBtnTestId?: string;
  selectTestId?: string;
  onCategoryChange: (txId: number, category: string) => void;
  onRecurrenceChange?: (txId: number, recurrence: RecurrenceType | null) => void;
  onOpenSplit?: (tx: Transaction) => void;
  onCreateRule: (tx: Transaction) => void;
}

const TransactionCategoryAndActions: React.FC<TransactionCategoryAndActionsProps> = ({
  tx, categories, updating, isSplit, hasLinkedTransfer, isAmortized, ruleBtnTestId, selectTestId,
  onCategoryChange, onRecurrenceChange, onOpenSplit, onCreateRule,
}) => {
  const categoryOptions = buildCategoryOptions(categories, tx.category);
  return (
    <>
      {onRecurrenceChange && (
        <select
          value={tx.recurrence || ''} disabled={updating} aria-label={`Recurrence for ${tx.merchant}`} title="Payment frequency for weekly budget and runway burn"
          onChange={(e) => onRecurrenceChange(tx.id, (e.target.value || null) as RecurrenceType | null)}
          className="text-[11px] px-1.5 py-1 bg-background border border-border hover:border-amber-500/50 rounded-lg text-slate-300 focus:outline-none focus:border-amber-500 transition-colors disabled:opacity-50"
        >
          {RECURRENCE_OPTIONS.map((opt) => <option key={opt.label} value={opt.value}>{opt.label}</option>)}
        </select>
      )}
      <select
        value={tx.category} onChange={(e) => onCategoryChange(tx.id, e.target.value)} disabled={updating}
        aria-label={`Category for ${tx.merchant}`} data-testid={selectTestId}
        className="text-[11px] px-2 py-1 bg-background border border-border hover:border-amber-500/50 rounded-lg text-slate-200 focus:outline-none focus:border-amber-500 transition-colors disabled:opacity-50"
      >
        {categoryOptions.map((choice) => <option key={choice} value={choice}>{choice}</option>)}
      </select>
      {updating ? (
        <RefreshCw className="w-3 h-3 animate-spin text-amber-400 shrink-0" />
      ) : (
        <div className="flex items-center gap-0.5 shrink-0">
          {Boolean(onOpenSplit && !hasLinkedTransfer && !isAmortized) && (
            <button type="button" onClick={() => onOpenSplit!(tx)} data-testid={`split-tx-btn-${tx.id}`} aria-label={`Split ${tx.merchant}`} title={isSplit ? 'Edit transaction splits' : 'Split transaction across categories or loans'} className={`p-1 rounded transition-colors ${isSplit ? 'text-violet-300 bg-violet-500/15 hover:bg-violet-500/25' : 'text-slate-400 hover:text-violet-300 hover:bg-violet-500/10'}`}>
              <Split className="w-3.5 h-3.5" />
            </button>
          )}
          <button type="button" onClick={() => onCreateRule(tx)} data-testid={ruleBtnTestId} aria-label={`Create rule for ${tx.merchant}`} title="Create categorization rule from this transaction" className="p-1 rounded text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 transition-colors">
            <SlidersHorizontal className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </>
  );
};

interface TransactionRowProps {
  transaction: Transaction;
  categories: readonly string[];
  updating: boolean;
  onCategoryChange: (txId: number, category: string) => void;
  onTagsChange?: (txId: number, tags: string[]) => void;
  onRecurrenceChange?: (txId: number, recurrence: RecurrenceType | null) => void;
  loans?: LoanItem[];
  onLoanChange?: (txId: number, loanId: number | null, loanPaymentAmount?: number | null) => void;
  onCreateRule: (tx: Transaction) => void;
  onOpenReceipt?: (receiptId: number, documentType?: ReceiptDocumentType | null) => void;
  onOpenSplit?: (tx: Transaction) => void;
  showAccountBadge?: boolean;
  fallbackCurrency?: string;
  rowTestId?: string;
  selectTestId?: string;
  ruleBtnTestId?: string;
}

const TransactionRowAmount: React.FC<{ tx: Transaction; amt: number; txCurrency: string; isAmortized: boolean; isTransfer: boolean; isDebit: boolean }> = ({
  tx, amt, txCurrency, isAmortized, isTransfer, isDebit,
}) => {
  if (isAmortized) {
    const unit = tx.amortized_cadence === 'week' ? 'wk' : 'mo';
    const amtText = formatMoney(Math.abs(Number(tx.amortized_period_amount_nzd)), { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return <span data-testid={`amortized-amount-${tx.id}`} className="text-xs font-semibold font-mono text-sky-300 whitespace-nowrap">-{amtText} NZD/{unit}</span>;
  }
  const colorCls = isTransfer ? 'text-sky-300' : isDebit ? 'text-rose-400' : 'text-emerald-400';
  return <span data-testid={`tx-amount-${tx.id}`} className={`text-xs font-semibold font-mono whitespace-nowrap ${colorCls}`}>{formatSignedTransactionAmount(amt, txCurrency)}</span>;
};

/**
 * Shared transaction row displaying date, account/receipt/transfer badges,
 * formatted amount, inline category selector, and rule builder trigger.
 */
export const TransactionRow: React.FC<TransactionRowProps> = ({
  transaction: tx, categories, updating, onCategoryChange, onTagsChange, onRecurrenceChange,
  loans, onLoanChange, onCreateRule, onOpenReceipt, onOpenSplit,
  showAccountBadge = true, fallbackCurrency, rowTestId, selectTestId, ruleBtnTestId,
}) => {
  const m = deriveRowMeta(tx, loans, fallbackCurrency);
  const parentAmt = resolveParentTransactionAmount(tx, isCryptoCurrency(m.txCurrency) ? 8 : 2);
  const resolvedLoanType = tx.loan_type || loans?.find((l) => l.id === tx.loan_id)?.loan_type || 'borrowed';
  const tags = tx.tags || [];
  const stackControls = m.showLoanSelector || m.isSplit;
  const containerCls = m.isAmortized ? 'bg-sky-950/15 hover:bg-sky-950/25 border-sky-500/30'
    : m.isExcluded ? 'bg-card/30 hover:bg-card/50 border-border/60 opacity-80'
      : m.hasLinkedTransfer ? 'bg-sky-950/20 hover:bg-sky-950/30 border-sky-500/30' : 'bg-card/60 hover:bg-card/80 border-border';

  return (
    <div data-testid={rowTestId} className={`p-3 rounded-xl flex flex-col ${stackControls ? 'gap-2.5' : 'sm:flex-row sm:items-center justify-between gap-3'} transition-colors border ${containerCls}`}>
      <div className="space-y-1 min-w-0 flex-1">
        <TransactionStatusBadges tx={tx} showAccountBadge={showAccountBadge} isAmortized={m.isAmortized} isExcluded={m.isExcluded} isSplit={m.isSplit} hasLinkedTransfer={m.hasLinkedTransfer} isTransfer={m.isTransfer} txCurrency={m.txCurrency} onOpenReceipt={onOpenReceipt} onOpenSplit={onOpenSplit} />
        <TransactionMerchantHeader tx={tx} txCurrency={m.txCurrency} isAmortized={m.isAmortized} onOpenReceipt={onOpenReceipt} />
        {m.isSplit && <TransactionSplitSummary txId={tx.id} txCurrency={m.txCurrency} effectiveSplits={m.effectiveSplits} />}
        <TransactionTransferPills tx={tx} amt={m.amt} txCurrency={m.txCurrency} hasLinkedTransfer={m.hasLinkedTransfer} />
        {m.splitLoanEntries.length > 0 ? m.splitLoanEntries.map((entry, idx) => (
          <LoanFlowPill key={entry.key} testId={idx === 0 ? `loan-flow-${tx.id}` : `loan-flow-${tx.id}-${idx}`} accountName={tx.account_name} loanName={entry.loanName} loanType={entry.loanType} paymentAmount={entry.paymentAmount} flowSignAmt={entry.flowSignAmt} parentAmt={parentAmt} txCurrency={m.txCurrency} />
        )) : (!m.isSplit && Boolean(tx.loan_name)) && (
          <LoanFlowPill testId={`loan-flow-${tx.id}`} accountName={tx.account_name} loanName={tx.loan_name!} loanType={resolvedLoanType} paymentAmount={tx.loan_payment_amount} flowSignAmt={m.amt} parentAmt={parentAmt} txCurrency={m.txCurrency} />
        )}
        <TagPillList tags={tags} disabled={updating} variant="amber" placeholder="badminton" addButtonTestId={`add-tag-btn-${tx.id}`} inputTestId={`tag-input-${tx.id}`} onAddTag={onTagsChange ? (tag) => onTagsChange(tx.id, [...tags, tag]) : undefined} onRemoveTag={onTagsChange ? (target) => onTagsChange(tx.id, tags.filter((t) => t !== target)) : undefined} className="pt-0.5" />
      </div>
      <div className={stackControls ? 'flex items-center justify-between flex-wrap gap-2 pt-2 border-t border-border/40' : 'flex items-center justify-between sm:justify-end space-x-3 shrink-0'}>
        <TransactionRowAmount tx={tx} amt={m.amt} txCurrency={m.txCurrency} isAmortized={m.isAmortized} isTransfer={m.isTransfer} isDebit={m.isDebit} />
        <div className="flex items-center flex-wrap justify-end gap-1.5">
          {m.showLoanSelector && onLoanChange && <TransactionLoanSelector tx={tx} amt={m.amt} loans={loans!} updating={updating} onLoanChange={onLoanChange} />}
          <TransactionCategoryAndActions tx={tx} categories={categories} updating={updating} isSplit={m.isSplit} hasLinkedTransfer={m.hasLinkedTransfer} isAmortized={m.isAmortized} ruleBtnTestId={ruleBtnTestId} selectTestId={selectTestId} onCategoryChange={onCategoryChange} onRecurrenceChange={onRecurrenceChange} onOpenSplit={onOpenSplit} onCreateRule={onCreateRule} />
        </div>
      </div>
    </div>
  );
};

interface TransactionReceiptBadgeProps {
  txId: number;
  receiptId?: number | null;
  isSplit: boolean;
  isPayslip: boolean;
  documentType?: ReceiptDocumentType | null;
  onOpenReceipt?: (receiptId: number, documentType?: ReceiptDocumentType | null) => void;
}

function TransactionReceiptBadge({
  txId, receiptId, isSplit, isPayslip, documentType, onOpenReceipt,
}: TransactionReceiptBadgeProps) {
  const label = isSplit ? 'Receipt Split' : isPayslip ? 'Payslip' : 'Receipt';
  const title = isPayslip ? 'Inspect attached payslip PDF' : receiptId && onOpenReceipt ? 'Inspect receipt items, categories, tags & photo' : 'Matched Itemized Receipt';

  if (receiptId && onOpenReceipt) {
    return (
      <button type="button" onClick={() => onOpenReceipt(receiptId, documentType)} data-testid={`open-receipt-${txId}`} className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 font-medium flex items-center space-x-1 transition-colors cursor-pointer whitespace-nowrap" title={title}>
        <ReceiptIcon className="w-2.5 h-2.5" /><span>{label}</span>
      </button>
    );
  }
  return (
    <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 font-medium flex items-center space-x-1 whitespace-nowrap" title={title}>
      <ReceiptIcon className="w-2.5 h-2.5" /><span>{label}</span>
    </span>
  );
}
