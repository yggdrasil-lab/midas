import { useCallback, useState } from 'react';
import {
  updateTransactionCategory,
  updateTransactionCounterpart,
  updateTransactionLoan,
  updateTransactionRecurrence,
  updateTransactionTags,
} from '../services/api';
import {
  Account,
  CategorizationRuleCreate,
  LoanType,
  RecurrenceType,
  Transaction,
} from '../types';

interface UseTransactionCategoryMutationOptions {
  onTransactionUpdated: (txId: number, patch: Partial<Transaction>) => void;
  onChanged: () => void;
  onError?: (message: string) => void;
}

function buildLoanUpdatePatch(
  updated: Transaction,
  loanId: number | null,
  loanPaymentAmount?: number | null,
  fallbackLoanName?: string | null,
  fallbackLoanType?: LoanType | null
) {
  const resolvedLoanId = updated.loan_id !== undefined ? updated.loan_id : loanId;
  const resolvedLoanName =
    resolvedLoanId == null ? null : updated.loan_name ?? fallbackLoanName ?? null;
  const resolvedLoanType =
    resolvedLoanId == null ? null : updated.loan_type ?? fallbackLoanType ?? null;
  const resolvedLoanPaymentAmount =
    resolvedLoanId == null
      ? null
      : updated.loan_payment_amount !== undefined
        ? updated.loan_payment_amount
        : loanPaymentAmount ?? null;
  const note =
    resolvedLoanId == null
      ? 'Unlinked financing loan'
      : resolvedLoanName
        ? `Linked transaction to "${resolvedLoanName}"`
        : 'Linked transaction to financing loan';
  return {
    note,
    patch: {
      loan_id: resolvedLoanId ?? null,
      loan_name: resolvedLoanName,
      loan_type: resolvedLoanType,
      loan_payment_amount: resolvedLoanPaymentAmount,
    },
  };
}

function buildCounterpartUpdatePatch(
  updated: Transaction,
  counterpartAccountId: number | null,
  fallbackAccount?: Account | null
) {
  const resolvedId =
    updated.counterpart_account_id !== undefined
      ? updated.counterpart_account_id
      : counterpartAccountId;
  const resolvedName =
    resolvedId == null ? null : updated.counterpart_account_name ?? fallbackAccount?.name ?? null;
  const resolvedType =
    resolvedId == null
      ? null
      : updated.counterpart_account_type ?? fallbackAccount?.account_type ?? null;
  const note =
    resolvedId == null
      ? 'Cleared counterpart account'
      : resolvedName
        ? `Attributed transaction to "${resolvedName}"`
        : 'Updated counterpart account';
  return {
    note,
    patch: {
      counterpart_account_id: resolvedId ?? null,
      counterpart_account_name: resolvedName,
      counterpart_account_type: resolvedType,
    },
  };
}

function buildRulePrefillFromTx(tx: Transaction): Partial<CategorizationRuleCreate> {
  return {
    name: `Rule for ${tx.merchant}`,
    description_pattern: tx.raw_description || tx.merchant,
    match_type: 'contains',
    amount_equals: null,
    target_category: tx.category,
    target_tags: tx.tags || [],
    target_recurrence: tx.recurrence || null,
    rename_merchant: tx.merchant,
    counterpart_account_id: tx.counterpart_account_id ?? null,
    loan_id: tx.loan_id ?? null,
    priority: 10,
    apply_retroactively: true,
  };
}

function useBasicTransactionMutations(opts: {
  onTransactionUpdated: (txId: number, patch: Partial<Transaction>) => void;
  onChanged: () => void;
  onError?: (message: string) => void;
  setUpdatingId: (id: number | null) => void;
  setSuccessNote: (note: string | null) => void;
}) {
  const { onTransactionUpdated, onChanged, onError, setUpdatingId, setSuccessNote } = opts;

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
    [onTransactionUpdated, onChanged, onError, setUpdatingId, setSuccessNote]
  );

  const handleTagsChange = useCallback(
    async (txId: number, newTags: string[]) => {
      onError?.('');
      try {
        const updated = await updateTransactionTags(txId, newTags);
        onTransactionUpdated(txId, { tags: updated.tags ?? newTags });
        onChanged();
      } catch (err) {
        console.error(err);
        onError?.(err instanceof Error ? err.message : 'Failed to update transaction tags');
      }
    },
    [onTransactionUpdated, onChanged, onError]
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

  return { handleCategoryChange, handleTagsChange, handleRecurrenceChange };
}

function useLinkedRelationMutations(opts: {
  onTransactionUpdated: (txId: number, patch: Partial<Transaction>) => void;
  onChanged: () => void;
  onError?: (message: string) => void;
  setUpdatingId: (id: number | null) => void;
  setSuccessNote: (note: string | null) => void;
}) {
  const { onTransactionUpdated, onChanged, onError, setUpdatingId, setSuccessNote } = opts;

  const handleLoanChange = useCallback(
    async (
      txId: number,
      loanId: number | null,
      loanPaymentAmount?: number | null,
      fallbackLoanName?: string | null,
      fallbackLoanType?: LoanType | null
    ) => {
      setUpdatingId(txId);
      onError?.('');
      try {
        const updated = await updateTransactionLoan(txId, loanId, loanPaymentAmount);
        const result = buildLoanUpdatePatch(
          updated, loanId, loanPaymentAmount, fallbackLoanName, fallbackLoanType
        );
        setSuccessNote(result.note);
        onTransactionUpdated(txId, result.patch);
        onChanged();
      } catch (err) {
        console.error(err);
        onError?.(err instanceof Error ? err.message : 'Failed to update transaction loan');
      } finally {
        setUpdatingId(null);
      }
    },
    [onTransactionUpdated, onChanged, onError, setUpdatingId, setSuccessNote]
  );

  const handleCounterpartChange = useCallback(
    async (
      txId: number,
      counterpartAccountId: number | null,
      fallbackAccount?: Account | null
    ) => {
      setUpdatingId(txId);
      onError?.('');
      try {
        const updated = await updateTransactionCounterpart(txId, counterpartAccountId);
        const result = buildCounterpartUpdatePatch(updated, counterpartAccountId, fallbackAccount);
        setSuccessNote(result.note);
        onTransactionUpdated(txId, result.patch);
        onChanged();
      } catch (err) {
        console.error(err);
        onError?.(err instanceof Error ? err.message : 'Failed to update counterpart account');
      } finally {
        setUpdatingId(null);
      }
    },
    [onTransactionUpdated, onChanged, onError, setUpdatingId, setSuccessNote]
  );

  return { handleLoanChange, handleCounterpartChange };
}

/**
 * Shared hook for mutating a transaction's category, tags, recurrence,
 * financing loan, and counterpart account, plus launching the rule editor.
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

  const basic = useBasicTransactionMutations({
    onTransactionUpdated, onChanged, onError, setUpdatingId, setSuccessNote,
  });
  const relations = useLinkedRelationMutations({
    onTransactionUpdated, onChanged, onError, setUpdatingId, setSuccessNote,
  });

  const handleCreateRuleFromTx = useCallback((tx: Transaction) => {
    setRulePrefill(buildRulePrefillFromTx(tx));
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
    ...basic,
    ...relations,
    handleCreateRuleFromTx,
    closeRulesModal,
  };
}
