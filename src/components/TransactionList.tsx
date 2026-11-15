import React from 'react';
import { EmptyState, LoadingState } from '@yggdrasil-lab/ui';
import { Transaction } from '../types';
import { TransactionRow } from './TransactionRow';

interface TransactionListProps {
  transactions: Transaction[];
  categories: readonly string[];
  loading: boolean;
  loadingLabel?: string;
  emptyTitle: string;
  emptyDescription?: string;
  updatingId: number | null;
  onCategoryChange: (txId: number, category: string) => void;
  onCreateRule: (tx: Transaction) => void;
  showAccountBadge?: boolean;
  fallbackCurrency?: string;
  listTestId?: string;
  getRowTestId?: (tx: Transaction) => string;
  getSelectTestId?: (tx: Transaction) => string;
  getRuleBtnTestId?: (tx: Transaction) => string;
}

/**
 * Scrollable transaction list wrapper with unified loading, empty, and row states.
 */
export const TransactionList: React.FC<TransactionListProps> = ({
  transactions,
  categories,
  loading,
  loadingLabel = 'Loading transactions...',
  emptyTitle,
  emptyDescription,
  updatingId,
  onCategoryChange,
  onCreateRule,
  showAccountBadge = true,
  fallbackCurrency,
  listTestId,
  getRowTestId,
  getSelectTestId,
  getRuleBtnTestId,
}) => {
  if (loading) {
    return <LoadingState label={loadingLabel} variant="amber" />;
  }

  if (transactions.length === 0) {
    return (
      <EmptyState
        title={emptyTitle}
        description={emptyDescription}
        variant="dashed"
      />
    );
  }

  return (
    <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1" data-testid={listTestId}>
      {transactions.map((tx) => (
        <TransactionRow
          key={tx.id}
          transaction={tx}
          categories={categories}
          updating={updatingId === tx.id}
          onCategoryChange={onCategoryChange}
          onCreateRule={onCreateRule}
          showAccountBadge={showAccountBadge}
          fallbackCurrency={fallbackCurrency}
          rowTestId={getRowTestId?.(tx)}
          selectTestId={getSelectTestId?.(tx)}
          ruleBtnTestId={getRuleBtnTestId?.(tx)}
        />
      ))}
    </div>
  );
};
