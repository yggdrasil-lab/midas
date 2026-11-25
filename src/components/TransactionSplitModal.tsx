import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Split, Trash2 } from 'lucide-react';
import { AlertBanner, Button, Modal } from '@yggdrasil-lab/ui';
import {
  applyAutoRemainder,
  buildSplitPayload,
  computeSplitAllocation,
  createInitialSplitRows,
  getFilteredLoans,
  getSplitPrecision,
  hasValidSplitLines,
  isDebtLoansCategory,
  parseSignedAmountInput,
  resolveLoanIdForSign,
  resolveParentTransactionAmount,
  SplitAllocationSummary,
  SplitDraftRow,
  SplitPrecision,
} from '../ledger';
import { updateTransactionSplits } from '../transport';
import { LoanItem, Transaction } from '../types';
import {
  formatMoney,
  formatSignedTransactionAmount,
  isCryptoCurrency,
} from '../utils/format';

interface TransactionSplitModalProps {
  transaction: Transaction | null;
  isOpen: boolean;
  onClose: () => void;
  categories: readonly string[];
  loans: LoanItem[];
  onSaved: (updatedTx: Transaction) => void;
}

function formatAllocationStatus(
  allocation: SplitAllocationSummary,
  isCrypto: boolean,
  decimals: number
): { text: string; badgeClass: string } {
  const text = allocation.isBalanced
    ? allocation.hasInvalidRows
      ? 'Enter all line amounts'
      : 'Balanced'
    : `Remaining: ${formatMoney(allocation.remaining, {
        currency: isCrypto ? '' : '$',
        minimumFractionDigits: 2,
        maximumFractionDigits: decimals,
        showPlusSign: true,
      })}`;
  const isReady = allocation.isBalanced && !allocation.hasInvalidRows;
  const badgeClass = isReady
    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
    : 'bg-amber-500/15 text-amber-300 border-amber-500/30';
  return { text, badgeClass };
}

interface SplitParentHeaderProps {
  transaction: Transaction;
  txAmount: number;
  txCurrency: string;
  allocationText: string;
  allocationBadgeClass: string;
}

const SplitParentHeader: React.FC<SplitParentHeaderProps> = ({
  transaction,
  txAmount,
  txCurrency,
  allocationText,
  allocationBadgeClass,
}) => {
  const isInflow = txAmount > 0;
  return (
    <div className="p-3 rounded-xl bg-card/60 border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
      <div className="min-w-0 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] font-mono text-slate-400 whitespace-nowrap">
            {transaction.transaction_date}
          </span>
          {Boolean(transaction.account_name) && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 font-medium whitespace-nowrap">
              {transaction.account_name}
            </span>
          )}
        </div>
        <div className="text-xs font-semibold text-slate-100 truncate">
          {transaction.merchant}
        </div>
      </div>
      <div className="flex items-center sm:flex-col sm:items-end justify-between gap-1.5 shrink-0">
        <span
          data-testid="split-parent-amount"
          className={`text-xs font-semibold font-mono whitespace-nowrap ${
            isInflow ? 'text-emerald-400' : 'text-rose-400'
          }`}
        >
          {formatSignedTransactionAmount(txAmount, txCurrency)}
        </span>
        <span
          data-testid="split-allocation-pill"
          className={`text-[10px] px-2 py-0.5 rounded-md border font-mono font-medium whitespace-nowrap ${allocationBadgeClass}`}
        >
          {allocationText}
        </span>
      </div>
    </div>
  );
};

interface SplitLineAmountRowProps {
  idx: number;
  row: SplitDraftRow;
  txCurrency: string;
  categoryChoices: readonly string[];
  onSignToggle: (idx: number) => void;
  onAmountChange: (idx: number, value: string) => void;
  onCategoryChange: (idx: number, category: string) => void;
}

const SplitLineAmountRow: React.FC<SplitLineAmountRowProps> = ({
  idx,
  row,
  txCurrency,
  categoryChoices,
  onSignToggle,
  onAmountChange,
  onCategoryChange,
}) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
    <div>
      <label
        htmlFor={`split-amount-${idx}`}
        className="block text-[10px] uppercase tracking-wider text-slate-400 mb-1"
      >
        Amount ({txCurrency})
      </label>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => onSignToggle(idx)}
          data-testid={`split-sign-${idx}`}
          aria-label={
            row.sign > 0
              ? `Split line ${idx + 1} sign: Inflow (+)`
              : `Split line ${idx + 1} sign: Outflow (-)`
          }
          title={
            row.sign > 0
              ? 'Inflow / Repayment (+). Click to switch to Outflow (-)'
              : 'Outflow / Expense (-). Click to switch to Inflow (+)'
          }
          className={`w-9 h-[38px] sm:h-[30px] shrink-0 rounded-lg border font-mono font-bold text-base sm:text-xs flex items-center justify-center transition-colors cursor-pointer whitespace-nowrap ${
            row.sign > 0
              ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/25'
              : 'bg-rose-500/15 text-rose-300 border-rose-500/40 hover:bg-rose-500/25'
          }`}
        >
          {row.sign > 0 ? '+' : '-'}
        </button>
        <input
          id={`split-amount-${idx}`}
          type="text"
          inputMode="decimal"
          value={row.amount}
          onChange={(e) => onAmountChange(idx, e.target.value)}
          placeholder="0.00"
          data-testid={`split-amount-${idx}`}
          className="min-w-0 flex-1 text-base sm:text-xs px-2.5 py-1.5 bg-background border border-border rounded-lg text-slate-100 font-mono focus:outline-none focus:border-violet-500"
        />
      </div>
    </div>

    <div>
      <label
        htmlFor={`split-category-${idx}`}
        className="block text-[10px] uppercase tracking-wider text-slate-400 mb-1"
      >
        Category
      </label>
      <select
        id={`split-category-${idx}`}
        value={row.category}
        onChange={(e) => onCategoryChange(idx, e.target.value)}
        data-testid={`split-category-${idx}`}
        className="w-full text-base sm:text-xs px-2.5 py-1.5 bg-background border border-border rounded-lg text-slate-200 focus:outline-none focus:border-violet-500"
      >
        {categoryChoices.map((cat) => (
          <option key={cat} value={cat}>
            {cat}
          </option>
        ))}
      </select>
    </div>
  </div>
);

interface SplitLineLoanSelectProps {
  idx: number;
  loanId: string;
  filteredLoans: LoanItem[];
  onLoanChange: (value: string) => void;
}

const SplitLineLoanSelect: React.FC<SplitLineLoanSelectProps> = ({
  idx,
  loanId,
  filteredLoans,
  onLoanChange,
}) => (
  <div>
    <label
      htmlFor={`split-loan-${idx}`}
      className="block text-[10px] uppercase tracking-wider text-slate-400 mb-1"
    >
      Financing / Loan
    </label>
    <select
      id={`split-loan-${idx}`}
      value={loanId}
      onChange={(e) => onLoanChange(e.target.value)}
      data-testid={`split-loan-${idx}`}
      className="w-full text-base sm:text-xs px-2.5 py-1.5 bg-background border border-border rounded-lg text-slate-200 focus:outline-none focus:border-violet-500"
    >
      <option value="">No loan</option>
      {filteredLoans.map((loan) => (
        <option key={loan.id} value={String(loan.id)}>
          {loan.loan_type === 'lent' ? `${loan.name} (Lent)` : loan.name}
        </option>
      ))}
    </select>
  </div>
);

interface SplitLineMetaRowProps {
  idx: number;
  notes: string;
  tagsText: string;
  onFieldChange: (idx: number, field: 'notes' | 'tagsText', value: string) => void;
}

const SplitLineMetaRow: React.FC<SplitLineMetaRowProps> = ({
  idx,
  notes,
  tagsText,
  onFieldChange,
}) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
    <div>
      <label
        htmlFor={`split-notes-${idx}`}
        className="block text-[10px] uppercase tracking-wider text-slate-400 mb-1"
      >
        Note (optional)
      </label>
      <input
        id={`split-notes-${idx}`}
        type="text"
        value={notes}
        onChange={(e) => onFieldChange(idx, 'notes', e.target.value)}
        placeholder="e.g. Food split"
        data-testid={`split-notes-${idx}`}
        className="w-full text-base sm:text-xs px-2.5 py-1.5 bg-background border border-border rounded-lg text-slate-200 focus:outline-none focus:border-violet-500"
      />
    </div>
    <div>
      <label
        htmlFor={`split-tags-${idx}`}
        className="block text-[10px] uppercase tracking-wider text-slate-400 mb-1"
      >
        Tags (comma-separated)
      </label>
      <input
        id={`split-tags-${idx}`}
        type="text"
        value={tagsText}
        onChange={(e) => onFieldChange(idx, 'tagsText', e.target.value)}
        placeholder="e.g. family, dinner"
        data-testid={`split-tags-${idx}`}
        className="w-full text-base sm:text-xs px-2.5 py-1.5 bg-background border border-border rounded-lg text-slate-200 focus:outline-none focus:border-violet-500"
      />
    </div>
  </div>
);

interface SplitLineCardProps {
  idx: number;
  row: SplitDraftRow;
  canRemove: boolean;
  txCurrency: string;
  categoryChoices: readonly string[];
  loans: LoanItem[];
  onRemoveRow: (idx: number) => void;
  onSignToggle: (idx: number) => void;
  onAmountChange: (idx: number, value: string) => void;
  onCategoryChange: (idx: number, category: string) => void;
  onFieldChange: (idx: number, field: 'loanId' | 'notes' | 'tagsText', value: string) => void;
}

const SplitLineCard: React.FC<SplitLineCardProps> = ({
  idx,
  row,
  canRemove,
  txCurrency,
  categoryChoices,
  loans,
  onRemoveRow,
  onSignToggle,
  onAmountChange,
  onCategoryChange,
  onFieldChange,
}) => {
  const showLoan = isDebtLoansCategory(row.category);
  const filteredLoans = showLoan ? getFilteredLoans(loans, row.sign, row.loanId) : [];
  return (
    <div
      data-testid={`split-line-row-${idx}`}
      className="p-3 rounded-xl bg-background/60 border border-border/80 space-y-2"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium text-slate-400">Split Line {idx + 1}</span>
        {canRemove && (
          <button
            type="button"
            onClick={() => onRemoveRow(idx)}
            data-testid={`remove-split-line-${idx}`}
            aria-label={`Remove split line ${idx + 1}`}
            className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      <SplitLineAmountRow
        idx={idx}
        row={row}
        txCurrency={txCurrency}
        categoryChoices={categoryChoices}
        onSignToggle={onSignToggle}
        onAmountChange={onAmountChange}
        onCategoryChange={onCategoryChange}
      />
      {showLoan && (
        <SplitLineLoanSelect
          idx={idx}
          loanId={row.loanId}
          filteredLoans={filteredLoans}
          onLoanChange={(val) => onFieldChange(idx, 'loanId', val)}
        />
      )}
      <SplitLineMetaRow
        idx={idx}
        notes={row.notes}
        tagsText={row.tagsText}
        onFieldChange={onFieldChange}
      />
    </div>
  );
};

interface SplitModalFooterProps {
  isSplitTransaction: boolean;
  saving: boolean;
  canSave: boolean;
  onAddRow: () => void;
  onClearSplits: () => void;
  onClose: () => void;
  onSave: () => void;
}

const SplitModalFooter: React.FC<SplitModalFooterProps> = ({
  isSplitTransaction,
  saving,
  canSave,
  onAddRow,
  onClearSplits,
  onClose,
  onSave,
}) => (
  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/60">
    <div className="flex items-center gap-2 flex-wrap">
      <Button
        type="button"
        variant="outline"
        size="xs"
        icon={<Plus className="w-3.5 h-3.5" />}
        onClick={onAddRow}
        disabled={saving}
        data-testid="add-split-line-btn"
      >
        Add Split Line
      </Button>
      {isSplitTransaction && (
        <Button
          type="button"
          variant="danger"
          size="xs"
          onClick={onClearSplits}
          disabled={saving}
          data-testid="clear-splits-btn"
        >
          Clear Splits
        </Button>
      )}
    </div>
    <div className="flex items-center gap-2">
      <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={saving}>
        Cancel
      </Button>
      <Button
        type="button"
        variant="primary"
        size="sm"
        loading={saving}
        loadingText="Saving..."
        disabled={!canSave}
        onClick={onSave}
        data-testid="save-splits-btn"
      >
        Save Split
      </Button>
    </div>
  </div>
);

interface SplitRowHandlersOpts {
  rows: SplitDraftRow[];
  setRows: React.Dispatch<React.SetStateAction<SplitDraftRow[]>>;
  row2ManuallyEdited: boolean;
  setRow2ManuallyEdited: React.Dispatch<React.SetStateAction<boolean>>;
  transaction: Transaction | null;
  defaultCategory: string;
  txAmount: number;
  defaultSign: 1 | -1;
  precision: SplitPrecision;
  allocation: SplitAllocationSummary;
  loans: LoanItem[];
}

function useSplitRowHandlers(opts: SplitRowHandlersOpts) {
  const { setRows, setRow2ManuallyEdited, loans } = opts;
  const remainderOpts = {
    txAmount: opts.txAmount,
    decimals: opts.precision.decimals,
    defaultSign: opts.defaultSign,
    row2ManuallyEdited: opts.row2ManuallyEdited,
    loans,
  };

  const handleAmountChange = (idx: number, rawValue: string) => {
    if (idx === 1) setRow2ManuallyEdited(true);
    const parsed = parseSignedAmountInput(rawValue);
    if (!parsed) return;
    setRows((prev) => {
      const next = prev.map((row, i) => {
        if (i !== idx) return row;
        const nextSign = parsed.explicitSign ?? row.sign;
        return { ...row, sign: nextSign, amount: parsed.cleanAmount, loanId: resolveLoanIdForSign(loans, nextSign, row.loanId) };
      });
      return idx === 0 ? applyAutoRemainder(next, remainderOpts) : next;
    });
  };

  const handleSignToggle = (idx: number) => {
    if (idx === 1) setRow2ManuallyEdited(true);
    setRows((prev) => {
      const next = prev.map((row, i) => {
        if (i !== idx) return row;
        const nextSign: 1 | -1 = row.sign > 0 ? -1 : 1;
        return { ...row, sign: nextSign, loanId: resolveLoanIdForSign(loans, nextSign, row.loanId) };
      });
      return idx === 0 ? applyAutoRemainder(next, remainderOpts) : next;
    });
  };

  const handleCategoryChange = (idx: number, nextCat: string) => {
    setRows((prev) => prev.map((row, i) => (i === idx ? { ...row, category: nextCat, loanId: isDebtLoansCategory(nextCat) ? row.loanId : '' } : row)));
  };

  const handleRowFieldChange = (idx: number, field: 'loanId' | 'notes' | 'tagsText', value: string) => {
    setRows((prev) => prev.map((row, i) => (i === idx ? { ...row, [field]: value } : row)));
  };

  return { handleAmountChange, handleSignToggle, handleCategoryChange, handleRowFieldChange };
}

function buildAppendedSplitRow(opts: SplitRowHandlersOpts): SplitDraftRow {
  const { remaining } = opts.allocation;
  const hasRemainder = Math.abs(remaining) > opts.precision.tolerance;
  const nextSign: 1 | -1 = hasRemainder ? (remaining < 0 ? -1 : 1) : opts.defaultSign;
  return {
    sign: nextSign,
    amount: hasRemainder ? Math.abs(remaining).toFixed(opts.precision.decimals) : '',
    category: opts.transaction?.category || opts.defaultCategory,
    loanId: '',
    notes: '',
    tagsText: '',
  };
}

function useSplitSubmitActions(opts: {
  transaction: Transaction | null;
  rows: SplitDraftRow[];
  decimals: number;
  canSave: boolean;
  setSaving: (v: boolean) => void;
  setError: (v: string | null) => void;
  onSaved: (tx: Transaction) => void;
  onClose: () => void;
}) {
  const runMutation = async (payload: ReturnType<typeof buildSplitPayload>, fallbackErr: string) => {
    if (!opts.transaction) return;
    opts.setSaving(true);
    opts.setError(null);
    try {
      const updatedTx = await updateTransactionSplits(opts.transaction.id, payload);
      opts.onSaved(updatedTx);
      opts.onClose();
    } catch (err) {
      console.error(err);
      opts.setError(err instanceof Error ? err.message : fallbackErr);
    } finally {
      opts.setSaving(false);
    }
  };

  const handleSave = () => {
    if (!opts.canSave) return Promise.resolve();
    return runMutation(buildSplitPayload(opts.rows, opts.decimals), 'Failed to save transaction splits');
  };

  const handleClearSplits = () => runMutation([], 'Failed to clear transaction splits');

  return { handleSave, handleClearSplits };
}

function useSplitModalState(
  transaction: Transaction | null,
  isOpen: boolean,
  categories: readonly string[],
  loans: LoanItem[],
  onSaved: (updatedTx: Transaction) => void,
  onClose: () => void
) {
  const [rows, setRows] = useState<SplitDraftRow[]>([]);
  const [row2ManuallyEdited, setRow2ManuallyEdited] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const defaultCategory = categories[0] || 'General';

  useEffect(() => {
    if (!isOpen || !transaction) return;
    const { decimals } = getSplitPrecision(transaction.currency);
    setRows(createInitialSplitRows(transaction, defaultCategory, decimals));
    setRow2ManuallyEdited(hasValidSplitLines(transaction));
    setError(null);
    setSaving(false);
  }, [isOpen, transaction, defaultCategory]);

  const allCategoryChoices = useMemo(() => {
    const set = new Set<string>(categories);
    if (transaction?.category) set.add(transaction.category);
    for (const r of rows) {
      if (r.category) set.add(r.category);
    }
    return Array.from(set);
  }, [categories, transaction?.category, rows]);

  const txCurrency = transaction?.currency || 'NZD';
  const isCrypto = isCryptoCurrency(txCurrency);
  const precision = getSplitPrecision(txCurrency);
  const txAmount = transaction ? resolveParentTransactionAmount(transaction, precision.decimals) : 0;
  const defaultSign: 1 | -1 = txAmount >= 0 ? 1 : -1;
  const allocation = computeSplitAllocation(rows, txAmount, precision);
  const canSave = !saving && allocation.isReadyToSave;

  const handlerOpts: SplitRowHandlersOpts = {
    rows, setRows, row2ManuallyEdited, setRow2ManuallyEdited,
    transaction, defaultCategory, txAmount, defaultSign, precision, allocation, loans,
  };
  const rowHandlers = useSplitRowHandlers(handlerOpts);
  const handleAddRow = () => setRows((prev) => [...prev, buildAppendedSplitRow(handlerOpts)]);
  const handleRemoveRow = (idx: number) => setRows((prev) => (prev.length > 2 ? prev.filter((_, i) => i !== idx) : prev));
  const submitActions = useSplitSubmitActions({
    transaction, rows, decimals: precision.decimals, canSave, setSaving, setError, onSaved, onClose,
  });

  return {
    rows, saving, error, allCategoryChoices, txCurrency, isCrypto, precision,
    txAmount, allocation, canSave, ...rowHandlers, handleAddRow, handleRemoveRow, ...submitActions,
  };
}

/**
 * Modal for splitting a transaction across multiple categories, loans, tags,
 * and notes with live allocation balance and smart auto-remainder on Row 2.
 */
export const TransactionSplitModal: React.FC<TransactionSplitModalProps> = ({
  transaction,
  isOpen,
  onClose,
  categories,
  loans,
  onSaved,
}) => {
  const s = useSplitModalState(transaction, isOpen, categories, loans, onSaved, onClose);
  if (!transaction) return null;

  const { text: allocationText, badgeClass: allocationBadgeClass } = formatAllocationStatus(
    s.allocation,
    s.isCrypto,
    s.precision.decimals
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Split Transaction"
      subtitle="Allocate this transaction across multiple categories, loans, tags, and notes."
      headerIcon={<Split className="w-4 h-4 text-violet-400" />}
      className="sm:max-w-2xl"
    >
      <div className="space-y-4" data-testid="transaction-split-modal">
        <SplitParentHeader
          transaction={transaction}
          txAmount={s.txAmount}
          txCurrency={s.txCurrency}
          allocationText={allocationText}
          allocationBadgeClass={allocationBadgeClass}
        />
        {Boolean(s.error) && <AlertBanner variant="error">{s.error}</AlertBanner>}
        <div className="space-y-2.5 max-h-[48vh] overflow-y-auto pr-0.5">
          {s.rows.map((row, idx) => (
            <SplitLineCard
              key={idx}
              idx={idx}
              row={row}
              canRemove={s.rows.length > 2}
              txCurrency={s.txCurrency}
              categoryChoices={s.allCategoryChoices}
              loans={loans}
              onRemoveRow={s.handleRemoveRow}
              onSignToggle={s.handleSignToggle}
              onAmountChange={s.handleAmountChange}
              onCategoryChange={s.handleCategoryChange}
              onFieldChange={s.handleRowFieldChange}
            />
          ))}
        </div>
        <SplitModalFooter
          isSplitTransaction={Boolean(transaction.is_split)}
          saving={s.saving}
          canSave={s.canSave}
          onAddRow={s.handleAddRow}
          onClearSplits={() => void s.handleClearSplits()}
          onClose={onClose}
          onSave={() => void s.handleSave()}
        />
      </div>
    </Modal>
  );
};
