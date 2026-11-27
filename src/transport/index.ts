import { createAccountsTransport } from './accounts';
import { createAnalyticsTransport } from './analytics';
import { createCategoriesTransport } from './categories';
import {
  appendPeriodParams,
  authHttpAdapter,
  createHttpClient,
  HttpAdapter,
  HttpClient,
  isMidasApiError,
  isSessionExpiredError,
  MidasApiError,
  SessionExpiredError,
} from './http';
import { createReceiptsTransport } from './receipts';
import {
  createTransactionsTransport,
  FetchFlowTransactionsParams,
  TransactionUpdatePayload,
} from './transactions';

export {
  appendPeriodParams,
  authHttpAdapter,
  createHttpClient,
  isMidasApiError,
  isSessionExpiredError,
  MidasApiError,
  SessionExpiredError,
};
export type {
  FetchFlowTransactionsParams,
  HttpAdapter,
  HttpClient,
  TransactionUpdatePayload,
};

export function createPlutusTransport(
  adapter: HttpAdapter = authHttpAdapter,
  baseUrl = '/api'
) {
  const client = createHttpClient(adapter, baseUrl);
  return {
    ...createAccountsTransport(client),
    ...createTransactionsTransport(client),
    ...createAnalyticsTransport(client),
    ...createCategoriesTransport(client),
    ...createReceiptsTransport(client),
  };
}

export type PlutusTransport = ReturnType<typeof createPlutusTransport>;

export const plutusTransport = createPlutusTransport();

export const {
  fetchInstitutions,
  fetchAccounts,
  updateAccount,
  fetchAccountSnapshots,
  recordAccountSnapshot,
  fetchLoans,
  createLoan,
  deleteLoan,
  syncAllIntegrations,
  quickLogExpense,
  uploadStatement,
  fetchAccountTransactions,
  fetchCategoryTransactions,
  fetchFlowTransactions,
  fetchTagTransactions,
  updateTransactionCategory,
  updateTransactionTags,
  updateTransactionRecurrence,
  updateTransactionLoan,
  updateTransactionCounterpart,
  updateTransactionSplits,
  triggerReconcileTransfers,
  fetchRunway,
  simulateScenario,
  synthesizeRunway,
  fetchSpendingBreakdown,
  fetchBudgetRules,
  upsertBudgetRule,
  deleteBudgetRule,
  initDefaultBudgets,
  fetchAverageBurn,
  syncBudgetsFromBurn,
  fetchTagSpendingSummary,
  fetchRules,
  createRule,
  updateRule,
  deleteRule,
  applyAllRules,
  fetchCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  fetchReceipts,
  fetchReceipt,
  uploadReceipt,
  deleteReceipt,
  reprocessReceipt,
  getReceiptImageUrl,
  updateReceiptItem,
  fetchProductStatistics,
  getReceiptCandidates,
  linkReceipt,
  reconcileReceipts,
  fetchProducts,
  fetchProduct,
  createProduct,
  updateProduct,
  deleteProduct,
} = plutusTransport;
