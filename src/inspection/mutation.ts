import { useCallback, useState } from 'react';
import { plutusTransport } from '../transport';
import {
  Account,
  CategorizationRuleCreate,
  LoanItem,
  LoanType,
  RecurrenceType,
  Transaction,
} from '../types';
import { InspectionTransport, SharedInspectionListProps } from './types';

export type MutationTransport = Pick<
  InspectionTransport,
  | 'updateTransactionCategory'
  | 'updateTransactionTags'
  | 'updateTransactionRecurrence'
  | 'updateTransactionLoan'
  | 'updateTransactionCounterpart'
  | 'triggerReconcileTransfers'
>;

export interface AtomicMutationConfig<T> {
  run: () => Promise<T>;
  onStart?: () => void;
  onApplied?: (result: T) => void;
  reloadScope?: () => Promise<void>;
  onRefreshParent?: () => Promise<void> | void;
  onError?: (message: string) => void;
  onFinish?: () => void;
  fallbackError: string;
}

/**
 * Executes a transaction mutation and awaits both scope reload and parent
 * refresh before resolving or invoking `onFinish` to clear busy state.
 */
export async function executeAtomicMutation<T>({
  run,
  onStart,
  onApplied,
  reloadScope,
  onRefreshParent,
  onError,
  onFinish,
  fallbackError,
}: AtomicMutationConfig<T>): Promise<boolean> {
  onStart?.();
  try {
    const result = await run();
    onApplied?.(result);
    await Promise.all([
      reloadScope ? reloadScope() : Promise.resolve(),
      onRefreshParent ? Promise.resolve(onRefreshParent()) : Promise.resolve(),
    ]);
    return true;
  } catch (err) {
    console.error(err);
    onError?.(err instanceof Error ? err.message : fallbackError);
    return false;
  } finally {
    onFinish?.();
  }
}

export function buildLoanUpdatePatch(
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

export function buildCounterpartUpdatePatch(
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

export function buildRulePrefillFromTx(tx: Transaction): Partial<CategorizationRuleCreate> {
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

export interface UseTransactionMutationOptions {
  transport?: MutationTransport;
  onTransactionUpdated: (txId: number, patch: Partial<Transaction>) => void;
  reloadScope: () => Promise<void>;
  onRefreshParent: () => Promise<void> | void;
  onError: (message: string | null) => void;
}

interface MutationDispatchContext {
  transport: MutationTransport;
  runAtomic: <T>(opts: {
    txId: number | null;
    run: () => Promise<T>;
    onApplied?: (res: T) => void;
    fallbackError: string;
  }) => Promise<boolean>;
  onTransactionUpdated: (txId: number, patch: Partial<Transaction>) => void;
  setSuccessNote: (note: string | null) => void;
}

function createFieldMutators(ctx: MutationDispatchContext) {
  const { transport, runAtomic, onTransactionUpdated, setSuccessNote } = ctx;
  const handleCategoryChange = (txId: number, newCategory: string) => {
    if (!newCategory) return Promise.resolve(false);
    return runAtomic({
      txId,
      run: () => transport.updateTransactionCategory(txId, newCategory),
      onApplied: () => {
        setSuccessNote(`Moved transaction to "${newCategory}"`);
        onTransactionUpdated(txId, { category: newCategory });
      },
      fallbackError: 'Failed to update transaction category',
    });
  };
  const handleTagsChange = (txId: number, newTags: string[]) =>
    runAtomic({
      txId,
      run: () => transport.updateTransactionTags(txId, newTags),
      onApplied: (updated) => onTransactionUpdated(txId, { tags: updated.tags ?? newTags }),
      fallbackError: 'Failed to update transaction tags',
    });
  const handleRecurrenceChange = (txId: number, recurrence: RecurrenceType | null) =>
    runAtomic({
      txId,
      run: () => transport.updateTransactionRecurrence(txId, recurrence),
      onApplied: (updated) =>
        onTransactionUpdated(txId, { recurrence: updated.recurrence ?? recurrence }),
      fallbackError: 'Failed to update recurrence',
    });
  return { handleCategoryChange, handleTagsChange, handleRecurrenceChange };
}

function createRelationMutators(ctx: MutationDispatchContext) {
  const { transport, runAtomic, onTransactionUpdated, setSuccessNote } = ctx;
  const handleLoanChange = (
    txId: number,
    loanId: number | null,
    loanPaymentAmount?: number | null,
    fallbackLoanName?: string | null,
    fallbackLoanType?: LoanType | null
  ) =>
    runAtomic({
      txId,
      run: () => transport.updateTransactionLoan(txId, loanId, loanPaymentAmount),
      onApplied: (updated) => {
        const res = buildLoanUpdatePatch(
          updated, loanId, loanPaymentAmount, fallbackLoanName, fallbackLoanType
        );
        setSuccessNote(res.note);
        onTransactionUpdated(txId, res.patch);
      },
      fallbackError: 'Failed to update transaction loan',
    });
  const handleCounterpartChange = (
    txId: number,
    counterpartAccountId: number | null,
    fallbackAccount?: Account | null
  ) =>
    runAtomic({
      txId,
      run: () => transport.updateTransactionCounterpart(txId, counterpartAccountId),
      onApplied: (updated) => {
        const res = buildCounterpartUpdatePatch(updated, counterpartAccountId, fallbackAccount);
        setSuccessNote(res.note);
        onTransactionUpdated(txId, res.patch);
      },
      fallbackError: 'Failed to update counterpart account',
    });
  return { handleLoanChange, handleCounterpartChange };
}

function useMutationDispatchers(params: {
  transport: MutationTransport;
  onTransactionUpdated: (txId: number, patch: Partial<Transaction>) => void;
  reloadScope: () => Promise<void>;
  onRefreshParent: () => Promise<void> | void;
  onError: (message: string | null) => void;
}) {
  const { transport, onTransactionUpdated, reloadScope, onRefreshParent, onError } = params;
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [reconciling, setReconciling] = useState(false);
  const [successNote, setSuccessNote] = useState<string | null>(null);

  const runAtomic = useCallback(
    <T,>(opts: {
      txId: number | null;
      run: () => Promise<T>;
      onApplied?: (res: T) => void;
      fallbackError: string;
    }) =>
      executeAtomicMutation({
        run: opts.run,
        onStart: () => {
          onError(null);
          if (opts.txId !== null) setUpdatingId(opts.txId);
        },
        onApplied: opts.onApplied,
        reloadScope,
        onRefreshParent,
        onError: (msg) => onError(msg),
        onFinish: () => {
          if (opts.txId !== null) setUpdatingId(null);
        },
        fallbackError: opts.fallbackError,
      }),
    [onError, reloadScope, onRefreshParent]
  );

  const ctx: MutationDispatchContext = {
    transport, runAtomic, onTransactionUpdated, setSuccessNote,
  };
  const fields = createFieldMutators(ctx);
  const relations = createRelationMutators(ctx);

  const handleReconcileTransfers = useCallback(async () => {
    setReconciling(true);
    try {
      return await runAtomic({
        txId: null,
        run: () => transport.triggerReconcileTransfers(),
        onApplied: (res) => {
          setSuccessNote(
            res.matched_transfers > 0
              ? `Successfully reconciled and paired ${res.matched_transfers} transfer legs!`
              : 'All transfers are currently reconciled.'
          );
        },
        fallbackError: 'Failed to reconcile transfers',
      });
    } finally {
      setReconciling(false);
    }
  }, [runAtomic, transport]);

  return { updatingId, reconciling, successNote, setSuccessNote, runAtomic, fields, relations, handleReconcileTransfers };
}

/**
 * Unified hook for transaction mutations across all 4 inspection modals with
 * atomic scope + parent reload ordering before busy state is cleared.
 */
export function useTransactionMutation({
  transport = plutusTransport,
  onTransactionUpdated,
  reloadScope,
  onRefreshParent,
  onError,
}: UseTransactionMutationOptions) {
  const dispatch = useMutationDispatchers({
    transport, onTransactionUpdated, reloadScope, onRefreshParent, onError,
  });
  const [isRulesModalOpen, setIsRulesModalOpen] = useState(false);
  const [rulePrefill, setRulePrefill] = useState<Partial<CategorizationRuleCreate> | null>(null);

  const handleSplitsUpdated = useCallback(
    (updatedTx: Transaction) => {
      onTransactionUpdated(updatedTx.id, updatedTx);
      dispatch.setSuccessNote(
        updatedTx.is_split ? 'Saved transaction splits' : 'Cleared transaction splits'
      );
    },
    [onTransactionUpdated, dispatch.setSuccessNote]
  );

  const refreshExternal = useCallback(
    () => dispatch.runAtomic({ txId: null, run: () => Promise.resolve(), fallbackError: 'Failed to refresh transactions' }),
    [dispatch.runAtomic]
  );

  const handleCreateRuleFromTx = useCallback((tx: Transaction) => {
    setRulePrefill(buildRulePrefillFromTx(tx));
    setIsRulesModalOpen(true);
  }, []);

  const closeRulesModal = useCallback(() => {
    setIsRulesModalOpen(false);
    setRulePrefill(null);
  }, []);

  return {
    updatingId: dispatch.updatingId,
    reconciling: dispatch.reconciling,
    successNote: dispatch.successNote,
    setSuccessNote: dispatch.setSuccessNote,
    isRulesModalOpen,
    rulePrefill,
    ...dispatch.fields,
    ...dispatch.relations,
    handleReconcileTransfers: dispatch.handleReconcileTransfers,
    handleSplitsUpdated,
    handleReceiptUpdated: refreshExternal,
    handleRulesApplied: refreshExternal,
    handleCreateRuleFromTx,
    closeRulesModal,
  };
}

export type TransactionMutationHandle = ReturnType<typeof useTransactionMutation>;

export function buildInspectionListProps(params: {
  categories: readonly string[];
  loans: LoanItem[];
  accounts: Account[];
  mutation: TransactionMutationHandle;
  showAccountBadge?: boolean;
  fallbackCurrency?: string;
}): SharedInspectionListProps {
  const { categories, loans, accounts, mutation, showAccountBadge = true, fallbackCurrency } = params;
  return {
    categories,
    updatingId: mutation.updatingId,
    loans,
    accounts,
    showAccountBadge,
    fallbackCurrency,
    skipTransferCollapse: true,
    onCategoryChange: (txId, cat) => void mutation.handleCategoryChange(txId, cat),
    onTagsChange: (txId, tags) => void mutation.handleTagsChange(txId, tags),
    onRecurrenceChange: (txId, rec) => void mutation.handleRecurrenceChange(txId, rec ?? null),
    onLoanChange: (txId, loanId, amt) => {
      const matched = loans.find((l) => l.id === loanId);
      void mutation.handleLoanChange(txId, loanId, amt, matched?.name ?? null, matched?.loan_type ?? null);
    },
    onCounterpartChange: (txId, counterpartId) => {
      const matched = accounts.find((a) => a.id === counterpartId) ?? null;
      void mutation.handleCounterpartChange(txId, counterpartId, matched);
    },
    onCreateRule: mutation.handleCreateRuleFromTx,
    onReceiptUpdated: () => void mutation.handleReceiptUpdated(),
    onSplitsUpdated: mutation.handleSplitsUpdated,
  };
}
