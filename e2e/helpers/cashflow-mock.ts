import type { Page, Route } from '@playwright/test';

export interface MockCashflowTx {
  id: number;
  transaction_date: string;
  account_id: number;
  account_name: string;
  amount: number;
  currency: string;
  merchant: string;
  raw_description?: string | null;
  category: string;
  tags?: string[];
  recurrence?: string | null;
  has_receipt?: boolean;
  receipt_id?: number | null;
  receipt_document_type?: 'receipt' | 'payslip' | null;
  is_amortized_commitment?: boolean;
  amortized_period_amount_nzd?: number | null;
  amortized_cadence?: 'week' | 'month' | null;
  excluded_from_period_budget?: boolean;
}

export interface MockBreakdownCategory {
  category: string;
  parent_category?: string;
  total_spend: number;
  transaction_count: number;
  actual_transaction_count?: number;
  amortized_count?: number;
  percentage: number;
  budget_limit?: number;
  annual_limit?: number;
  budget_period?: 'weekly' | 'monthly' | 'annual';
  percent_used?: number;
  is_over_budget: boolean;
  warning_level: 'normal' | 'warning' | 'danger';
  is_transfer: boolean;
}

export interface MockBreakdownPayload {
  period: 'month';
  total_spend: number;
  total_income: number;
  total_transfers: number;
  net_savings: number;
  over_budget_count: number;
  categories: MockBreakdownCategory[];
}

export interface CashflowMockState {
  pageSize: number;
  transactions: MockCashflowTx[];
  breakdown: MockBreakdownPayload;
}

const PARENT_BY_CATEGORY: Record<string, string> = {
  Dining: 'Food',
  Groceries: 'Food',
  Alcohol: 'Food',
  Fuel: 'Transport',
  Transit: 'Transport',
  Vehicle: 'Transport',
  'Bills & Telco': 'Utilities',
  'Software & AI': 'Utilities',
  'Debt & Loans': 'Finance',
  'Fees & Admin': 'Finance',
};

const DEFAULT_BREAKDOWN_CATEGORIES: MockBreakdownCategory[] = [
  {
    category: 'Groceries', parent_category: 'Food', total_spend: 350.0, transaction_count: 4,
    percentage: 46.7, budget_limit: 300.0, annual_limit: 3900.0, budget_period: 'monthly',
    percent_used: 116.7, is_over_budget: true, warning_level: 'danger', is_transfer: false,
  },
  {
    category: 'Transport', total_spend: 120.0, transaction_count: 5, percentage: 16.0,
    budget_limit: 200.0, annual_limit: 2600.0, budget_period: 'monthly', percent_used: 60.0,
    is_over_budget: false, warning_level: 'normal', is_transfer: false,
  },
  {
    category: 'Food', total_spend: 85.0, transaction_count: 3, percentage: 11.3,
    budget_limit: 100.0, annual_limit: 1300.0, budget_period: 'monthly', percent_used: 85.0,
    is_over_budget: false, warning_level: 'warning', is_transfer: false,
  },
  {
    category: 'Utilities', total_spend: 46.99, transaction_count: 4, actual_transaction_count: 2,
    amortized_count: 2, percentage: 6.3, budget_limit: 346.67, annual_limit: 4160.0,
    budget_period: 'monthly', percent_used: 13.6, is_over_budget: false, warning_level: 'normal',
    is_transfer: false,
  },
  {
    category: 'Travel', total_spend: 1200.0, transaction_count: 2, percentage: 14.5,
    budget_limit: 2600.0, annual_limit: 2600.0, budget_period: 'annual', percent_used: 46.2,
    is_over_budget: false, warning_level: 'normal', is_transfer: false,
  },
  {
    category: 'Transfers', total_spend: 600.0, transaction_count: 2, percentage: 0.0,
    is_over_budget: false, warning_level: 'normal', is_transfer: true,
  },
];

const DEFAULT_CASHFLOW_TRANSACTIONS: MockCashflowTx[] = [
  {
    id: 901, transaction_date: '2026-11-19', account_id: 1, account_name: 'ASB Everyday Checking',
    amount: 2800.0, currency: 'NZD', merchant: 'Northwind Salary', raw_description: 'DC NORTHWIND PAYROLL',
    category: 'Income', has_receipt: true, receipt_id: 901, receipt_document_type: 'payslip',
  },
  {
    id: 902, transaction_date: '2026-11-16', account_id: 2, account_name: 'Sharesies Growth Portfolio',
    amount: 400.0, currency: 'NZD', merchant: 'Vanguard ETF Dividend', raw_description: 'DIVIDEND CREDIT VTI',
    category: 'Dividends',
  },
  {
    id: 910, transaction_date: '2026-11-18', account_id: 1, account_name: 'ASB Everyday Checking',
    amount: -350.0, currency: 'NZD', merchant: 'Harbour Fresh Market', raw_description: 'EFTPOS HARBOUR FRESH MARKET',
    category: 'Groceries',
  },
  {
    id: 911, transaction_date: '2026-11-15', account_id: 1, account_name: 'ASB Everyday Checking',
    amount: -120.0, currency: 'NZD', merchant: 'City Metro Transit', raw_description: 'AT HOP TOPUP',
    category: 'Transport',
  },
  {
    id: 912, transaction_date: '2026-11-12', account_id: 1, account_name: 'ASB Everyday Checking',
    amount: -85.0, currency: 'NZD', merchant: 'Harbour Roast Cafe', raw_description: 'EFTPOS HARBOUR ROAST',
    category: 'Food',
  },
  {
    id: 913, transaction_date: '2026-11-08', account_id: 1, account_name: 'ASB Everyday Checking',
    amount: -58.01, currency: 'NZD', merchant: 'Spark Broadband', raw_description: 'DD SPARK NZ',
    category: 'Utilities',
  },
  {
    id: 914, transaction_date: '2026-11-05', account_id: 1, account_name: 'ASB Everyday Checking',
    amount: -450.0, currency: 'NZD', merchant: 'Alex Tan Advance', raw_description: 'ONE-OFF ADVANCE TRANSFER',
    category: 'Debt & Loans', recurrence: 'one-off', excluded_from_period_budget: true,
  },
  {
    id: 915, transaction_date: '2026-09-07', account_id: 1, account_name: 'ASB Everyday Checking',
    amount: -443.88, currency: 'NZD', merchant: 'City Cloud Storage', raw_description: 'CITY CLOUD ANNUAL PLAN',
    category: 'Utilities', recurrence: 'annual', is_amortized_commitment: true,
    amortized_period_amount_nzd: 36.99, amortized_cadence: 'month',
  },
];

export const CASHFLOW_PAYSLIP_RECEIPT = {
  id: 901,
  document_type: 'payslip' as const,
  merchant: 'Northwind Software Ltd',
  receipt_date: '2026-11-19',
  total_amount: 2800.0,
  tax_amount: 720.0,
  currency: 'NZD',
  status: 'matched' as const,
  transaction_id: 901,
  order_number: '2026-11-01 to 2026-11-30',
  source_email_message_id: '<payslip-901@northwind.test>',
  has_image: true,
  is_processed: true,
  image_mime_type: 'application/pdf',
  image_filename: 'northwind-payslip.pdf',
  created_at: '2026-11-19T08:00:00Z',
  updated_at: '2026-11-19T08:00:00Z',
  items: [],
};

export function createCashflowMockState(pageSize = 200): CashflowMockState {
  return {
    pageSize,
    breakdown: {
      period: 'month',
      total_spend: 750.0,
      total_income: 3200.0,
      total_transfers: 600.0,
      net_savings: 2450.0,
      over_budget_count: 1,
      categories: DEFAULT_BREAKDOWN_CATEGORIES.map((c) => ({ ...c })),
    },
    transactions: DEFAULT_CASHFLOW_TRANSACTIONS.map((tx) => ({ ...tx })),
  };
}

function matchesMockCategory(txCategory: string, targetCategory: string, includeSubclasses: boolean): boolean {
  const targetLower = targetCategory.trim().toLowerCase();
  if (txCategory.trim().toLowerCase() === targetLower) return true;
  if (!includeSubclasses) return false;
  return (PARENT_BY_CATEGORY[txCategory] || txCategory).toLowerCase() === targetLower;
}

function adjustBreakdownCategorySpend(state: CashflowMockState, catName: string, amountDelta: number): void {
  const entry = state.breakdown.categories.find((c) => c.category.toLowerCase() === catName.toLowerCase());
  if (entry) {
    entry.total_spend = Math.max(0, Math.round((entry.total_spend + amountDelta) * 100) / 100);
    return;
  }
  if (amountDelta <= 0) return;
  state.breakdown.categories.push({
    category: catName, total_spend: Math.round(amountDelta * 100) / 100, transaction_count: 1,
    percentage: 0, is_over_budget: false, warning_level: 'normal', is_transfer: catName.toLowerCase() === 'transfers',
  });
}

function adjustBreakdownOnCategoryMove(
  state: CashflowMockState,
  tx: MockCashflowTx,
  prevCategory: string,
  nextCategory: string
): void {
  if (nextCategory === prevCategory || tx.amount >= 0 || tx.excluded_from_period_budget) return;
  const delta = Math.abs(tx.amount);
  const wasTransfer = prevCategory.toLowerCase() === 'transfers';
  const isTransfer = nextCategory.toLowerCase() === 'transfers';
  adjustBreakdownCategorySpend(state, prevCategory, -delta);
  adjustBreakdownCategorySpend(state, nextCategory, delta);
  if (!wasTransfer && isTransfer) {
    state.breakdown.total_spend = Math.round((state.breakdown.total_spend - delta) * 100) / 100;
    state.breakdown.net_savings = Math.round((state.breakdown.net_savings + delta) * 100) / 100;
  } else if (wasTransfer && !isTransfer) {
    state.breakdown.total_spend = Math.round((state.breakdown.total_spend + delta) * 100) / 100;
    state.breakdown.net_savings = Math.round((state.breakdown.net_savings - delta) * 100) / 100;
  }
}

export function applyCashflowTransactionPatch(
  state: CashflowMockState,
  txId: number,
  body: Record<string, unknown> | null
): MockCashflowTx | undefined {
  const existing = state.transactions.find((tx) => tx.id === txId);
  if (!existing || !body) return existing;
  const prevCategory = existing.category;
  const nextCategory = typeof body.category === 'string' && body.category.trim() ? body.category.trim() : prevCategory;
  if (body.category !== undefined) existing.category = nextCategory;
  if (Array.isArray(body.tags)) existing.tags = body.tags.map(String);
  if (body.recurrence !== undefined) existing.recurrence = body.recurrence ? String(body.recurrence) : null;
  adjustBreakdownOnCategoryMove(state, existing, prevCategory, nextCategory);
  return existing;
}

function filterMockCashflowRows(url: URL, state: CashflowMockState) {
  const flow = url.searchParams.get('flow');
  const categoryParam = url.searchParams.get('category');
  const includeSubclasses = url.searchParams.get('include_subclasses') === 'true';
  const includeAmortized = url.searchParams.get('include_amortized') === 'true';
  const periodParam = url.searchParams.get('period') || 'month';
  const offset = Math.max(0, Number(url.searchParams.get('offset') || '0'));
  const isCadence = ['week', 'last_week', 'month', 'last_month'].includes(periodParam);

  let regular = state.transactions.filter((tx) => {
    if (tx.is_amortized_commitment || tx.category.toLowerCase() === 'transfers') return false;
    if (flow === 'inflow') return tx.amount > 0;
    return tx.amount < 0 && (includeAmortized || !tx.excluded_from_period_budget);
  });
  let amortized =
    flow === 'outflow' && includeAmortized && isCadence && offset === 0
      ? state.transactions.filter((tx) => Boolean(tx.is_amortized_commitment) && tx.category.toLowerCase() !== 'transfers')
      : [];
  if (categoryParam) {
    regular = regular.filter((tx) => matchesMockCategory(tx.category, categoryParam, includeSubclasses));
    amortized = amortized.filter((tx) => matchesMockCategory(tx.category, categoryParam, includeSubclasses));
  }
  return { regular, amortized, offset };
}

export async function fulfillCashflowTransactionsRoute(
  route: Route,
  url: URL,
  state: CashflowMockState
): Promise<void> {
  const limit = Math.max(1, Number(url.searchParams.get('limit') || '200'));
  const { regular, amortized, offset } = filterMockCashflowRows(url, state);
  const effectiveLimit = Math.min(limit, state.pageSize);
  const slicedRegular = regular.slice(offset, offset + effectiveLimit);
  const items = offset === 0 ? [...slicedRegular, ...amortized] : slicedRegular;

  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    headers: {
      'X-Total-Count': String(regular.length),
      'Access-Control-Expose-Headers': 'X-Total-Count',
    },
    body: JSON.stringify(items),
  });
}

async function handleCashflowTransactionRoute(route: Route, state: CashflowMockState): Promise<void> {
  const method = route.request().method();
  const url = new URL(route.request().url());
  if (method === 'PATCH') {
    const match = url.pathname.match(/\/api\/transactions\/(\d+)/);
    const txId = match ? Number(match[1]) : 0;
    if (txId < 900) return route.fallback();
    const updated = applyCashflowTransactionPatch(state, txId, route.request().postDataJSON());
    await route.fulfill({
      status: updated ? 200 : 404,
      contentType: 'application/json',
      body: JSON.stringify(updated ?? { detail: 'Transaction not found' }),
    });
    return;
  }
  const flowParam = url.searchParams.get('flow');
  if (method === 'GET' && (flowParam === 'inflow' || flowParam === 'outflow')) {
    await fulfillCashflowTransactionsRoute(route, url, state);
    return;
  }
  await route.fallback();
}

async function handleCashflowReceipt901Route(route: Route): Promise<void> {
  if (route.request().url().endsWith('/image')) {
    await route.fulfill({
      status: 200,
      contentType: 'application/pdf',
      body: Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n', 'utf-8'),
    });
    return;
  }
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(CASHFLOW_PAYSLIP_RECEIPT),
  });
}

/**
 * Attaches cashflow projection, dynamic breakdown, and payslip 901 routes
 * on top of `setupMockApi(page)`, falling back cleanly for non-cashflow traffic.
 */
export async function registerCashflowMockRoutes(page: Page, pageSize = 200): Promise<void> {
  const state = createCashflowMockState(pageSize);
  await page.route('**/api/budgets/breakdown**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(state.breakdown) });
  });
  await page.route(/\/api\/transactions(\/.*|\?.*)?$/, (route) => handleCashflowTransactionRoute(route, state));
  await page.route(/\/api\/receipts\/901(\/image)?$/, handleCashflowReceipt901Route);
}
