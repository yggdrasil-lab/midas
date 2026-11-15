import { useCallback, useState } from 'react';
import { CategorizationRuleCreate, Transaction } from '../types';
import { updateTransactionCategory } from '../services/api';

interface UseTransactionCategoryMutationOptions {
  onTransactionUpdated: (txId: number, newCategory: string) => void;
  onChanged: () => void;
  onError?: (message: string) => void;
}

/**
 * Shared hook for mutating a transaction's category and launching the
 * categorization rule editor prefilled from a specific transaction.
 */
export function useTransactionCategoryMutation({
  onTransactionUpdated,
  onChanged,
  onError,
}: UseTransactionCategoryMutationOptions) {
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [successNote, setSuccessNote] = useState<string | null>(null);
  const [isRulesModalOpen, setIsRulesModalOpen] = useState(false);
  const [rulePrefill, setRulePrefill] = useState<Partial<CategorizationRuleCreate> | null>(null);

  const handleCategoryChange = useCallback(
    async (txId: number, newCategory: string) => {
      if (!newCategory) return;
      setUpdatingId(txId);
      try {
        await updateTransactionCategory(txId, newCategory);
        setSuccessNote(`Moved transaction to "${newCategory}"`);
        onTransactionUpdated(txId, newCategory);
        onChanged();
      } catch (err) {
        console.error(err);
        onError?.(err instanceof Error ? err.message : 'Failed to update transaction category');
      } finally {
        setUpdatingId(null);
      }
    },
    [onTransactionUpdated, onChanged, onError]
  );

  const handleCreateRuleFromTx = useCallback((tx: Transaction) => {
    setRulePrefill({
      name: `Rule for ${tx.merchant}`,
      description_pattern: tx.raw_description || tx.merchant,
      match_type: 'contains',
      amount_equals: null,
      target_category: tx.category,
      rename_merchant: tx.merchant,
      priority: 10,
      apply_retroactively: true,
    });
    setIsRulesModalOpen(true);
  }, []);

  const closeRulesModal = useCallback(() => {
    setIsRulesModalOpen(false);
    setRulePrefill(null);
  }, []);

  return {
    updatingId,
    successNote,
    setSuccessNote,
    isRulesModalOpen,
    rulePrefill,
    handleCategoryChange,
    handleCreateRuleFromTx,
    closeRulesModal,
  };
}
