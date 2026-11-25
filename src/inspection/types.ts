import type React from 'react';
import type { TransactionList } from '../components/TransactionList';
import type { PlutusTransport } from '../transport';
import type {
  Account,
  CashflowDirection,
  CategorySpendingReport,
  LoanItem,
  PeriodType,
  SpendingBreakdownResponse,
  TagCategoryBreakdownItem,
  Transaction,
} from '../types';

export type InspectionScopeKind = 'account' | 'cashflow' | 'category' | 'tag';

export type InspectionTransport = Pick<
  PlutusTransport,
  | 'fetchLoans'
  | 'fetchAccounts'
  | 'fetchAccountTransactions'
  | 'fetchFlowTransactions'
  | 'fetchCategoryTransactions'
  | 'fetchTagTransactions'
  | 'updateTransactionCategory'
  | 'updateTransactionTags'
  | 'updateTransactionRecurrence'
  | 'updateTransactionLoan'
  | 'updateTransactionCounterpart'
  | 'triggerReconcileTransfers'
>;

export interface InspectionContextState {
  loans: LoanItem[];
  accounts: Account[];
  contextLoading: boolean;
  contextError: string | null;
}

export interface CashflowPartition {
  actualTransactions: Transaction[];
  amortizedCommitments: Transaction[];
  excludedTransactions: Transaction[];
}

export interface CashflowSummaryMetrics {
  headlineTotal: number;
  itemCount: number;
  itemSubvalue?: string;
  thirdMetricLabel: string;
  thirdMetricValue: number;
  thirdMetricSubvalue?: string;
  actualVolume: number;
  amortizedVolume: number;
  excludedVolume: number;
  annualizedShareTotal: number;
}

export interface ComputeCashflowSummaryParams {
  activeFlow: CashflowDirection;
  period: PeriodType;
  selectedCategory: string;
  totalCount: number;
  breakdown: SpendingBreakdownResponse | null;
  partition: CashflowPartition;
  annualizedCategories: CategorySpendingReport[];
}

export interface AccountCashflowSummary {
  totalSpend: number;
  totalIncome: number;
  totalTransfers: number;
}

export interface TagStatsSummary {
  totalSpend: number;
  txCount: number;
  categories: TagCategoryBreakdownItem[];
}

export type SharedInspectionListProps = Omit<
  React.ComponentProps<typeof TransactionList>,
  | 'transactions'
  | 'loading'
  | 'scrollable'
  | 'emptyTitle'
  | 'loadingLabel'
  | 'listTestId'
  | 'getRowTestId'
  | 'getSelectTestId'
  | 'getRuleBtnTestId'
>;
