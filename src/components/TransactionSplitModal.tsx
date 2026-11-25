import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Split, Trash2 } from 'lucide-react';
import { AlertBanner, Button, Modal } from '@yggdrasil-lab/ui';
import { updateTransactionSplits } from '../transport';
import { LoanItem, Transaction, TransactionSplitInput } from '../types';
import {
  formatMoney,
  formatSignedTransactionAmount,
  isCryptoCurrency,
} from '../utils/format';
import {
  areLegacyPositiveOutflowSplits,
  hasValidSplitLines,
  resolveParentTransactionAmount,
  roundToDecimals,
} from '../utils/splits';

export { resolveParentTransactionAmount };

interface TransactionSplitModalProps {
  transaction: Transaction | null;
  isOpen: boolean;
  onClose: () => void;
  categories: readonly string[];
  loans: LoanItem[];
  onSaved: (updatedTx: Transaction) => void;
}

interface SplitDraftRow {
  sign: 1 | -1;
  amount: string;
  category: string;
  loanId: string;
  notes: string;
  tagsText: string;
}

function isDebtLoansCategory(category: string): boolean {
  return category.trim().toLowerCase() === 'debt & loans';
}

function parseTagsCsv(text: string): string[] {
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const part of text.split(',')) {
    const cleaned = part.trim().replace(/^#+/, '');
    if (cleaned && !seen.has(cleaned.toLowerCase())) {
      seen.add(cleaned.toLowerCase());
      tags.push(cleaned);
    }
  }
  return tags;
}

function createInitialRows(
  tx: Transaction,
  defaultCategory: string,
  decimals: number
): SplitDraftRow[] {
  const defaultSign: 1 | -1 =
    resolveParentTransactionAmount(tx, decimals) >= 0 ? 1 : -1;
  if (hasValidSplitLines(tx)) {
    const forceNegative = areLegacyPositiveOutflowSplits(tx);
    return tx.splits!.map((s) => ({
      sign: forceNegative ? -1 : Number(s.amount) >= 0 ? 1 : -1,
      amount: Math.abs(Number(s.amount)).toFixed(decimals),
      category: s.category || defaultCategory,
      loanId: s.loan_id != null ? String(s.loan_id) : '',
      notes: s.notes || '',
      tagsText: (s.tags || []).join(', '),
    }));
  }
  const baseCat = tx.category || defaultCategory;
  return [
    {
      sign: defaultSign,
      amount: '',
      category: baseCat,
      loanId: isDebtLoansCategory(baseCat) && tx.loan_id != null ? String(tx.loan_id) : '',
      notes: '',
      tagsText: '',
    },
    {
      sign: defaultSign,
      amount: '',
      category: baseCat,
      loanId: '',
      notes: '',
      tagsText: '',
    },
  ];
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
  const [rows, setRows] = useState<SplitDraftRow[]>([]);
  const [row2ManuallyEdited, setRow2ManuallyEdited] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const defaultCategory = categories[0] || 'General';

  useEffect(() => {
    if (!isOpen || !transaction) {
      return;
    }
    const txDecimals = isCryptoCurrency(transaction.currency || 'NZD') ? 8 : 2;
    setRows(createInitialRows(transaction, defaultCategory, txDecimals));
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

  if (!transaction) {
    return null;
  }

  const txCurrency = transaction.currency || 'NZD';
  const isCrypto = isCryptoCurrency(txCurrency);
  const decimals = isCrypto ? 8 : 2;
  const balanceTolerance = isCrypto ? 1e-8 : 0.01;
  const txAmount = resolveParentTransactionAmount(transaction, decimals);
  const isInflow = txAmount > 0;
  const defaultSign: 1 | -1 = txAmount >= 0 ? 1 : -1;

  const parsedSignedAmounts = rows.map((r) => {
    const n = parseFloat(r.amount);
    return Number.isFinite(n) && n > 0 ? r.sign * n : 0;
  });
  const allocatedSum = roundToDecimals(
    parsedSignedAmounts.reduce((sum, val) => sum + val, 0),
    decimals
  );
  const remaining = roundToDecimals(txAmount - allocatedSum, decimals);
  const isBalanced = Math.abs(remaining) <= balanceTolerance;
  const validRowsCount = rows.filter((r) => {
    const n = parseFloat(r.amount);
    return Number.isFinite(n) && n > 0 && r.category.trim().length > 0;
  }).length;
  const hasInvalidRows = validRowsCount < rows.length;
  const canSave = !saving && isBalanced && rows.length >= 2 && !hasInvalidRows;

  const getFilteredLoans = (rowSign: 1 | -1, currentLoanId: string) =>
    loans.filter((loan) => {
      if (!loan.is_active && String(loan.id) !== currentLoanId) return false;
      if (rowSign > 0) {
        return loan.loan_type === 'lent' || String(loan.id) === currentLoanId;
      }
      return true;
    });

  const resolveLoanIdForSign = (nextSign: 1 | -1, currentLoanId: string): string => {
    if (!currentLoanId || nextSign < 0) return currentLoanId;
    const matched = loans.find((l) => String(l.id) === currentLoanId);
    if (matched && matched.loan_type !== 'lent') {
      return '';
    }
    return currentLoanId;
  };

  const applyAutoRemainder = (next: SplitDraftRow[]): SplitDraftRow[] => {
    if (row2ManuallyEdited || next.length !== 2) {
      return next;
    }
    const row0 = next[0];
    const trimmed = row0.amount.trim();
    if (!trimmed) {
      next[1] = {
        ...next[1],
        sign: defaultSign,
        amount: '',
        loanId: resolveLoanIdForSign(defaultSign, next[1].loanId),
      };
      return next;
    }
    const parsed = parseFloat(trimmed);
    if (Number.isFinite(parsed) && parsed >= 0) {
      const row0Signed = row0.sign * parsed;
      const remainder = roundToDecimals(txAmount - row0Signed, decimals);
      const nextSign: 1 | -1 = remainder < 0 ? -1 : remainder > 0 ? 1 : defaultSign;
      next[1] = {
        ...next[1],
        sign: nextSign,
        amount: Math.abs(remainder).toFixed(decimals),
        loanId: resolveLoanIdForSign(nextSign, next[1].loanId),
      };
    }
    return next;
  };

  const handleAmountChange = (idx: number, rawValue: string) => {
    if (idx === 1) {
      setRow2ManuallyEdited(true);
    }
    let explicitSign: 1 | -1 | null = null;
    let cleanAmount = rawValue;
    if (rawValue.startsWith('-')) {
      explicitSign = -1;
      cleanAmount = rawValue.slice(1);
    } else if (rawValue.startsWith('+')) {
      explicitSign = 1;
      cleanAmount = rawValue.slice(1);
    }
    if (cleanAmount !== '' && !/^\d*\.?\d*$/.test(cleanAmount)) {
      return;
    }
    setRows((prev) => {
      const next = prev.map((row, i) => {
        if (i !== idx) return row;
        const nextSign = explicitSign ?? row.sign;
        return {
          ...row,
          sign: nextSign,
          amount: cleanAmount,
          loanId: resolveLoanIdForSign(nextSign, row.loanId),
        };
      });
      if (idx === 0) {
        return applyAutoRemainder(next);
      }
      return next;
    });
  };

  const handleSignToggle = (idx: number) => {
    if (idx === 1) {
      setRow2ManuallyEdited(true);
    }
    setRows((prev) => {
      const next = prev.map((row, i) => {
        if (i !== idx) return row;
        const nextSign: 1 | -1 = row.sign > 0 ? -1 : 1;
        return {
          ...row,
          sign: nextSign,
          loanId: resolveLoanIdForSign(nextSign, row.loanId),
        };
      });
      if (idx === 0) {
        return applyAutoRemainder(next);
      }
      return next;
    });
  };

  const handleCategoryChange = (idx: number, nextCat: string) => {
    setRows((prev) =>
      prev.map((row, i) =>
        i === idx
          ? {
              ...row,
              category: nextCat,
              loanId: isDebtLoansCategory(nextCat) ? row.loanId : '',
            }
          : row
      )
    );
  };

  const handleRowFieldChange = (
    idx: number,
    field: 'loanId' | 'notes' | 'tagsText',
    value: string
  ) => {
    setRows((prev) =>
      prev.map((row, i) => (i === idx ? { ...row, [field]: value } : row))
    );
  };

  const handleAddRow = () => {
    const hasRemainder = Math.abs(remaining) > balanceTolerance;
    const nextSign: 1 | -1 = hasRemainder ? (remaining < 0 ? -1 : 1) : defaultSign;
    const nextAmount = hasRemainder ? Math.abs(remaining).toFixed(decimals) : '';
    setRows((prev) => [
      ...prev,
      {
        sign: nextSign,
        amount: nextAmount,
        category: transaction.category || defaultCategory,
        loanId: '',
        notes: '',
        tagsText: '',
      },
    ]);
  };

  const handleRemoveRow = (idx: number) => {
    setRows((prev) => (prev.length > 2 ? prev.filter((_, i) => i !== idx) : prev));
  };

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      const payload: TransactionSplitInput[] = rows.map((r) => {
        const parsedAmt = roundToDecimals(r.sign * parseFloat(r.amount), decimals);
        const tags = parseTagsCsv(r.tagsText);
        const loanId =
          isDebtLoansCategory(r.category) && r.loanId.trim()
            ? Number(r.loanId)
            : null;
        return {
          amount: parsedAmt,
          category: r.category.trim(),
          tags,
          loan_id: loanId,
          notes: r.notes.trim() ? r.notes.trim() : null,
        };
      });
      const updatedTx = await updateTransactionSplits(transaction.id, payload);
      onSaved(updatedTx);
      onClose();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to save transaction splits');
    } finally {
      setSaving(false);
    }
  };

  const handleClearSplits = async () => {
    setSaving(true);
    setError(null);
    try {
      const updatedTx = await updateTransactionSplits(transaction.id, []);
      onSaved(updatedTx);
      onClose();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to clear transaction splits');
    } finally {
      setSaving(false);
    }
  };

  const isReadyToSave = isBalanced && !hasInvalidRows;
  const allocationText = isBalanced
    ? hasInvalidRows
      ? 'Enter all line amounts'
      : 'Balanced'
    : `Remaining: ${formatMoney(remaining, {
        currency: isCrypto ? '' : '$',
        minimumFractionDigits: 2,
        maximumFractionDigits: decimals,
        showPlusSign: true,
      })}`;

  const allocationBadgeClass = isReadyToSave
    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
    : 'bg-amber-500/15 text-amber-300 border-amber-500/30';

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
        {/* Parent Header + Allocation Status Pill */}
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

        {Boolean(error) && <AlertBanner variant="error">{error}</AlertBanner>}

        {/* Split Lines */}
        <div className="space-y-2.5 max-h-[48vh] overflow-y-auto pr-0.5">
          {rows.map((row, idx) => {
            const showLoan = isDebtLoansCategory(row.category);
            const filteredLoans = showLoan ? getFilteredLoans(row.sign, row.loanId) : [];
            return (
              <div
                key={idx}
                data-testid={`split-line-row-${idx}`}
                className="p-3 rounded-xl bg-background/60 border border-border/80 space-y-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-medium text-slate-400">
                    Split Line {idx + 1}
                  </span>
                  {rows.length > 2 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveRow(idx)}
                      data-testid={`remove-split-line-${idx}`}
                      aria-label={`Remove split line ${idx + 1}`}
                      className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

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
                        onClick={() => handleSignToggle(idx)}
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
                        onChange={(e) => handleAmountChange(idx, e.target.value)}
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
                      onChange={(e) => handleCategoryChange(idx, e.target.value)}
                      data-testid={`split-category-${idx}`}
                      className="w-full text-base sm:text-xs px-2.5 py-1.5 bg-background border border-border rounded-lg text-slate-200 focus:outline-none focus:border-violet-500"
                    >
                      {allCategoryChoices.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {showLoan && (
                  <div>
                    <label
                      htmlFor={`split-loan-${idx}`}
                      className="block text-[10px] uppercase tracking-wider text-slate-400 mb-1"
                    >
                      Financing / Loan
                    </label>
                    <select
                      id={`split-loan-${idx}`}
                      value={row.loanId}
                      onChange={(e) => handleRowFieldChange(idx, 'loanId', e.target.value)}
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
                )}

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
                      value={row.notes}
                      onChange={(e) => handleRowFieldChange(idx, 'notes', e.target.value)}
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
                      value={row.tagsText}
                      onChange={(e) => handleRowFieldChange(idx, 'tagsText', e.target.value)}
                      placeholder="e.g. family, dinner"
                      data-testid={`split-tags-${idx}`}
                      className="w-full text-base sm:text-xs px-2.5 py-1.5 bg-background border border-border rounded-lg text-slate-200 focus:outline-none focus:border-violet-500"
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/60">
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              type="button"
              variant="outline"
              size="xs"
              icon={<Plus className="w-3.5 h-3.5" />}
              onClick={handleAddRow}
              disabled={saving}
              data-testid="add-split-line-btn"
            >
              Add Split Line
            </Button>
            {Boolean(transaction.is_split) && (
              <Button
                type="button"
                variant="danger"
                size="xs"
                onClick={() => void handleClearSplits()}
                disabled={saving}
                data-testid="clear-splits-btn"
              >
                Clear Splits
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              loading={saving}
              loadingText="Saving..."
              disabled={!canSave}
              onClick={() => void handleSave()}
              data-testid="save-splits-btn"
            >
              Save Split
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
