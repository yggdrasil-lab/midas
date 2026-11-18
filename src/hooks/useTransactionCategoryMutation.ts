import { useCallback, useState } from 'react';
import {
  updateTransactionCategory,
  updateTransactionRecurrence,
  updateTransactionTags,
} from '../services/api';
import { CategorizationRuleCreate, RecurrenceType, Transaction } from '../types';

interface UseTransactionCategoryMutationOptions {
  onTransactionUpdated: (txId: number, patch: Partial<Transaction>) => void;
  onChanged: () => void;
  onError?: (message: string) => void;
}

/**
 * Shared hook for mutating a transaction's category, tags, and recurrence,
 * and launching the categorization rule editor prefilled from a transaction.
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
        onTransactionUpdated(txId, { category: newCategory });
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

  const handleTagsChange = useCallback(
    async (txId: number, newTags: string[]) => {
      onError?.('');
      try {
        const updated = await updateTransactionTags(txId, newTags);
        onTransactionUpdated(txId, { tags: updated.tags ?? newTags });
      } catch (err) {
        console.error(err);
        onError?.(err instanceof Error ? err.message : 'Failed to update transaction tags');
      }
    },
    [onTransactionUpdated, onError]
  );

  const handleRecurrenceChange = useCallback(
    async (txId: number, recurrence: RecurrenceType | null) => {
      onError?.('');
      try {
        const updated = await updateTransactionRecurrence(txId, recurrence);
        onTransactionUpdated(txId, { recurrence: updated.recurrence ?? recurrence });
        onChanged();
      } catch (err) {
        console.error(err);
        onError?.(err instanceof Error ? err.message : 'Failed to update recurrence');
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
      target_tags: tx.tags || [],
      target_recurrence: tx.recurrence || null,
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
    handleTagsChange,
    handleRecurrenceChange,
    handleCreateRuleFromTx,
    closeRulesModal,
  };
}
