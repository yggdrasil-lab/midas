import React, { useEffect, useState } from 'react';
import { Layers, Check, RefreshCw } from 'lucide-react';
import { Modal, Button, AlertBanner } from '@yggdrasil-lab/ui';
import { Transaction } from '../types';
import { fetchCategoryTransactions, updateTransactionCategory } from '../services/api';

interface CategoryTransactionInspectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  category?: string;
  period: 'month' | 'week' | 'all';
  onCategoryChanged: () => void;
}

const CATEGORY_CHOICES = [
  'Groceries',
  'Food',
  'Transport',
  'Utilities',
  'Health',
  'Leisure',
  'Insurance',
  'Travel',
  'Transfers',
  'Income',
  'General',
];

export const CategoryTransactionInspectionModal: React.FC<CategoryTransactionInspectionModalProps> = ({
  isOpen,
  onClose,
  category,
  period,
  onCategoryChanged,
}) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [successNote, setSuccessNote] = useState<string | null>(null);

  const loadTransactions = async () => {
    if (!category) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetchCategoryTransactions(category, period);
      setTransactions(res);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to load category transactions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && category) {
      setSuccessNote(null);
      loadTransactions();
    }
  }, [isOpen, category, period]);

  const handleCategoryChange = async (txId: number, newCategory: string) => {
    if (!newCategory) return;
    setUpdatingId(txId);
    setError(null);
    try {
      await updateTransactionCategory(txId, newCategory);
      setSuccessNote(`Moved transaction to "${newCategory}"`);
      // Update local transaction category
      setTransactions((prev) =>
        prev.map((t) => (t.id === txId ? { ...t, category: newCategory } : t))
      );
      onCategoryChanged();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to update transaction category');
    } finally {
      setUpdatingId(null);
    }
  };

  if (!category) return null;

  const isTransferCategory = category.toLowerCase() === 'transfers' || category.toLowerCase() === 'transfer';
  const periodLabel = period === 'week' ? 'This Week' : period === 'month' ? 'This Month' : 'All Time';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Inspect Category: ${category}`}
    >
      <div className="space-y-4">
        {/* Info header banner */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs text-slate-300 bg-card/60 p-3 rounded-xl border border-border gap-2">
          <div className="flex items-center space-x-2">
            <span className="p-1 rounded bg-amber-500/10 text-amber-400">
              <Layers className="w-3.5 h-3.5" />
            </span>
            <span className="font-semibold text-slate-200">{category}</span>
            <span className="text-[11px] text-slate-400">({periodLabel})</span>
          </div>
          <div className="text-[11px] text-slate-400">
            {transactions.length} {transactions.length === 1 ? 'transaction' : 'transactions'}
          </div>
        </div>

        {/* Transfer context callout */}
        {isTransferCategory && (
          <AlertBanner variant="info" title="Inter-Account Transfers">
            Transactions classified under Transfers represent money moving between your own accounts (such as Wise, ASB, or ANZ). They are excluded from your operational spending and weekly burn calculations.
          </AlertBanner>
        )}

        {error && <AlertBanner variant="error">{error}</AlertBanner>}
        {successNote && (
          <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-xs text-emerald-300 flex items-center space-x-2 animate-in fade-in">
            <Check className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
            <span>{successNote}</span>
          </div>
        )}

        {/* Transaction list */}
        {loading ? (
          <div className="py-8 flex flex-col items-center justify-center space-y-2 text-slate-400 text-xs">
            <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
            <span>Loading transactions...</span>
          </div>
        ) : transactions.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400 bg-card/30 rounded-xl border border-border/50">
            No transactions found for {category} in {periodLabel.toLowerCase()}.
          </div>
        ) : (
          <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
            {transactions.map((tx) => {
              const amt = Number(tx.amount);
              const isDebit = amt < 0;
              const formattedAmt = `${isDebit ? '-' : '+'}$${Math.abs(amt).toFixed(2)}`;

              return (
                <div
                  key={tx.id}
                  className="p-3 bg-card/60 hover:bg-card/80 border border-border rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors"
                >
                  {/* Left: Date, merchant, account badge */}
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center space-x-2">
                      <span className="text-[11px] font-mono text-slate-400">
                        {tx.transaction_date}
                      </span>
                      {tx.account_name && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 font-medium">
                          {tx.account_name}
                        </span>
                      )}
                    </div>
                    <div className="text-xs font-medium text-slate-200 truncate" title={tx.raw_description || tx.merchant}>
                      {tx.merchant}
                    </div>
                  </div>

                  {/* Right: Amount & Category selector */}
                  <div className="flex items-center justify-between sm:justify-end space-x-3 shrink-0">
                    <span
                      className={`text-xs font-semibold font-mono ${
                        isTransferCategory
                          ? 'text-sky-300'
                          : isDebit
                          ? 'text-rose-400'
                          : 'text-emerald-400'
                      }`}
                    >
                      {formattedAmt}
                    </span>

                    {/* Category quick changer */}
                    <div className="flex items-center space-x-1.5">
                      <select
                        value={tx.category}
                        onChange={(e) => handleCategoryChange(tx.id, e.target.value)}
                        disabled={updatingId === tx.id}
                        aria-label={`Category for ${tx.merchant}`}
                        className="text-[11px] px-2 py-1 bg-background border border-border hover:border-amber-500/50 rounded-lg text-slate-200 focus:outline-none focus:border-amber-500 transition-colors disabled:opacity-50"
                      >
                        {CATEGORY_CHOICES.map((choice) => (
                          <option key={choice} value={choice}>
                            {choice}
                          </option>
                        ))}
                      </select>
                      {updatingId === tx.id && (
                        <RefreshCw className="w-3 h-3 animate-spin text-amber-400 shrink-0" />
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="pt-2 flex justify-end">
          <Button variant="outline" size="sm" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </Modal>
  );
};
