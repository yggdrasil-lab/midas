import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowRightLeft, Check, Layers } from 'lucide-react';
import {
  AlertBanner,
  Button,
  Modal,
  SearchInput,
  SummaryMetricGrid,
} from '@yggdrasil-lab/ui';
import {
  CATEGORY_CHOICES,
  formatPeriodLabel,
  isTransferCategory as checkTransferCategory,
} from '../constants/categories';
import { useTransactionCategoryMutation } from '../hooks/useTransactionCategoryMutation';
import {
  fetchCategoryTransactions,
  triggerReconcileTransfers,
  updateTransactionTags,
} from '../services/api';
import { PeriodType, Transaction } from '../types';
import { formatMoney } from '../utils/format';
import { RulesManagerModal } from './RulesManagerModal';
import { TransactionList } from './TransactionList';

interface CategoryTransactionInspectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  category?: string;
  period: PeriodType;
  onCategoryChanged: () => void;
}

/**
 * Modal for inspecting transactions within a spending category, reconciling
 * inter-account transfers, and recategorizing or creating rules inline.
 */
export const CategoryTransactionInspectionModal: React.FC<
  CategoryTransactionInspectionModalProps
> = ({ isOpen, onClose, category, period, onCategoryChanged }) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reconciling, setReconciling] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const handleTransactionUpdated = useCallback((txId: number, newCategory: string) => {
    setTransactions((prev) =>
      prev.map((t) => (t.id === txId ? { ...t, category: newCategory } : t))
    );
  }, []);

  const handleTagsChange = useCallback(async (txId: number, newTags: string[]) => {
    setError(null);
    try {
      const updated = await updateTransactionTags(txId, newTags);
      setTransactions((prev) =>
        prev.map((t) => (t.id === txId ? { ...t, tags: updated.tags ?? newTags } : t))
      );
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to update transaction tags');
    }
  }, []);

  const {
    updatingId,
    successNote,
    setSuccessNote,
    isRulesModalOpen,
    rulePrefill,
    handleCategoryChange,
    handleCreateRuleFromTx,
    closeRulesModal,
  } = useTransactionCategoryMutation({
    onTransactionUpdated: handleTransactionUpdated,
    onChanged: onCategoryChanged,
    onError: setError,
  });

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
      setSearchQuery('');
      loadTransactions();
    }
  }, [isOpen, category, period]);

  const handleReconcileTransfers = async () => {
    setReconciling(true);
    setError(null);
    try {
      const res = await triggerReconcileTransfers();
      setSuccessNote(
        res.matched_transfers > 0
          ? `Successfully reconciled and paired ${res.matched_transfers} transfer legs!`
          : 'All transfers are currently reconciled.'
      );
      loadTransactions();
      onCategoryChanged();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to reconcile transfers');
    } finally {
      setReconciling(false);
    }
  };

  const filteredTransactions = useMemo(() => {
    if (!searchQuery.trim()) return transactions;
    const q = searchQuery.toLowerCase().replace(/^#+/, '');
    return transactions.filter(
      (tx) =>
        tx.merchant.toLowerCase().includes(q) ||
        (tx.account_name || '').toLowerCase().includes(q) ||
        (tx.raw_description || '').toLowerCase().includes(q) ||
        (tx.tags || []).some((tag) => tag.toLowerCase().includes(q))
    );
  }, [transactions, searchQuery]);

  const totalVolume = useMemo(
    () => transactions.reduce((sum, tx) => sum + Math.abs(Number(tx.amount)), 0),
    [transactions]
  );

  if (!category) return null;

  const isTransferCategory = checkTransferCategory(category);
  const periodLabel = formatPeriodLabel(period);
  const avgTx = transactions.length > 0 ? totalVolume / transactions.length : 0;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Inspect Category: ${category}`}>
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

        <SummaryMetricGrid
          columns={3}
          items={[
            {
              id: 'total',
              label: 'Total Volume',
              value: formatMoney(totalVolume, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
              valueClassName: 'text-slate-100 font-mono text-xs',
            },
            {
              id: 'count',
              label: 'Transactions',
              value: transactions.length,
              valueClassName: 'text-amber-300 font-mono text-xs',
            },
            {
              id: 'avg',
              label: 'Average',
              value: formatMoney(avgTx, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
              valueClassName: 'text-slate-200 font-mono text-xs',
            },
          ]}
        />

        {/* Transfer context callout */}
        {isTransferCategory && (
          <div className="space-y-2">
            <AlertBanner variant="info" title="Inter-Account Transfers & Foreign Exchange">
              Transactions classified under Transfers represent money moving between your own accounts (such as ASB, DBS Singapore, Philippine banks, Bitcoin/crypto wallets, or Wise). They are excluded from your operational spending and weekly burn calculations.
            </AlertBanner>
            <div className="flex justify-end">
              <Button
                variant="secondary"
                size="xs"
                loading={reconciling}
                loadingText="Pairing..."
                icon={<ArrowRightLeft className="w-3.5 h-3.5 text-sky-400" />}
                onClick={handleReconcileTransfers}
              >
                Reconcile Transfers Now
              </Button>
            </div>
          </div>
        )}

        {error && <AlertBanner variant="error">{error}</AlertBanner>}
        {successNote && (
          <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-xs text-emerald-300 flex items-center space-x-2 animate-in fade-in">
            <Check className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
            <span>{successNote}</span>
          </div>
        )}

        {transactions.length > 0 && (
          <SearchInput
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Filter by merchant or account..."
            variant="amber"
          />
        )}

        <TransactionList
          transactions={filteredTransactions}
          categories={CATEGORY_CHOICES}
          loading={loading}
          loadingLabel="Loading transactions..."
          emptyTitle={`No transactions found for ${category} in ${periodLabel.toLowerCase()}.`}
          updatingId={updatingId}
          onCategoryChange={(txId, cat) => {
            setError(null);
            void handleCategoryChange(txId, cat);
          }}
          onTagsChange={(txId, newTags) => {
            void handleTagsChange(txId, newTags);
          }}
          onCreateRule={handleCreateRuleFromTx}
          showAccountBadge
        />

        <div className="pt-2 flex justify-end">
          <Button variant="outline" size="sm" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>

      <RulesManagerModal
        isOpen={isRulesModalOpen}
        onClose={closeRulesModal}
        prefillRule={rulePrefill}
        onRulesApplied={() => {
          loadTransactions();
          onCategoryChanged();
        }}
      />
    </Modal>
  );
};
