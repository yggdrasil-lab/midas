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
} from '../services/api';
import { PeriodType, Transaction } from '../types';
import { formatMoney, getTransactionNzdAmount } from '../utils/format';
import { collapsePairedTransfers } from '../utils/transfers';
import { RulesManagerModal } from './RulesManagerModal';
import { TransactionList } from './TransactionList';

interface CategoryTransactionInspectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  category?: string;
  period: PeriodType;
  startDate?: string;
  endDate?: string;
  isAnnualOverride?: boolean;
  onCategoryChanged: () => void;
}

/**
 * Modal for inspecting transactions within a spending category, reconciling
 * inter-account transfers, and recategorizing or creating rules inline.
 */
export const CategoryTransactionInspectionModal: React.FC<
  CategoryTransactionInspectionModalProps
> = ({
  isOpen,
  onClose,
  category,
  period,
  startDate,
  endDate,
  isAnnualOverride = false,
  onCategoryChanged,
}) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reconciling, setReconciling] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const handleTransactionUpdated = useCallback((txId: number, patch: Partial<Transaction>) => {
    setTransactions((prev) =>
      prev.map((t) => (t.id === txId ? { ...t, ...patch } : t))
    );
  }, []);

  const {
    updatingId,
    successNote,
    setSuccessNote,
    isRulesModalOpen,
    rulePrefill,
    handleCategoryChange,
    handleTagsChange,
    handleRecurrenceChange,
    handleCreateRuleFromTx,
    closeRulesModal,
  } = useTransactionCategoryMutation({
    onTransactionUpdated: handleTransactionUpdated,
    onChanged: onCategoryChanged,
    onError: (msg) => setError(msg || null),
  });

  const loadTransactions = async () => {
    if (!category) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetchCategoryTransactions(
        category,
        period,
        period === 'custom' ? startDate : undefined,
        period === 'custom' ? endDate : undefined
      );
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
  }, [isOpen, category, period, startDate, endDate]);

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

  const collapsedTransactions = useMemo(
    () => collapsePairedTransfers(transactions),
    [transactions]
  );

  const filteredTransactions = useMemo(() => {
    if (!searchQuery.trim()) return collapsedTransactions;
    const q = searchQuery.toLowerCase().replace(/^#+/, '');
    return collapsedTransactions.filter(
      (tx) =>
        tx.merchant.toLowerCase().includes(q) ||
        (tx.account_name || '').toLowerCase().includes(q) ||
        (tx.linked_account_name || '').toLowerCase().includes(q) ||
        (tx.raw_description || '').toLowerCase().includes(q) ||
        (tx.tags || []).some((tag) => tag.toLowerCase().includes(q))
    );
  }, [collapsedTransactions, searchQuery]);

  const totalVolume = useMemo(
    () =>
      collapsedTransactions.reduce(
        (sum, tx) => sum + getTransactionNzdAmount(tx),
        0
      ),
    [collapsedTransactions]
  );

  if (!category) return null;

  const isTransferCategory = checkTransferCategory(category);
  const periodLabel = formatPeriodLabel(period, startDate, endDate);
  const avgTx = collapsedTransactions.length > 0 ? totalVolume / collapsedTransactions.length : 0;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Inspect Category: ${category}`}
      className="sm:max-w-2xl"
    >
      <div className="space-y-4" data-testid="category-inspection-modal">
        {/* Info header banner */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs text-slate-300 bg-card/60 p-3 rounded-xl border border-border gap-2">
          <div className="flex items-center space-x-2 flex-wrap gap-y-1">
            <span className="p-1 rounded bg-amber-500/10 text-amber-400">
              <Layers className="w-3.5 h-3.5" />
            </span>
            <span className="font-semibold text-slate-200">{category}</span>
            <span className="text-[11px] text-slate-400">({periodLabel})</span>
            {isAnnualOverride && (
              <span
                className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 font-medium"
                data-testid="annual-override-badge"
              >
                52w Annual Budget Period
              </span>
            )}
          </div>
          <div className="text-[11px] text-slate-400">
            {collapsedTransactions.length} {collapsedTransactions.length === 1 ? 'transaction' : 'transactions'}
          </div>
        </div>

        <SummaryMetricGrid
          columns={3}
          items={[
            {
              id: 'total',
              label: 'Total',
              value: formatMoney(totalVolume, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
              valueClassName: 'text-slate-100 font-mono text-xs sm:text-sm tracking-tight',
            },
            {
              id: 'count',
              label: 'Txns',
              value: collapsedTransactions.length,
              valueClassName: 'text-amber-300 font-mono text-xs sm:text-sm tracking-tight',
            },
            {
              id: 'avg',
              label: 'Average',
              value: formatMoney(avgTx, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
              valueClassName: 'text-slate-200 font-mono text-xs sm:text-sm tracking-tight',
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
          onRecurrenceChange={(txId, recurrence) => {
            void handleRecurrenceChange(txId, recurrence);
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
