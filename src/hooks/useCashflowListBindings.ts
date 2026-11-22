import React, { useCallback, useRef } from 'react';
import { TransactionList } from '../components/TransactionList';
import { Account, LoanItem, Transaction } from '../types';
import { useTransactionCategoryMutation } from './useTransactionCategoryMutation';

export type SharedCashflowListProps = Omit<
  React.ComponentProps<typeof TransactionList>,
  'transactions' | 'loading' | 'scrollable' | 'emptyTitle'
>;

interface UseCashflowListBindingsParams {
  categoryNames: readonly string[];
  loans: LoanItem[];
  accounts: Account[];
  reload: () => void;
  onDataChanged: () => void;
  patchTransactionLocal: (txId: number, patch: Partial<Transaction>) => void;
  setError: (msg: string | null) => void;
}

function buildCashflowListProps(params: {
  categoryNames: readonly string[];
  loans: LoanItem[];
  accounts: Account[];
  mutation: ReturnType<typeof useTransactionCategoryMutation>;
  withReload: (task: Promise<void>) => Promise<void>;
  reload: () => void;
  onDataChanged: () => void;
  patchTransactionLocal: (txId: number, patch: Partial<Transaction>) => void;
}): SharedCashflowListProps {
  const { categoryNames, loans, accounts, mutation, withReload, reload, onDataChanged, patchTransactionLocal } = params;
  return {
    categories: categoryNames,
    updatingId: mutation.updatingId,
    loans,
    accounts,
    showAccountBadge: true,
    onCategoryChange: (txId, cat) => void withReload(mutation.handleCategoryChange(txId, cat)),
    onTagsChange: (txId, tags) => void mutation.handleTagsChange(txId, tags),
    onRecurrenceChange: (txId, rec) => void withReload(mutation.handleRecurrenceChange(txId, rec ?? null)),
    onLoanChange: (txId, loanId, amt) => {
      const matched = loans.find((l) => l.id === loanId);
      void withReload(mutation.handleLoanChange(txId, loanId, amt, matched?.name ?? null, matched?.loan_type ?? null));
    },
    onCounterpartChange: (txId, counterpartId) => {
      const matched = accounts.find((a) => a.id === counterpartId) ?? null;
      void withReload(mutation.handleCounterpartChange(txId, counterpartId, matched));
    },
    onCreateRule: mutation.handleCreateRuleFromTx,
    onReceiptUpdated: () => { reload(); onDataChanged(); },
    onSplitsUpdated: (updatedTx) => {
      patchTransactionLocal(updatedTx.id, updatedTx);
      mutation.setSuccessNote(updatedTx.is_split ? 'Saved transaction splits' : 'Cleared transaction splits');
      reload();
      onDataChanged();
    },
  };
}

/**
 * Connects TransactionList inline edits, splits, receipts, and rules to
 * cashflow modal reloads and parent spending breakdown refreshes.
 */
export function useCashflowListBindings(params: UseCashflowListBindingsParams) {
  const { categoryNames, loans, accounts, reload, onDataChanged, patchTransactionLocal, setError } = params;
  const mutationSucceededRef = useRef(false);

  const handleUpdated = useCallback(
    (txId: number, patch: Partial<Transaction>) => {
      mutationSucceededRef.current = true;
      patchTransactionLocal(txId, patch);
    },
    [patchTransactionLocal]
  );

  const mutation = useTransactionCategoryMutation({
    onTransactionUpdated: handleUpdated,
    onChanged: onDataChanged,
    onError: (msg) => setError(msg || null),
  });

  const withReload = useCallback(
    async (task: Promise<void>) => {
      setError(null);
      mutationSucceededRef.current = false;
      await task;
      if (mutationSucceededRef.current) reload();
    },
    [reload, setError]
  );

  const listProps = buildCashflowListProps({
    categoryNames, loans, accounts, mutation, withReload, reload, onDataChanged, patchTransactionLocal,
  });
  return { mutation, listProps };
}
