import { authFetch } from '@yggdrasil-lab/ui';
import {
  Account,
  AssetSnapshot,
  AssetSnapshotCreatePayload,
  AverageBurnReportResponse,
  BudgetRule,
  CategorizationRule,
  CategorizationRuleCreate,
  CategorizationRuleUpdate,
  CategoryCreatePayload,
  CategoryDeleteResult,
  CategoryItem,
  CategoryUpdatePayload,
  InstitutionInfo,
  LoanCreatePayload,
  LoansSummaryResponse,
  LoanItem,
  Product,
  ProductListResponse,
  ProductStatisticsResponse,
  ProductUpdatePayload,
  Receipt,
  ReceiptItem,
  RecurrenceType,
  RunwayAiSynthesisResult,
  RunwayData,
  RunwayScenarioResult,
  SpendingBreakdownResponse,
  StatementParseResult,
  SyncResult,
  TagSpendingSummaryResponse,
  Transaction,
  PeriodType,
} from '../types';

const API_BASE = '/api';

export async function fetchRunway(annualReturn = 0.05): Promise<RunwayData> {
  const res = await authFetch(`${API_BASE}/runway?annual_return=${annualReturn}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch runway metrics: ${res.statusText}`);
  }
  return res.json();
}

export async function simulateScenario(params: {
  weekly_burn_adjustment: number;
  custom_annual_return?: number;
  lump_sum_adjustment?: number;
  pay_off_loans?: boolean;
}): Promise<RunwayScenarioResult> {
  const res = await authFetch(`${API_BASE}/runway/simulate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    throw new Error(`Scenario simulation failed: ${res.statusText}`);
  }
  return res.json();
}

export async function synthesizeRunway(params: {
  weekly_burn_adjustment?: number;
  custom_annual_return?: number;
  lump_sum_adjustment?: number;
  custom_context?: string;
}): Promise<RunwayAiSynthesisResult> {
  const res = await authFetch(`${API_BASE}/runway/synthesize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    throw new Error(`AI runway synthesis failed: ${res.statusText}`);
  }
  return res.json();
}

export async function quickLogExpense(payload: {
  amount: number;
  merchant: string;
  category?: string;
  notes?: string;
}) {
  const res = await authFetch(`${API_BASE}/integrations/quick-log`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(`Quick-log failed: ${res.statusText}`);
  }
  return res.json();
}

export async function uploadStatement(
  file: File,
  institution = 'auto',
  commit = false,
  accountId?: number,
  closingBalance?: number,
  tier?: string,
  accountType?: string,
  accountName?: string,
  currency?: string
): Promise<StatementParseResult> {
  const formData = new FormData();
  formData.append('file', file);

  let url = `${API_BASE}/integrations/statement?institution=${encodeURIComponent(institution)}&commit=${commit}`;
  if (accountId) {
    url += `&account_id=${accountId}`;
  }
  if (closingBalance !== undefined && !isNaN(closingBalance)) {
    url += `&closing_balance=${closingBalance}`;
  }
  if (tier) {
    url += `&tier=${encodeURIComponent(tier)}`;
  }
  if (accountType) {
    url += `&account_type=${encodeURIComponent(accountType)}`;
  }
  if (accountName) {
    url += `&account_name=${encodeURIComponent(accountName)}`;
  }
  if (currency) {
    url += `&currency=${encodeURIComponent(currency)}`;
  }

  const res = await authFetch(url, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    throw new Error(`Statement upload failed: ${res.statusText}`);
  }
  return res.json();
}

export async function fetchInstitutions(): Promise<InstitutionInfo[]> {
  try {
    const res = await authFetch(`${API_BASE}/institutions`);
    if (res.ok) {
      return res.json();
    }
  } catch (err) {
    console.warn('Could not fetch institutions from API, using defaults:', err);
  }
  return [
    { name: 'ASB', default_tier: 'cash', default_type: 'checking', currency: 'NZD' },
    { name: 'ANZ', default_tier: 'cash', default_type: 'checking', currency: 'NZD' },
    { name: 'BNZ', default_tier: 'cash', default_type: 'checking', currency: 'NZD' },
    { name: 'Westpac', default_tier: 'cash', default_type: 'checking', currency: 'NZD' },
    { name: 'Kiwibank', default_tier: 'cash', default_type: 'checking', currency: 'NZD' },
    { name: 'Rabobank', default_tier: 'cash', default_type: 'savings', currency: 'NZD' },
    { name: 'TSB', default_tier: 'cash', default_type: 'checking', currency: 'NZD' },
    { name: 'Sharesies', default_tier: 'growth', default_type: 'brokerage', currency: 'NZD' },
    { name: 'Hatch', default_tier: 'growth', default_type: 'brokerage', currency: 'NZD' },
    { name: 'Kernel', default_tier: 'growth', default_type: 'brokerage', currency: 'NZD' },
    { name: 'Milford', default_tier: 'growth', default_type: 'brokerage', currency: 'NZD' },
    { name: 'InvestNow', default_tier: 'growth', default_type: 'brokerage', currency: 'NZD' },
    { name: 'Interactive Brokers', default_tier: 'growth', default_type: 'brokerage', currency: 'USD' },
    { name: 'Simplicity', default_tier: 'locked', default_type: 'kiwisaver', currency: 'NZD' },
    { name: 'DBS Bank', default_tier: 'cash', default_type: 'savings', currency: 'SGD' },
    { name: 'BDO Unibank', default_tier: 'cash', default_type: 'checking', currency: 'PHP' },
    { name: 'BPI', default_tier: 'cash', default_type: 'checking', currency: 'PHP' },
    { name: 'Wise', default_tier: 'cash', default_type: 'checking', currency: 'NZD' },
  ];
}

export async function fetchAccounts(): Promise<Account[]> {
  const res = await authFetch(`${API_BASE}/accounts`);
  if (!res.ok) {
    throw new Error(`Failed to fetch accounts: ${res.statusText}`);
  }
  return res.json();
}

export async function fetchAccountSnapshots(accountId: number, limit = 30): Promise<AssetSnapshot[]> {
  const res = await authFetch(`${API_BASE}/accounts/${accountId}/snapshots?limit=${limit}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch snapshots for account ${accountId}: ${res.statusText}`);
  }
  return res.json();
}

export async function recordAccountSnapshot(
  accountId: number,
  payload: AssetSnapshotCreatePayload
): Promise<AssetSnapshot> {
  const res = await authFetch(`${API_BASE}/accounts/${accountId}/snapshots`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(`Failed to record account snapshot: ${res.statusText}`);
  }
  return res.json();
}

export async function fetchAccountTransactions(params?: {
  accountId?: number;
  period?: PeriodType;
  startDate?: string;
  endDate?: string;
  category?: string;
  tag?: string;
  limit?: number;
}): Promise<Transaction[]> {
  const searchParams = new URLSearchParams();
  if (params?.period && params.period !== 'custom') {
    searchParams.set('period', params.period);
  }
  if (params?.period === 'custom' || (!params?.period && (params?.startDate || params?.endDate))) {
    if (params?.startDate) searchParams.set('start_date', params.startDate);
    if (params?.endDate) searchParams.set('end_date', params.endDate);
  }
  if (params?.category) searchParams.set('category', params.category);
  if (params?.tag) searchParams.set('tag', params.tag);
  if (params?.accountId !== undefined) searchParams.set('account_id', String(params.accountId));
  searchParams.set('limit', String(params?.limit ?? 500));
  const res = await authFetch(`${API_BASE}/transactions?${searchParams.toString()}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch account transactions: ${res.statusText}`);
  }
  const txs: Transaction[] = await res.json();
  if (params?.accountId !== undefined) {
    return txs.filter((tx) => tx.account_id === params.accountId);
  }
  return txs;
}

export async function fetchSpendingBreakdown(
  period: PeriodType = 'month',
  startDate?: string,
  endDate?: string,
  groupBy: 'leaf' | 'base' = 'leaf'
): Promise<SpendingBreakdownResponse> {
  const params = new URLSearchParams();
  if (period === 'custom') {
    if (startDate) params.set('start_date', startDate);
    if (endDate) params.set('end_date', endDate);
  } else {
    params.set('period', period);
  }
  if (groupBy !== 'leaf') {
    params.set('group_by', groupBy);
  }
  const res = await authFetch(`${API_BASE}/budgets/breakdown?${params.toString()}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch spending breakdown: ${res.statusText}`);
  }
  return res.json();
}

export async function fetchBudgetRules(): Promise<BudgetRule[]> {
  const res = await authFetch(`${API_BASE}/budgets`);
  if (!res.ok) {
    throw new Error(`Failed to fetch budget rules: ${res.statusText}`);
  }
  return res.json();
}

export async function upsertBudgetRule(
  category: string,
  weeklyLimit?: number,
  monthlyLimit?: number,
  annualLimit?: number,
  budgetPeriod?: 'weekly' | 'monthly' | 'annual'
): Promise<BudgetRule> {
  const res = await authFetch(`${API_BASE}/budgets`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      category,
      weekly_limit: weeklyLimit,
      monthly_limit: monthlyLimit,
      annual_limit: annualLimit,
      budget_period: budgetPeriod,
      is_active: true,
    }),
  });
  if (!res.ok) {
    throw new Error(`Failed to save budget rule: ${res.statusText}`);
  }
  return res.json();
}

export async function deleteBudgetRule(id: number): Promise<void> {
  const res = await authFetch(`${API_BASE}/budgets/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    throw new Error(`Failed to delete budget rule: ${res.statusText}`);
  }
}

export async function initDefaultBudgets(): Promise<BudgetRule[]> {
  const res = await authFetch(`${API_BASE}/budgets/init-defaults`, {
    method: 'POST',
  });
  if (!res.ok) {
    throw new Error(`Failed to initialize default budgets: ${res.statusText}`);
  }
  return res.json();
}

export async function fetchAverageBurn(
  lookbackWeeks = 12
): Promise<AverageBurnReportResponse> {
  const res = await authFetch(`${API_BASE}/budgets/average-burn?lookback_weeks=${lookbackWeeks}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch average weekly burn: ${res.statusText}`);
  }
  return res.json();
}

export async function syncBudgetsFromBurn(lookbackWeeks = 12): Promise<BudgetRule[]> {
  const res = await authFetch(`${API_BASE}/budgets/sync-from-burn?lookback_weeks=${lookbackWeeks}`, {
    method: 'POST',
  });
  if (!res.ok) {
    throw new Error(`Failed to calculate budgets from average burn: ${res.statusText}`);
  }
  return res.json();
}

export async function fetchCategoryTransactions(
  category: string,
  period?: PeriodType,
  startDate?: string,
  endDate?: string,
  includeSubclasses = false,
  includeAmortized = false
): Promise<Transaction[]> {
  const params = new URLSearchParams();
  if (category) params.set('category', category);
  if (includeSubclasses) params.set('include_subclasses', 'true');
  if (includeAmortized) params.set('include_amortized', 'true');
  appendPeriodParams(params, period, startDate, endDate);
  params.set('limit', '200');
  const res = await authFetch(`${API_BASE}/transactions?${params.toString()}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch transactions: ${res.statusText}`);
  }
  return res.json();
}

function appendPeriodParams(
  params: URLSearchParams,
  period?: PeriodType,
  startDate?: string,
  endDate?: string
): void {
  if (period && period !== 'custom') {
    params.set('period', period);
  } else if (period === 'custom') {
    if (startDate) params.set('start_date', startDate);
    if (endDate) params.set('end_date', endDate);
  }
}

export async function fetchTagSpendingSummary(
  period: PeriodType = 'all',
  startDate?: string,
  endDate?: string
): Promise<TagSpendingSummaryResponse> {
  const params = new URLSearchParams();
  appendPeriodParams(params, period, startDate, endDate);
  const res = await authFetch(`${API_BASE}/transactions/summary/tags?${params.toString()}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch tag spending summary: ${res.statusText}`);
  }
  return res.json();
}

export async function fetchTagTransactions(
  tag: string,
  period: PeriodType = 'all',
  startDate?: string,
  endDate?: string,
  category?: string
): Promise<Transaction[]> {
  const params = new URLSearchParams();
  if (tag) params.set('tag', tag);
  if (category) params.set('category', category);
  appendPeriodParams(params, period, startDate, endDate);
  params.set('limit', '500');
  const res = await authFetch(`${API_BASE}/transactions?${params.toString()}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch tagged transactions: ${res.statusText}`);
  }
  return res.json();
}

export async function updateTransactionCategory(
  id: number,
  category: string
): Promise<Transaction> {
  const res = await authFetch(`${API_BASE}/transactions/${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ category }),
  });
  if (!res.ok) {
    throw new Error(`Failed to update transaction category: ${res.statusText}`);
  }
  return res.json();
}

export async function updateTransactionTags(
  id: number,
  tags: string[]
): Promise<Transaction> {
  const res = await authFetch(`${API_BASE}/transactions/${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ tags }),
  });
  if (!res.ok) {
    throw new Error(`Failed to update transaction tags: ${res.statusText}`);
  }
  return res.json();
}

export async function updateTransactionRecurrence(
  id: number,
  recurrence: RecurrenceType | null
): Promise<Transaction> {
  const res = await authFetch(`${API_BASE}/transactions/${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ recurrence }),
  });
  if (!res.ok) {
    throw new Error(`Failed to update transaction recurrence: ${res.statusText}`);
  }
  return res.json();
}

export async function fetchRules(isActive?: boolean): Promise<CategorizationRule[]> {
  const params = new URLSearchParams();
  if (isActive !== undefined) {
    params.set('is_active', String(isActive));
  }
  const url = `${API_BASE}/rules${params.toString() ? `?${params.toString()}` : ''}`;
  const res = await authFetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch categorization rules: ${res.statusText}`);
  }
  return res.json();
}

export async function createRule(
  payload: CategorizationRuleCreate
): Promise<CategorizationRule> {
  const res = await authFetch(`${API_BASE}/rules`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(await readApiError(res, 'Failed to create categorization rule'));
  }
  return res.json();
}

export async function updateRule(
  id: number,
  payload: CategorizationRuleUpdate
): Promise<CategorizationRule> {
  const res = await authFetch(`${API_BASE}/rules/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(await readApiError(res, 'Failed to update categorization rule'));
  }
  return res.json();
}

export async function deleteRule(id: number): Promise<void> {
  const res = await authFetch(`${API_BASE}/rules/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    throw new Error(`Failed to delete categorization rule: ${res.statusText}`);
  }
}

export async function applyAllRules(): Promise<{
  evaluated: number;
  updated: number;
  receipt_items_evaluated?: number;
  receipt_items_updated?: number;
}> {
  const res = await authFetch(`${API_BASE}/rules/apply-all`, {
    method: 'POST',
  });
  if (!res.ok) {
    throw new Error(`Failed to apply categorization rules: ${res.statusText}`);
  }
  return res.json();
}

export async function fetchReceipts(status?: string): Promise<Receipt[]> {
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  const url = `${API_BASE}/receipts${params.toString() ? `?${params.toString()}` : ''}`;
  const res = await authFetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch receipts: ${res.statusText}`);
  }
  return res.json();
}

export async function fetchReceipt(id: number): Promise<Receipt> {
  const res = await authFetch(`${API_BASE}/receipts/${id}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch receipt: ${res.statusText}`);
  }
  return res.json();
}

export async function uploadReceipt(file: File): Promise<Receipt> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await authFetch(`${API_BASE}/receipts/upload`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) {
    throw new Error(`Failed to upload receipt: ${res.statusText}`);
  }
  return res.json();
}

export async function deleteReceipt(id: number): Promise<void> {
  const res = await authFetch(`${API_BASE}/receipts/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    throw new Error(`Failed to delete receipt: ${res.statusText}`);
  }
}

export async function reprocessReceipt(id: number): Promise<Receipt> {
  const res = await authFetch(`${API_BASE}/receipts/${id}/reprocess`, {
    method: 'POST',
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => null);
    throw new Error(detail?.detail || `Failed to reprocess receipt: ${res.statusText}`);
  }
  return res.json();
}

export function getReceiptImageUrl(id: number): string {
  return `${API_BASE}/receipts/${id}/image`;
}

export async function updateReceiptItem(
  receiptId: number,
  itemId: number,
  payload: {
    category?: string;
    domain?: string | null;
    tags?: string[];
    notes?: string | null;
  }
): Promise<ReceiptItem> {
  const res = await authFetch(`${API_BASE}/receipts/${receiptId}/items/${itemId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => null);
    throw new Error(detail?.detail || `Failed to update receipt item: ${res.statusText}`);
  }
  return res.json();
}

export async function fetchProductStatistics(
  domain?: string,
  productType?: string
): Promise<ProductStatisticsResponse> {
  const params = new URLSearchParams();
  if (domain) params.set('domain', domain);
  if (productType) params.set('product_type', productType);
  const url = `${API_BASE}/receipts/statistics/products${params.toString() ? `?${params.toString()}` : ''}`;
  const res = await authFetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch product statistics: ${res.statusText}`);
  }
  return res.json();
}

export async function linkReceipt(
  receiptId: number,
  transactionId: number
): Promise<Receipt> {
  const res = await authFetch(`${API_BASE}/receipts/${receiptId}/link/${transactionId}`, {
    method: 'POST',
  });
  if (!res.ok) {
    throw new Error(`Failed to link receipt: ${res.statusText}`);
  }
  return res.json();
}

export async function reconcileReceipts(): Promise<{ status: string; matched_count: number }> {
  const res = await authFetch(`${API_BASE}/receipts/reconcile`, {
    method: 'POST',
  });
  if (!res.ok) {
    throw new Error(`Failed to reconcile receipts: ${res.statusText}`);
  }
  return res.json();
}

export async function fetchProducts(params?: {
  domain?: string;
  tag?: string;
  search?: string;
  is_favorite?: boolean;
}): Promise<ProductListResponse> {
  const q = new URLSearchParams();
  if (params?.domain) q.set('domain', params.domain);
  if (params?.tag) q.set('tag', params.tag);
  if (params?.search) q.set('search', params.search);
  if (params?.is_favorite !== undefined) q.set('is_favorite', String(params.is_favorite));
  const url = `${API_BASE}/products${q.toString() ? `?${q.toString()}` : ''}`;
  const res = await authFetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch products: ${res.statusText}`);
  }
  return res.json();
}

export async function fetchProduct(id: number): Promise<Product> {
  const res = await authFetch(`${API_BASE}/products/${id}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch product: ${res.statusText}`);
  }
  return res.json();
}

export async function createProduct(payload: Partial<Product>): Promise<Product> {
  const res = await authFetch(`${API_BASE}/products`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(`Failed to create product: ${res.statusText}`);
  }
  return res.json();
}

export async function updateProduct(id: number, payload: ProductUpdatePayload): Promise<Product> {
  const res = await authFetch(`${API_BASE}/products/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(`Failed to update product: ${res.statusText}`);
  }
  return res.json();
}

export async function deleteProduct(id: number): Promise<{ status: string; id: number }> {
  const res = await authFetch(`${API_BASE}/products/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    throw new Error(`Failed to delete product: ${res.statusText}`);
  }
  return res.json();
}

export async function triggerReconcileTransfers(): Promise<{ status: string; matched_transfers: number }> {
  const res = await authFetch(`${API_BASE}/transactions/reconcile-transfers`, {
    method: 'POST',
  });
  if (!res.ok) {
    throw new Error(`Failed to reconcile transfers: ${res.statusText}`);
  }
  return res.json();
}

export async function syncAllIntegrations(days = 30): Promise<SyncResult> {
  const res = await authFetch(`${API_BASE}/integrations/sync/all?days=${days}`, {
    method: 'POST',
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => null);
    throw new Error(detail?.detail || `Bank feed sync failed: ${res.statusText}`);
  }
  return res.json();
}

export async function fetchLoans(): Promise<LoansSummaryResponse> {
  const res = await authFetch(`${API_BASE}/loans`);
  if (!res.ok) {
    throw new Error(`Failed to fetch loans: ${res.statusText}`);
  }
  return res.json();
}

export async function createLoan(payload: LoanCreatePayload): Promise<LoanItem> {
  const res = await authFetch(`${API_BASE}/loans`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(`Failed to create loan: ${res.statusText}`);
  }
  return res.json();
}

export async function deleteLoan(id: number): Promise<void> {
  const res = await authFetch(`${API_BASE}/loans/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    throw new Error(`Failed to delete loan: ${res.statusText}`);
  }
}

async function readApiError(res: Response, fallback: string): Promise<string> {
  const body = await res.json().catch(() => null);
  if (body && typeof body.detail === 'string' && body.detail.trim()) {
    return body.detail;
  }
  return `${fallback}: ${res.statusText}`;
}

export async function fetchCategories(includeInactive = false): Promise<CategoryItem[]> {
  const params = includeInactive ? '?include_inactive=true' : '';
  const res = await authFetch(`${API_BASE}/categories${params}`);
  if (!res.ok) {
    throw new Error(await readApiError(res, 'Failed to fetch categories'));
  }
  return res.json();
}

export async function createCategory(payload: CategoryCreatePayload): Promise<CategoryItem> {
  const res = await authFetch(`${API_BASE}/categories`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(await readApiError(res, 'Failed to create category'));
  }
  return res.json();
}

export async function updateCategory(
  id: number,
  payload: CategoryUpdatePayload
): Promise<CategoryItem> {
  const res = await authFetch(`${API_BASE}/categories/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(await readApiError(res, 'Failed to update category'));
  }
  return res.json();
}

export async function deleteCategory(
  id: number,
  reassignTo?: string
): Promise<CategoryDeleteResult> {
  const params = reassignTo
    ? `?reassign_to=${encodeURIComponent(reassignTo)}`
    : '';
  const res = await authFetch(`${API_BASE}/categories/${id}${params}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    throw new Error(await readApiError(res, 'Failed to delete category'));
  }
  return res.json();
}



