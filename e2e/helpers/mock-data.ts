import type { Page } from '@playwright/test';
import { registerCashflowMockRoutes } from './cashflow-mock';

interface MockCategoryRecord {
  id: number;
  name: string;
  parent_id: number | null;
  parent_name: string | null;
  is_system: boolean;
  is_active: boolean;
  amortize_period: 'annual' | null;
  sort_order: number;
  transaction_count: number;
  rule_count: number;
  child_count: number;
  has_budget_rule: boolean;
  budget_period: 'weekly' | 'monthly' | 'annual' | null;
  weekly_limit: number | null;
  monthly_limit: number | null;
  annual_limit: number | null;
}

function buildInitialMockCategories(): MockCategoryRecord[] {
  const specs: Array<{
    id: number;
    name: string;
    parentId: number | null;
    parentName: string | null;
    isSystem?: boolean;
    amortize?: 'annual' | null;
    sort: number;
    txns?: number;
    rules?: number;
    weekly?: number | null;
  }> = [
    { id: 1, name: 'Food', parentId: null, parentName: null, sort: 10, txns: 6, rules: 1, weekly: 100 },
    { id: 2, name: 'Dining', parentId: 1, parentName: 'Food', sort: 11, txns: 14, rules: 2 },
    { id: 3, name: 'Groceries', parentId: 1, parentName: 'Food', sort: 12, txns: 18, rules: 2, weekly: 200 },
    { id: 4, name: 'Alcohol', parentId: 1, parentName: 'Food', sort: 13, txns: 3, rules: 1 },
    { id: 5, name: 'Housing', parentId: null, parentName: null, sort: 20, txns: 4, rules: 1 },
    { id: 6, name: 'Rent', parentId: 5, parentName: 'Housing', sort: 21, txns: 8, rules: 1 },
    { id: 7, name: 'Household', parentId: 5, parentName: 'Housing', sort: 22, txns: 5 },
    { id: 8, name: 'Transport', parentId: null, parentName: null, sort: 30, txns: 4, weekly: 60 },
    { id: 9, name: 'Fuel', parentId: 8, parentName: 'Transport', sort: 31, txns: 7, rules: 1 },
    { id: 10, name: 'Transit', parentId: 8, parentName: 'Transport', sort: 32, txns: 9, rules: 1 },
    { id: 11, name: 'Vehicle', parentId: 8, parentName: 'Transport', sort: 33, txns: 2 },
    { id: 12, name: 'Health', parentId: null, parentName: null, sort: 40, txns: 3, weekly: 50 },
    { id: 13, name: 'Fitness', parentId: 12, parentName: 'Health', sort: 41, txns: 4, rules: 1 },
    { id: 14, name: 'Medical', parentId: 12, parentName: 'Health', sort: 42, txns: 2 },
    { id: 15, name: 'Supplements', parentId: 12, parentName: 'Health', sort: 43, txns: 3 },
    { id: 16, name: 'Personal Care', parentId: 12, parentName: 'Health', sort: 44, txns: 4 },
    { id: 17, name: 'Shopping', parentId: null, parentName: null, sort: 50, txns: 6 },
    { id: 18, name: 'Clothing', parentId: 17, parentName: 'Shopping', sort: 51, txns: 2 },
    { id: 19, name: 'Tech', parentId: 17, parentName: 'Shopping', sort: 52, txns: 5 },
    { id: 20, name: 'Utilities', parentId: null, parentName: null, sort: 60, txns: 4, weekly: 80 },
    { id: 21, name: 'Bills & Telco', parentId: 20, parentName: 'Utilities', sort: 61, txns: 6, rules: 1 },
    { id: 22, name: 'Software & AI', parentId: 20, parentName: 'Utilities', sort: 62, txns: 8, rules: 2 },
    { id: 23, name: 'Insurance', parentId: null, parentName: null, sort: 70, txns: 4, weekly: 55 },
    { id: 24, name: 'Leisure', parentId: null, parentName: null, amortize: 'annual', sort: 80, txns: 6, weekly: 50 },
    { id: 25, name: 'Gaming', parentId: 24, parentName: 'Leisure', sort: 81, txns: 3 },
    { id: 26, name: 'Travel', parentId: null, parentName: null, amortize: 'annual', sort: 90, txns: 5 },
    { id: 27, name: 'Family', parentId: null, parentName: null, sort: 100, txns: 3 },
    { id: 28, name: 'Finance', parentId: null, parentName: null, sort: 110, txns: 1 },
    { id: 29, name: 'Fees & Admin', parentId: 28, parentName: 'Finance', sort: 111, txns: 4, rules: 1 },
    { id: 30, name: 'Debt & Loans', parentId: 28, parentName: 'Finance', isSystem: true, sort: 112, txns: 2 },
    { id: 31, name: 'General', parentId: null, parentName: null, isSystem: true, sort: 900, txns: 4 },
    { id: 32, name: 'Transfers', parentId: null, parentName: null, isSystem: true, sort: 910, txns: 10 },
    { id: 33, name: 'Income', parentId: null, parentName: null, isSystem: true, sort: 920, txns: 6 },
  ];

  const childCountByParent = new Map<number, number>();
  for (const s of specs) {
    if (s.parentId !== null) {
      childCountByParent.set(s.parentId, (childCountByParent.get(s.parentId) || 0) + 1);
    }
  }

  return specs.map((s) => {
    const weekly = s.weekly ?? null;
    const isAnnual = s.amortize === 'annual';
    return {
      id: s.id,
      name: s.name,
      parent_id: s.parentId,
      parent_name: s.parentName,
      is_system: Boolean(s.isSystem),
      is_active: true,
      amortize_period: s.amortize ?? null,
      sort_order: s.sort,
      transaction_count: s.txns ?? 0,
      rule_count: s.rules ?? 0,
      child_count: childCountByParent.get(s.id) ?? 0,
      has_budget_rule: weekly !== null,
      budget_period: weekly !== null ? (isAnnual ? 'annual' : 'monthly') : isAnnual ? 'annual' : null,
      weekly_limit: weekly,
      monthly_limit: weekly !== null ? Math.round(((weekly * 52) / 12) * 100) / 100 : null,
      annual_limit: weekly !== null ? Math.round(weekly * 52 * 100) / 100 : null,
    };
  });
}

export const MOCK_RUNWAY_DATA = {
  as_of_date: '2026-11-04',
  primary_runway_weeks: 184,
  primary_runway_years: 3.5,
  is_perpetual: false,
  time_banked_this_week: 0.25,
  weekly_spend_this_week: 750.0,
  weekly_budget_target: 1000.0,
  breakdown: {
    cash_balance: 24000.0,
    growth_balance: 160000.0,
    locked_balance: 85000.0,
    total_liquid_balance: 184000.0,
    emergency_weeks: 24.0,
    growth_weeks: 184.0,
    is_perpetual: false,
    perpetual_threshold_weekly_income: 173.0,
    weekly_burn_rate: 1000.0,
    variable_weekly_burn: 490.0,
    recurring_weekly_burn: 510.0,
    this_week_variable_spend: 240.0,
  },
};

export const MOCK_SIMULATED_DATA = {
  simulated_runway_weeks: 228.0,
  simulated_runway_years: 4.4,
  is_perpetual: false,
  delta_weeks_compared_to_baseline: 44.0,
  loan_free_date: '2029-10-20',
  loan_weekly_relief: 335.17,
  total_liabilities: 45399.42,
  simulated_net_worth: 223600.58,
};

export const MOCK_LOANS_DATA = {
  loans: [
    {
      id: 1,
      name: 'Toyota Corolla Cross (TFS)',
      lender: 'Toyota Financial Services',
      loan_type: 'borrowed' as const,
      principal_amount: 45399.42,
      annual_interest_rate: 0.0962,
      term_months: 36,
      monthly_payment: 1452.42,
      start_date: '2026-11-20',
      asset_value: 55000.0,
      currency: 'NZD',
      is_active: true,
      payments_made: 0,
      payments_remaining: 36,
      payoff_date: '2029-10-20',
      next_payment_date: '2026-11-20',
      remaining_principal: 45399.42,
      principal_paid: 0.0,
      remaining_interest: 6887.7,
      weekly_payment_equivalent: 335.17,
      net_worth_impact: 9600.58,
      total_paid_amount: 0.0,
      interest_paid: 0.0,
      last_payment_date: null,
      is_payment_due: true,
      linked_payments: [],
      disbursements: [],
    },
    {
      id: 2,
      name: 'Loan to Brother',
      lender: 'Brother',
      loan_type: 'lent' as const,
      principal_amount: 10000.0,
      annual_interest_rate: 0.0,
      term_months: 0,
      monthly_payment: 0.0,
      start_date: '2025-08-08',
      asset_value: null,
      currency: 'NZD',
      is_active: true,
      payments_made: 0,
      payments_remaining: 0,
      payoff_date: null,
      next_payment_date: null,
      remaining_principal: 10000.0,
      principal_paid: 0.0,
      remaining_interest: 0.0,
      weekly_payment_equivalent: 0.0,
      net_worth_impact: 10000.0,
      total_paid_amount: 0.0,
      interest_paid: 0.0,
      last_payment_date: null,
      is_payment_due: false,
      linked_payments: [],
      disbursements: [],
    },
  ],
  total_liabilities: 45399.42,
  total_receivables: 10000.0,
  total_asset_value: 55000.0,
  net_loan_impact: 9600.58,
  total_monthly_payment: 1452.42,
  total_weekly_payment: 335.17,
  latest_payoff_date: '2029-10-20',
};

export const MOCK_PRODUCTS_DATA = {
  total_count: 3,
  all_tags: ['health', 'home', 'lighting', 'serum', 'skincare', 'supplement', 'vitamin-c'],
  products: [
    {
      id: 1,
      name: 'La Roche-Posay Pure Vitamin C10 Serum 30ml',
      brand: 'La Roche-Posay',
      category: 'Health',
      domain: '02-skin',
      tags: ['skincare', 'serum', 'vitamin-c'],
      volume_ml: '30ml',
      notes: 'Very gentle on morning routine, apply before sunscreen. Noticeable brightening in 2 weeks.',
      rating: 5,
      is_favorite: true,
      purchase_count: 2,
      total_spent: 89.98,
      latest_price: 46.99,
      lowest_price: 42.99,
      highest_price: 46.99,
      average_price: 44.99,
      price_change_latest: 4.0,
      first_purchased: '2026-08-15',
      last_purchased: '2026-11-03',
      avg_days_between_purchases: 80.0,
      estimated_depletion_date: '2027-01-22',
      price_history: [
        {
          date: '2026-08-15',
          merchant: 'Chemist Warehouse Albany',
          unit_price: 42.99,
          total_price: 42.99,
          quantity: 1.0,
          receipt_id: 8,
          receipt_item_id: 15,
        },
        {
          date: '2026-11-03',
          merchant: 'Chemist Warehouse Albany',
          unit_price: 46.99,
          total_price: 46.99,
          quantity: 1.0,
          receipt_id: 1,
          receipt_item_id: 2,
        },
      ],
      created_at: '2026-08-15T10:00:00Z',
      updated_at: '2026-11-03T10:00:00Z',
    },
    {
      id: 2,
      name: 'Blackmores Sustained Release Vitamin C 1000mg',
      brand: 'Blackmores',
      category: 'Health',
      domain: '01-health',
      tags: ['health', 'supplement', 'vitamin-c'],
      volume_ml: '150 Tablets',
      notes: 'Take 1 tablet daily with breakfast. Great immune defense during winter months.',
      rating: 4,
      is_favorite: false,
      purchase_count: 2,
      total_spent: 59.98,
      latest_price: 27.99,
      lowest_price: 27.99,
      highest_price: 31.99,
      average_price: 29.99,
      price_change_latest: -4.0,
      first_purchased: '2026-06-01',
      last_purchased: '2026-11-03',
      avg_days_between_purchases: 155.0,
      estimated_depletion_date: '2027-04-07',
      price_history: [
        {
          date: '2026-06-01',
          merchant: 'Bargain Chemist',
          unit_price: 31.99,
          total_price: 31.99,
          quantity: 1.0,
          receipt_id: 5,
          receipt_item_id: 9,
        },
        {
          date: '2026-11-03',
          merchant: 'Chemist Warehouse Albany',
          unit_price: 27.99,
          total_price: 27.99,
          quantity: 1.0,
          receipt_id: 1,
          receipt_item_id: 1,
        },
      ],
      created_at: '2026-06-01T10:00:00Z',
      updated_at: '2026-11-03T10:00:00Z',
    },
    {
      id: 3,
      name: 'Philips Hue White & Color Ambiance E27',
      brand: 'Philips Hue',
      category: 'Utilities',
      domain: '20-home',
      tags: ['home', 'lighting'],
      volume_ml: null,
      notes: 'Living room floor lamp bulb. Paired via Home Assistant Zigbee.',
      rating: 5,
      is_favorite: false,
      purchase_count: 1,
      total_spent: 32.5,
      latest_price: 32.5,
      lowest_price: 32.5,
      highest_price: 32.5,
      average_price: 32.5,
      price_change_latest: null,
      first_purchased: '2026-11-02',
      last_purchased: '2026-11-02',
      avg_days_between_purchases: null,
      estimated_depletion_date: null,
      price_history: [
        {
          date: '2026-11-02',
          merchant: 'Bunnings Warehouse',
          unit_price: 32.5,
          total_price: 32.5,
          quantity: 1.0,
          receipt_id: 2,
          receipt_item_id: 3,
        },
      ],
      created_at: '2026-11-02T14:30:00Z',
      updated_at: '2026-11-02T14:30:00Z',
    },
  ],
};

export async function setupMockApi(page: Page) {
  // 1. Mock Runway Simulate Endpoint
  await page.route('**/api/runway/simulate**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_SIMULATED_DATA),
    });
  });

  // 2. Mock Main Runway Endpoint
  await page.route(/\/api\/runway(\?.*)?$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_RUNWAY_DATA),
    });
  });

  // 3. Mock Quick Log Endpoint
  await page.route('**/api/integrations/quick-log**', async (route) => {
    const postData = JSON.parse(route.request().postData() || '{}');
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 999,
        transaction_date: '2026-11-04',
        account_id: 1,
        amount: -Math.abs(postData.amount || 20),
        currency: 'NZD',
        merchant: postData.merchant || 'Mock Cafe',
        category: postData.category || 'Food',
        raw_description: 'Mock QuickLog',
        raw_hash: 'mock-hash-1234',
        created_at: new Date().toISOString(),
      }),
    });
  });

  // 4. Mock Statement Endpoint
  await page.route('**/api/integrations/statement**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        institution: 'ASB',
        start_date: '2026-10-01',
        end_date: '2026-10-31',
        opening_balance: 18500.0,
        closing_balance: 24000.0,
        currency: 'NZD',
        transaction_count: 14,
        transactions: [
          {
            transaction_date: '2026-10-02',
            amount: -145.5,
            merchant: 'PAK N SAVE ALBANY',
            raw_description: 'PAK N SAVE ALBANY',
            category: 'Groceries',
          },
          {
            transaction_date: '2026-10-05',
            amount: -12.5,
            merchant: 'COLUMBUS COFFEE',
            raw_description: 'COLUMBUS COFFEE',
            category: 'Food',
          },
        ],
      }),
    });
  });

  // 5. Mock Accounts & Snapshots Endpoint
  const mockAccounts = [
    {
      id: 1,
      name: 'ASB Everyday Checking',
      account_type: 'checking',
      tier: 'cash',
      institution: 'ASB',
      currency: 'NZD',
      expected_annual_return: 0.0,
      is_active: true,
    },
    {
      id: 2,
      name: 'Sharesies Growth Portfolio',
      account_type: 'brokerage',
      tier: 'growth',
      institution: 'Sharesies',
      currency: 'NZD',
      expected_annual_return: 0.07,
      is_active: true,
    },
    {
      id: 3,
      name: 'Simplicity KiwiSaver',
      account_type: 'kiwisaver',
      tier: 'locked',
      institution: 'Simplicity',
      currency: 'NZD',
      expected_annual_return: 0.06,
      is_active: true,
    },
    {
      id: 5,
      name: 'Manulife',
      account_type: 'brokerage',
      tier: 'growth',
      institution: 'Manulife',
      currency: 'SGD',
      expected_annual_return: 0.0,
      is_active: true,
    },
    {
      id: 6,
      name: 'DBS Multiplier',
      account_type: 'savings',
      tier: 'cash',
      institution: 'DBS Bank',
      currency: 'SGD',
      expected_annual_return: 0.02,
      is_active: true,
    },
  ];

  const resolveAccountName = (accountId: number | null | undefined): string | null => {
    if (accountId === null || accountId === undefined) return null;
    const found = mockAccounts.find((a) => a.id === Number(accountId));
    return found ? found.name : null;
  };

  await page.route(/\/api\/accounts\/(\d+)\/snapshots(\?.*)?$/, async (route) => {
    const match = route.request().url().match(/\/api\/accounts\/(\d+)\/snapshots/);
    const reqAccountId = match ? Number(match[1]) : 1;
    if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON() || {};
      const currency = body.currency || 'NZD';
      const fx = body.exchange_rate ?? (currency === 'SGD' ? 1.29 : 1.0);
      const bal = Number(body.balance) || 25000.0;
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 99,
          snapshot_date: body.snapshot_date || '2026-11-04',
          account_id: reqAccountId,
          balance: bal,
          currency,
          exchange_rate: fx,
          balance_nzd: Math.round(bal * fx * 100) / 100,
          source: body.source || 'manual',
          notes: body.notes || 'Manual balance update',
          created_at: '2026-11-04T12:00:00Z',
        }),
      });
      return;
    }
    if (reqAccountId === 5) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 50,
            snapshot_date: '2026-11-16',
            account_id: 5,
            balance: 14527.89,
            currency: 'SGD',
            exchange_rate: 1.29,
            balance_nzd: 18740.98,
            source: 'manual',
            notes: 'Manulife surrender valuation',
            created_at: '2026-11-16T10:00:00Z',
          },
        ]),
      });
      return;
    }
    if (reqAccountId === 6) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 60,
            snapshot_date: '2026-11-04',
            account_id: 6,
            balance: 5200.0,
            currency: 'SGD',
            exchange_rate: 1.29,
            balance_nzd: 6708.0,
            source: 'api',
            notes: 'DBS feed',
            created_at: '2026-11-04T10:00:00Z',
          },
        ]),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          id: 1,
          snapshot_date: '2026-11-04',
          account_id: 1,
          balance: 24000.0,
          currency: 'NZD',
          exchange_rate: 1.0,
          balance_nzd: 24000.0,
          source: 'manual',
          notes: 'November snapshot',
          created_at: '2026-11-04T10:00:00Z',
        },
        {
          id: 2,
          snapshot_date: '2026-10-04',
          account_id: 1,
          balance: 22500.0,
          currency: 'NZD',
          exchange_rate: 1.0,
          balance_nzd: 22500.0,
          source: 'manual',
          notes: 'October snapshot',
          created_at: '2026-10-04T10:00:00Z',
        },
      ]),
    });
  });

  await page.route(/\/api\/institutions(\?.*)?$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        { name: 'ASB', default_tier: 'cash', default_type: 'checking', currency: 'NZD' },
        { name: 'ANZ', default_tier: 'cash', default_type: 'checking', currency: 'NZD' },
        { name: 'Sharesies', default_tier: 'growth', default_type: 'brokerage', currency: 'NZD' },
        { name: 'Simplicity', default_tier: 'locked', default_type: 'kiwisaver', currency: 'NZD' },
        { name: 'DBS Bank', default_tier: 'cash', default_type: 'savings', currency: 'SGD' },
        { name: 'Manulife', default_tier: 'growth', default_type: 'brokerage', currency: 'SGD' },
      ]),
    });
  });

  await page.route(/\/api\/accounts(\?.*)?$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockAccounts),
    });
  });

  // 6. Mock Budgets & Breakdown Endpoints
  await page.route('**/api/budgets/breakdown**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        period: 'month',
        total_spend: 750.0,
        total_income: 3200.0,
        total_transfers: 600.0,
        net_savings: 2450.0,
        over_budget_count: 1,
        categories: [
          {
            category: 'Groceries',
            parent_category: 'Food',
            total_spend: 350.0,
            transaction_count: 4,
            percentage: 46.7,
            budget_limit: 300.0,
            annual_limit: 3900.0,
            budget_period: 'monthly',
            percent_used: 116.7,
            is_over_budget: true,
            warning_level: 'danger',
            is_transfer: false,
          },
          {
            category: 'Transport',
            total_spend: 120.0,
            transaction_count: 5,
            percentage: 16.0,
            budget_limit: 200.0,
            annual_limit: 2600.0,
            budget_period: 'monthly',
            percent_used: 60.0,
            is_over_budget: false,
            warning_level: 'normal',
            is_transfer: false,
          },
          {
            category: 'Food',
            total_spend: 85.0,
            transaction_count: 3,
            percentage: 11.3,
            budget_limit: 100.0,
            annual_limit: 1300.0,
            budget_period: 'monthly',
            percent_used: 85.0,
            is_over_budget: false,
            warning_level: 'warning',
            is_transfer: false,
          },
          {
            category: 'Utilities',
            total_spend: 46.99,
            transaction_count: 4,
            actual_transaction_count: 2,
            amortized_count: 2,
            percentage: 6.3,
            budget_limit: 346.67,
            annual_limit: 4160.0,
            budget_period: 'monthly',
            percent_used: 13.6,
            is_over_budget: false,
            warning_level: 'normal',
            is_transfer: false,
          },
          {
            category: 'Travel',
            total_spend: 1200.0,
            transaction_count: 2,
            percentage: 14.5,
            budget_limit: 2600.0,
            annual_limit: 2600.0,
            budget_period: 'annual',
            percent_used: 46.2,
            is_over_budget: false,
            warning_level: 'normal',
            is_transfer: false,
          },
          {
            category: 'Transfers',
            total_spend: 600.0,
            transaction_count: 2,
            percentage: 0.0,
            is_over_budget: false,
            warning_level: 'normal',
            is_transfer: true,
          },
        ],
      }),
    });
  });

  const mockBudgetRules: Array<{
    id: number;
    category: string;
    weekly_limit: number;
    monthly_limit: number;
    annual_limit: number;
    budget_period: 'weekly' | 'monthly' | 'annual';
    is_active: boolean;
  }> = [
    {
      id: 1,
      category: 'Groceries',
      weekly_limit: 75.0,
      monthly_limit: 300.0,
      annual_limit: 3900.0,
      budget_period: 'monthly',
      is_active: true,
    },
    {
      id: 2,
      category: 'Transport',
      weekly_limit: 50.0,
      monthly_limit: 200.0,
      annual_limit: 2600.0,
      budget_period: 'monthly',
      is_active: true,
    },
  ];

  const getRulePeriod = (categoryName: string): 'weekly' | 'monthly' | 'annual' => {
    const matched = mockBudgetRules.find(
      (rule) => rule.category.toLowerCase() === categoryName.toLowerCase()
    );
    return matched ? matched.budget_period : 'monthly';
  };

  await page.route('**/api/budgets/average-burn**', async (route) => {
    const url = new URL(route.request().url());
    const lookback = Number(url.searchParams.get('lookback_weeks') || '12');
    const is4w = lookback === 4;
    const variableTotal = is4w ? 450.0 : 490.0;
    const grocVar = is4w ? 250.0 : 285.0;
    const foodVar = is4w ? 200.0 : 205.0;
    const effectiveTotal = 510.0 + variableTotal;

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        lookback_weeks: lookback,
        as_of_date: '2026-11-18',
        variable_weekly_burn: variableTotal,
        recurring_weekly_burn: 510.0,
        effective_weekly_burn: effectiveTotal,
        categories: [
          {
            category: 'Housing',
            variable_weekly_burn: 0.0,
            recurring_weekly_burn: 400.0,
            average_weekly_burn: 400.0,
            suggested_monthly_limit: 1733.33,
            suggested_annual_limit: 20800.0,
            budget_period: getRulePeriod('Housing'),
            variable_percentage: 0.0,
            total_percentage: 40.0,
          },
          {
            category: 'Groceries',
            variable_weekly_burn: grocVar,
            recurring_weekly_burn: 0.0,
            average_weekly_burn: grocVar,
            suggested_monthly_limit: Math.round((grocVar * 52) / 12 * 100) / 100,
            suggested_annual_limit: Math.round(grocVar * 52 * 100) / 100,
            budget_period: getRulePeriod('Groceries'),
            variable_percentage: Math.round((grocVar / variableTotal) * 1000) / 10,
            total_percentage: Math.round((grocVar / effectiveTotal) * 1000) / 10,
          },
          {
            category: 'Food',
            variable_weekly_burn: foodVar,
            recurring_weekly_burn: 0.0,
            average_weekly_burn: foodVar,
            suggested_monthly_limit: Math.round((foodVar * 52) / 12 * 100) / 100,
            suggested_annual_limit: Math.round(foodVar * 52 * 100) / 100,
            budget_period: getRulePeriod('Food'),
            variable_percentage: Math.round((foodVar / variableTotal) * 1000) / 10,
            total_percentage: Math.round((foodVar / effectiveTotal) * 1000) / 10,
          },
          {
            category: 'Insurance',
            variable_weekly_burn: 0.0,
            recurring_weekly_burn: 95.59,
            average_weekly_burn: 95.59,
            suggested_monthly_limit: 414.22,
            suggested_annual_limit: 4970.68,
            budget_period: getRulePeriod('Insurance'),
            variable_percentage: 0.0,
            total_percentage: 9.6,
          },
          {
            category: 'Health',
            variable_weekly_burn: 0.0,
            recurring_weekly_burn: 14.41,
            average_weekly_burn: 14.41,
            suggested_monthly_limit: 62.44,
            suggested_annual_limit: 749.32,
            budget_period: getRulePeriod('Health'),
            variable_percentage: 0.0,
            total_percentage: 1.4,
          },
        ],
        recurring_commitments: [
          {
            transaction_id: 201,
            merchant: 'Home rent',
            category: 'Housing',
            recurrence: 'weekly',
            last_charged_date: '2026-11-12',
            original_amount: 400.0,
            currency: 'NZD',
            amount_nzd: 400.0,
            weekly_nzd: 400.0,
            monthly_nzd: 1733.33,
            percentage_of_recurring: 78.4,
          },
          {
            transaction_id: 202,
            merchant: 'Southern Cross',
            category: 'Insurance',
            recurrence: 'fortnightly',
            last_charged_date: '2026-11-10',
            original_amount: 191.18,
            currency: 'NZD',
            amount_nzd: 191.18,
            weekly_nzd: 95.59,
            monthly_nzd: 414.22,
            percentage_of_recurring: 18.7,
          },
          {
            transaction_id: 203,
            merchant: 'CityFitness',
            category: 'Health',
            recurrence: 'fortnightly',
            last_charged_date: '2026-11-08',
            original_amount: 28.81,
            currency: 'NZD',
            amount_nzd: 28.81,
            weekly_nzd: 14.41,
            monthly_nzd: 62.44,
            percentage_of_recurring: 2.8,
          },
        ],
      }),
    });
  });

  await page.route('**/api/budgets/sync-from-burn**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          id: 1,
          category: 'Groceries',
          weekly_limit: 85.0,
          monthly_limit: 368.33,
          annual_limit: 4420.0,
          budget_period: 'monthly',
          is_active: true,
        },
        {
          id: 2,
          category: 'Housing',
          weekly_limit: 400.0,
          monthly_limit: 1733.33,
          annual_limit: 20800.0,
          budget_period: 'monthly',
          is_active: true,
        },
      ]),
    });
  });

  await page.route(/\/api\/budgets(\?.*)?$/, async (route) => {
    if (route.request().method() === 'POST') {
      const payload = route.request().postDataJSON() as {
        category: string;
        weekly_limit?: number;
        monthly_limit?: number;
        annual_limit?: number;
        budget_period?: 'weekly' | 'monthly' | 'annual';
      };
      const period = payload.budget_period ?? 'monthly';
      const weeklyLimit =
        payload.weekly_limit != null
          ? payload.weekly_limit
          : payload.annual_limit != null
            ? Math.round((payload.annual_limit / 52) * 100) / 100
            : Math.round((((payload.monthly_limit ?? 0) * 12) / 52) * 100) / 100;
      const monthlyLimit =
        payload.monthly_limit != null
          ? payload.monthly_limit
          : Math.round(((weeklyLimit * 52) / 12) * 100) / 100;
      const annualLimit =
        payload.annual_limit != null
          ? payload.annual_limit
          : Math.round(weeklyLimit * 52 * 100) / 100;

      const existingIdx = mockBudgetRules.findIndex(
        (r) => r.category.toLowerCase() === payload.category.toLowerCase()
      );
      const updated = {
        id: existingIdx >= 0 ? mockBudgetRules[existingIdx].id : mockBudgetRules.length + 1,
        category: payload.category,
        weekly_limit: weeklyLimit,
        monthly_limit: monthlyLimit,
        annual_limit: annualLimit,
        budget_period: period,
        is_active: true,
      };
      if (existingIdx >= 0) {
        mockBudgetRules[existingIdx] = updated;
      } else {
        mockBudgetRules.push(updated);
      }

      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify(updated),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockBudgetRules),
    });
  });

  interface MockTransactionRecord {
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
    linked_transaction_id?: number | null;
    linked_account_name?: string | null;
    linked_amount?: number | null;
    linked_currency?: string | null;
    counterpart_account_id?: number | null;
    counterpart_account_name?: string | null;
    loan_id?: number | null;
    loan_name?: string | null;
    loan_type?: 'borrowed' | 'lent' | null;
    loan_payment_amount?: number | null;
    exchange_rate?: number | null;
    fee_amount?: number | null;
    is_amortized_commitment?: boolean;
    amortized_period_amount_nzd?: number | null;
    splits?: Array<{
      id: number;
      transaction_id: number;
      amount: number;
      category: string;
      tags: string[];
      loan_id?: number | null;
      loan_name?: string | null;
      loan_type?: 'borrowed' | 'lent' | null;
      notes?: string | null;
    }>;
    is_split?: boolean;
  }

  const mockTransactions: MockTransactionRecord[] = [
    {
      id: 101,
      transaction_date: '2026-11-04',
      account_id: 1,
      account_name: 'ANZ Freedom',
      amount: -120.5,
      currency: 'NZD',
      merchant: 'Pak n Save Albany',
      category: 'Groceries',
      tags: ['weekly-shop', 'pantry'],
      has_receipt: true,
      receipt_id: 1,
    },
    {
      id: 102,
      transaction_date: '2026-11-02',
      account_id: 1,
      account_name: 'ANZ Freedom',
      amount: -85.2,
      currency: 'NZD',
      merchant: 'Woolworths Silverdale',
      category: 'Groceries',
    },
    {
      id: 103,
      transaction_date: '2026-11-01',
      account_id: 1,
      account_name: 'ASB Checking',
      amount: -500.0,
      currency: 'NZD',
      merchant: 'Wise Transfer to USD',
      category: 'Transfers',
      linked_transaction_id: 104,
      linked_account_name: 'Wise USD (Personal)',
      linked_amount: 300.0,
      linked_currency: 'USD',
      exchange_rate: 0.6061,
      fee_amount: 5.0,
    },
    {
      id: 104,
      transaction_date: '2026-11-01',
      account_id: 2,
      account_name: 'Wise USD (Personal)',
      amount: 300.0,
      currency: 'USD',
      merchant: 'Wise Transfer from ASB',
      category: 'Transfers',
      linked_transaction_id: 103,
      linked_account_name: 'ASB Checking',
      linked_amount: -500.0,
      linked_currency: 'NZD',
      exchange_rate: 0.6061,
    },
    {
      id: 107,
      transaction_date: '2026-11-01',
      account_id: 1,
      account_name: 'ANZ Freedom',
      amount: -6000.0,
      currency: 'NZD',
      merchant: 'Lightning Pay',
      category: 'Transfers',
      linked_transaction_id: 108,
      linked_account_name: 'BitBox02 Savings',
      linked_amount: 0.04884012,
      linked_currency: 'BTC',
      exchange_rate: 122849.82,
      fee_amount: 100.81,
    },
    {
      id: 108,
      transaction_date: '2026-11-01',
      account_id: 4,
      account_name: 'BitBox02 Savings',
      amount: 0.04884012,
      currency: 'BTC',
      merchant: 'Bitcoin On-Chain Deposit (07ceeb6378e4)',
      category: 'Transfers',
      linked_transaction_id: 107,
      linked_account_name: 'ANZ Freedom',
      linked_amount: -6000.0,
      linked_currency: 'NZD',
      exchange_rate: 120810.25,
    },
    {
      id: 109,
      transaction_date: '2026-11-01',
      account_id: 4,
      account_name: 'BitBox02 Savings',
      amount: -0.005005,
      currency: 'BTC',
      merchant: 'Bitcoin On-Chain Withdrawal (1a2b3c4d5e6f)',
      category: 'Transfers',
      fee_amount: 0.000005,
      exchange_rate: 120810.25,
    },
    {
      id: 105,
      transaction_date: '2026-08-14',
      account_id: 1,
      account_name: 'ANZ Freedom',
      amount: -1050.0,
      currency: 'NZD',
      merchant: 'Air New Zealand',
      category: 'Travel',
      tags: ['queenstown-trip'],
    },
    {
      id: 106,
      transaction_date: '2026-08-15',
      account_id: 1,
      account_name: 'ANZ Freedom',
      amount: -250.0,
      currency: 'NZD',
      merchant: 'Fergburger Queenstown',
      category: 'Food',
      tags: ['queenstown-trip'],
    },
    {
      id: 107,
      transaction_date: '2026-08-16',
      account_id: 1,
      account_name: 'ANZ Freedom',
      amount: -150.0,
      currency: 'NZD',
      merchant: 'Queenstown Airport Shuttle',
      category: 'Transport',
      tags: ['queenstown-trip'],
    },
    {
      id: 120,
      transaction_date: '2026-11-13',
      account_id: 2,
      account_name: 'ANZ Low Rate Visa',
      amount: -1.99,
      currency: 'NZD',
      merchant: 'iCloud',
      raw_description: 'Apple.Com/Bill Sydney Au',
      category: 'Utilities',
      recurrence: 'monthly',
      tags: ['electronic-and-appliance', 'subscription'],
    },
    {
      id: 121,
      transaction_date: '2026-11-04',
      account_id: 1,
      account_name: 'ANZ Freedom',
      amount: -8.0,
      currency: 'NZD',
      merchant: 'SKINNY MOBIL',
      raw_description: 'Skinny Mobil Card number: 4835 **** **** 8340',
      category: 'Utilities',
      recurrence: 'monthly',
      tags: ['mobile', 'subscription'],
    },
    {
      id: 130,
      transaction_date: '2026-11-15',
      account_id: 6,
      account_name: 'DBS Multiplier',
      amount: -300.0,
      currency: 'SGD',
      merchant: 'Manulife GIRO Contribution',
      raw_description: 'GIRO MANULIFE SINGAPORE PTE LTD',
      category: 'Transfers',
      linked_transaction_id: 131,
      linked_account_name: 'Manulife',
      linked_amount: 300.0,
      linked_currency: 'SGD',
      exchange_rate: 1.0,
      counterpart_account_id: 5,
      counterpart_account_name: 'Manulife',
    },
    {
      id: 131,
      transaction_date: '2026-11-15',
      account_id: 5,
      account_name: 'Manulife',
      amount: 300.0,
      currency: 'SGD',
      merchant: 'Manulife GIRO Contribution',
      raw_description: 'GIRO MANULIFE SINGAPORE PTE LTD',
      category: 'Transfers',
      linked_transaction_id: 130,
      linked_account_name: 'DBS Multiplier',
      linked_amount: -300.0,
      linked_currency: 'SGD',
      exchange_rate: 1.0,
      counterpart_account_id: 6,
      counterpart_account_name: 'DBS Multiplier',
    },
    {
      id: 132,
      transaction_date: '2026-11-16',
      account_id: 6,
      account_name: 'DBS Multiplier',
      amount: 65.54,
      currency: 'SGD',
      merchant: 'Dividends from Manulife',
      raw_description: 'IBG MANULIFE (SINGAPORE) PTE LTD DIVIDEND',
      category: 'Income',
      linked_transaction_id: null,
      counterpart_account_id: 5,
      counterpart_account_name: 'Manulife',
    },
    {
      id: 140,
      transaction_date: '2026-11-18',
      account_id: 1,
      account_name: 'ASB Everyday Checking',
      amount: -1452.42,
      currency: 'NZD',
      merchant: 'Toyota Financial Services',
      raw_description: 'DD TOYOTA FINANCIAL SERVICES 001',
      category: 'Debt & Loans',
      loan_id: null,
      loan_name: null,
      loan_type: null,
      loan_payment_amount: null,
    },
    {
      id: 141,
      transaction_date: '2025-08-08',
      account_id: 1,
      account_name: 'ASB Everyday Checking',
      amount: -10000.0,
      currency: 'NZD',
      merchant: 'Transfer to Brother',
      raw_description: 'TRANSFER TO BROTHER LOAN',
      category: 'Debt & Loans',
      loan_id: 2,
      loan_name: 'Loan to Brother',
      loan_type: 'lent',
      loan_payment_amount: null,
    },
    {
      id: 142,
      transaction_date: '2026-11-19',
      account_id: 1,
      account_name: 'ASB Everyday Checking',
      amount: 5020.0,
      currency: 'NZD',
      merchant: 'Tienzo E M Ti',
      raw_description: 'TIENZO E M TI REPAYMENT',
      category: 'Family',
      loan_id: null,
      loan_name: null,
      loan_type: null,
      loan_payment_amount: null,
    },
    {
      id: 143,
      transaction_date: '2026-11-17',
      account_id: 1,
      account_name: 'ASB Everyday Checking',
      amount: 1000.0,
      currency: 'NZD',
      merchant: 'Tienzo E M Ti',
      raw_description: 'TIENZO E M TI PARTIAL',
      category: 'Debt & Loans',
      loan_id: null,
      loan_name: null,
      loan_type: null,
      loan_payment_amount: null,
    },
    {
      id: 144,
      transaction_date: '2026-11-16',
      account_id: 1,
      account_name: 'ASB Everyday Checking',
      amount: 137.17,
      currency: 'NZD',
      merchant: 'Tienzo E M Ti',
      raw_description: 'TIENZO E M TI NETTED SETTLEMENT',
      category: 'Family',
      loan_id: null,
      loan_name: null,
      loan_type: null,
      loan_payment_amount: null,
    },
    {
      id: 150,
      transaction_date: '2026-11-19',
      account_id: 1,
      account_name: 'ASB Everyday Checking',
      amount: 4250.5,
      currency: 'NZD',
      merchant: 'Acme Corp Salary',
      raw_description: 'DC ACME CORP PAYROLL',
      category: 'Income',
      has_receipt: true,
      receipt_id: 4,
      receipt_document_type: 'payslip',
    },
  ];

  const mockAmortizedUtilities = [
    {
      id: 122,
      transaction_date: '2026-09-07',
      account_id: 1,
      account_name: 'ANZ Freedom',
      amount: -279.99,
      currency: 'NZD',
      merchant: 'Google One',
      raw_description: 'Google *Google One Mountain View Us',
      category: 'Utilities',
      recurrence: 'annual',
      tags: ['cloud', 'subscription'],
      is_amortized_commitment: true,
      amortized_period_amount_nzd: 23.31,
    },
    {
      id: 123,
      transaction_date: '2026-09-20',
      account_id: 3,
      account_name: 'DBS Multiplier',
      amount: -120.0,
      currency: 'SGD',
      exchange_rate: 1.3694,
      merchant: 'ANNUAL FEE',
      raw_description: 'DBS Card Annual Fee',
      category: 'Utilities',
      recurrence: 'annual',
      tags: ['banking'],
      is_amortized_commitment: true,
      amortized_period_amount_nzd: 13.69,
    },
  ];

  interface MockLoanRecord {
    id: number;
    name: string;
    lender: string;
    loan_type: 'borrowed' | 'lent';
    principal_amount: number;
    annual_interest_rate: number;
    term_months: number;
    monthly_payment: number;
    start_date: string;
    asset_value: number | null;
    currency: string;
    is_active: boolean;
    payments_made: number;
    payments_remaining: number;
    payoff_date: string | null;
    next_payment_date: string | null;
    remaining_principal: number;
    principal_paid: number;
    remaining_interest: number;
    weekly_payment_equivalent: number;
    net_worth_impact: number;
    total_paid_amount: number;
    interest_paid: number;
    last_payment_date: string | null;
    is_payment_due: boolean;
    linked_payments: unknown[];
    disbursements: unknown[];
  }

  const mockLoans: MockLoanRecord[] = MOCK_LOANS_DATA.loans.map((l) => ({
    ...l,
    loan_type: l.loan_type ?? 'borrowed',
    linked_payments: [...(l.linked_payments || [])],
    disbursements: [...(l.disbursements || [])],
  }));
  let nextLoanId = 3;
  let nextSplitId = 500;

  const resolveLoan = (loanId: number | null | undefined): MockLoanRecord | null => {
    if (loanId === null || loanId === undefined) return null;
    return mockLoans.find((l) => l.id === Number(loanId)) ?? null;
  };

  const resolveLoanName = (loanId: number | null | undefined): string | null =>
    resolveLoan(loanId)?.name ?? null;

  const resolveLoanType = (loanId: number | null | undefined): 'borrowed' | 'lent' | null =>
    resolveLoan(loanId)?.loan_type ?? null;

  interface LoanLinkedEntry {
    tx: MockTransactionRecord;
    appliedAmt: number;
    signedAmt: number;
    loanPaymentAmount: number | null;
    splitId: number | null;
    notes: string | null;
    category: string;
  }

  const collectLoanEntries = (loanId: number): LoanLinkedEntry[] => {
    const entries: LoanLinkedEntry[] = [];
    for (const tx of mockTransactions) {
      const rawAmt = Math.abs(tx.amount);
      if (tx.is_split && tx.splits && tx.splits.length > 0) {
        for (const split of tx.splits) {
          if (split.loan_id === loanId) {
            const signedAmt = Number(split.amount);
            const splitAmt = Math.abs(signedAmt);
            entries.push({
              tx,
              appliedAmt: splitAmt,
              signedAmt,
              loanPaymentAmount: splitAmt,
              splitId: split.id,
              notes: split.notes ?? null,
              category: split.category,
            });
          }
        }
      } else if (tx.loan_id === loanId) {
        const appliedAmt =
          tx.loan_payment_amount != null
            ? Math.min(rawAmt, Number(tx.loan_payment_amount))
            : rawAmt;
        entries.push({
          tx,
          appliedAmt,
          signedAmt: Number(tx.amount),
          loanPaymentAmount: tx.loan_payment_amount ?? null,
          splitId: null,
          notes: null,
          category: tx.category,
        });
      }
    }
    return entries.sort((a, b) => a.tx.transaction_date.localeCompare(b.tx.transaction_date));
  };

  const computeLoansSummary = () => {
    const computedLoans = mockLoans.map((loan) => {
      const isLent = loan.loan_type === 'lent';
      const allLinkedEntries = collectLoanEntries(loan.id);

      if (isLent) {
        const repaymentEntries = allLinkedEntries.filter((e) => e.signedAmt > 0);
        const disbursementEntries = allLinkedEntries.filter((e) => e.signedAmt < 0);
        const effectivePrincipal =
          disbursementEntries.length > 0
            ? Math.round(
                disbursementEntries.reduce((sum, entry) => sum + entry.appliedAmt, 0) * 100
              ) / 100
            : loan.principal_amount;
        let remaining = effectivePrincipal;
        let totalRepaid = 0;

        for (const entry of repaymentEntries) {
          totalRepaid = Math.round((totalRepaid + entry.appliedAmt) * 100) / 100;
          remaining = Math.max(0, Math.round((remaining - entry.appliedAmt) * 100) / 100);
        }

        const lastPaymentDate =
          repaymentEntries.length > 0
            ? repaymentEntries[repaymentEntries.length - 1].tx.transaction_date
            : null;

        return {
          ...loan,
          principal_amount: effectivePrincipal,
          payments_made: repaymentEntries.length,
          payments_remaining: 0,
          payoff_date: null,
          next_payment_date: null,
          remaining_principal: remaining,
          principal_paid: totalRepaid,
          total_paid_amount: totalRepaid,
          interest_paid: 0,
          last_payment_date: lastPaymentDate,
          is_payment_due: false,
          net_worth_impact: remaining,
          linked_payments: [...repaymentEntries].reverse().map((entry) => ({
            id: entry.tx.id,
            transaction_date: entry.tx.transaction_date,
            amount: entry.tx.amount,
            currency: entry.tx.currency,
            amount_nzd: Math.abs(entry.signedAmt),
            applied_amount: entry.appliedAmt,
            loan_payment_amount: entry.loanPaymentAmount,
            split_id: entry.splitId,
            notes: entry.notes,
            entry_type: 'repayment' as const,
            merchant: entry.tx.merchant,
            account_id: entry.tx.account_id,
            account_name: entry.tx.account_name,
            category: entry.category,
          })),
          disbursements: [...disbursementEntries].reverse().map((entry) => ({
            id: entry.tx.id,
            transaction_date: entry.tx.transaction_date,
            amount: entry.signedAmt,
            currency: entry.tx.currency,
            amount_nzd: Math.abs(entry.signedAmt),
            applied_amount: entry.appliedAmt,
            loan_payment_amount: entry.loanPaymentAmount,
            split_id: entry.splitId,
            notes: entry.notes,
            entry_type: 'disbursement' as const,
            merchant: entry.tx.merchant,
            account_id: entry.tx.account_id,
            account_name: entry.tx.account_name,
            category: entry.category,
          })),
        };
      }

      const linkedEntries = allLinkedEntries.filter((e) => e.signedAmt < 0);
      const monthlyRate = loan.annual_interest_rate / 12;
      let remaining = loan.principal_amount;
      let totalPaid = 0;
      let interestPaid = 0;
      let principalPaid = 0;

      for (const entry of linkedEntries) {
        const paymentAmt = entry.appliedAmt;
        const interest = Math.round(remaining * monthlyRate * 100) / 100;
        const principalPortion = Math.min(
          remaining,
          Math.max(0, Math.round((paymentAmt - interest) * 100) / 100)
        );
        totalPaid = Math.round((totalPaid + paymentAmt) * 100) / 100;
        interestPaid = Math.round((interestPaid + interest) * 100) / 100;
        principalPaid = Math.round((principalPaid + principalPortion) * 100) / 100;
        remaining = Math.max(0, Math.round((remaining - principalPortion) * 100) / 100);
      }

      const paymentsMade = linkedEntries.length;
      const paymentsRemaining = Math.max(0, loan.term_months - paymentsMade);
      const lastPaymentDate =
        linkedEntries.length > 0 ? linkedEntries[linkedEntries.length - 1].tx.transaction_date : null;
      const isPaymentDue = paymentsMade === 0;
      const nextPaymentDate =
        paymentsMade === 0 ? loan.next_payment_date || loan.start_date : '2026-12-20';
      const netWorthImpact = Math.round(((loan.asset_value ?? 0) - remaining) * 100) / 100;

      return {
        ...loan,
        payments_made: paymentsMade,
        payments_remaining: paymentsRemaining,
        next_payment_date: nextPaymentDate,
        remaining_principal: remaining,
        principal_paid: principalPaid,
        total_paid_amount: totalPaid,
        interest_paid: interestPaid,
        last_payment_date: lastPaymentDate,
        is_payment_due: isPaymentDue,
        net_worth_impact: netWorthImpact,
        linked_payments: [...linkedEntries].reverse().map((entry) => ({
          id: entry.tx.id,
          transaction_date: entry.tx.transaction_date,
          amount: entry.tx.amount,
          currency: entry.tx.currency,
          amount_nzd: Math.abs(entry.tx.amount),
          applied_amount: entry.appliedAmt,
          loan_payment_amount: entry.loanPaymentAmount,
          split_id: entry.splitId,
          notes: entry.notes,
          entry_type: 'repayment' as const,
          merchant: entry.tx.merchant,
          account_id: entry.tx.account_id,
          account_name: entry.tx.account_name,
          category: entry.category,
        })),
        disbursements: [],
      };
    });

    const borrowedLoans = computedLoans.filter((l) => l.loan_type !== 'lent');
    const lentLoans = computedLoans.filter((l) => l.loan_type === 'lent');
    const totalLiabilities = Math.round(
      borrowedLoans.reduce((sum, l) => sum + l.remaining_principal, 0) * 100
    ) / 100;
    const totalReceivables = Math.round(
      lentLoans.reduce((sum, l) => sum + l.remaining_principal, 0) * 100
    ) / 100;
    const totalAssetValue = Math.round(
      borrowedLoans.reduce((sum, l) => sum + (l.asset_value ?? 0), 0) * 100
    ) / 100;
    const netLoanImpact = Math.round((totalAssetValue - totalLiabilities) * 100) / 100;
    const totalMonthlyPayment = Math.round(
      borrowedLoans.reduce((sum, l) => sum + l.monthly_payment, 0) * 100
    ) / 100;
    const totalWeeklyPayment = Math.round(
      borrowedLoans.reduce((sum, l) => sum + l.weekly_payment_equivalent, 0) * 100
    ) / 100;

    return {
      loans: computedLoans,
      total_liabilities: totalLiabilities,
      total_receivables: totalReceivables,
      total_asset_value: totalAssetValue,
      net_loan_impact: netLoanImpact,
      total_monthly_payment: totalMonthlyPayment,
      total_weekly_payment: totalWeeklyPayment,
      latest_payoff_date: borrowedLoans[0]?.payoff_date || null,
    };
  };

  // 7. Mock Transactions Endpoints for Inspection & Category Correction
  await page.route(/\/api\/transactions(\/.*|\?.*)?$/, async (route) => {
    const reqUrl = route.request().url();
    const method = route.request().method();

    if (method === 'PUT' && /\/api\/transactions\/(\d+)\/splits$/.test(reqUrl)) {
      const match = reqUrl.match(/\/api\/transactions\/(\d+)\/splits$/);
      const txId = match ? Number(match[1]) : 101;
      const rawBody = route.request().postDataJSON();
      const inputSplits = Array.isArray(rawBody)
        ? rawBody
        : Array.isArray(rawBody?.splits)
          ? rawBody.splits
          : [];
      const existing = mockTransactions.find((tx) => tx.id === txId);
      if (!existing) {
        await route.fulfill({
          status: 404,
          contentType: 'application/json',
          body: JSON.stringify({ detail: 'Transaction not found' }),
        });
        return;
      }
      if (inputSplits.length === 0) {
        existing.splits = [];
        existing.is_split = false;
      } else {
        const signedSum =
          Math.round(
            inputSplits.reduce(
              (sum: number, s: { amount: number }) => sum + Number(s.amount),
              0
            ) * 100
          ) / 100;
        const parentAmt = Math.round(Number(existing.amount) * 100) / 100;
        if (Math.abs(signedSum - parentAmt) > 0.01) {
          await route.fulfill({
            status: 422,
            contentType: 'application/json',
            body: JSON.stringify({
              detail: `Split amounts (${signedSum.toFixed(2)}) must sum to transaction amount (${parentAmt.toFixed(2)}).`,
            }),
          });
          return;
        }
        existing.loan_id = null;
        existing.loan_name = null;
        existing.loan_type = null;
        existing.loan_payment_amount = null;
        existing.splits = inputSplits.map(
          (s: {
            amount: number;
            category: string;
            tags?: string[];
            loan_id?: number | null;
            notes?: string | null;
          }) => {
            const splitLoanId = s.loan_id != null ? Number(s.loan_id) : null;
            return {
              id: nextSplitId++,
              transaction_id: txId,
              amount: Number(s.amount),
              category: String(s.category || existing.category),
              tags: Array.isArray(s.tags) ? s.tags : [],
              loan_id: splitLoanId,
              loan_name: resolveLoanName(splitLoanId),
              loan_type: resolveLoanType(splitLoanId),
              notes: s.notes ?? null,
            };
          }
        );
        existing.is_split = true;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(existing),
      });
      return;
    }

    if (method === 'PATCH') {
      const match = route.request().url().match(/\/api\/transactions\/(\d+)/);
      const txId = match ? Number(match[1]) : 101;
      const body = route.request().postDataJSON();
      const existing =
        mockTransactions.find((tx) => tx.id === txId) ||
        mockAmortizedUtilities.find((tx) => tx.id === txId);
      if (existing) {
        if (body?.category !== undefined) {
          existing.category = body.category;
        }
        if (body?.tags !== undefined) {
          existing.tags = body.tags;
        }
        if (body?.recurrence !== undefined) {
          existing.recurrence = body.recurrence;
        }
        if ('loan_id' in (body || {})) {
          const nextLoanId = body.loan_id != null ? Number(body.loan_id) : null;
          (existing as MockTransactionRecord).loan_id = nextLoanId;
          (existing as MockTransactionRecord).loan_name = resolveLoanName(nextLoanId);
          (existing as MockTransactionRecord).loan_type = resolveLoanType(nextLoanId);
          if (nextLoanId == null) {
            (existing as MockTransactionRecord).loan_payment_amount = null;
          }
        }
        if ('loan_payment_amount' in (body || {})) {
          (existing as MockTransactionRecord).loan_payment_amount =
            body.loan_payment_amount != null ? Number(body.loan_payment_amount) : null;
        }
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...(existing || {
            transaction_date: '2026-11-04',
            account_id: 1,
            account_name: 'ANZ Freedom',
            amount: -120.5,
            currency: 'NZD',
            merchant: 'Pak n Save Albany',
          }),
          id: txId,
          category: body?.category || existing?.category || 'Food',
          tags: body?.tags ?? existing?.tags ?? ['weekly-shop'],
          ...(body?.recurrence !== undefined ? { recurrence: body.recurrence } : {}),
        }),
      });
    } else {
      const url = new URL(route.request().url());
      const categoryParam = url.searchParams.get('category');
      const tagParam = url.searchParams.get('tag');
      const periodParam = url.searchParams.get('period');
      const accountIdParam = url.searchParams.get('account_id');
      const includeAmortizedParam = url.searchParams.get('include_amortized');

      let filtered = [...mockTransactions];
      if (accountIdParam) {
        const reqAccountId = Number(accountIdParam);
        filtered = filtered.filter(
          (tx) =>
            tx.account_id === reqAccountId ||
            (tx.counterpart_account_id === reqAccountId && tx.linked_transaction_id == null)
        );
      }
      if (categoryParam) {
        const targetLower = categoryParam.toLowerCase();
        filtered = filtered
          .map((tx) => {
            if (tx.is_split && tx.splits && tx.splits.length > 0) {
              const matched = tx.splits.filter(
                (s) => s.category.toLowerCase() === targetLower
              );
              if (matched.length === 0) return null;
              const splitAmt =
                Math.round(
                  matched.reduce((sum, s) => sum + Number(s.amount), 0) * 100
                ) / 100;
              return {
                ...tx,
                amount: splitAmt,
                category: matched[0].category,
              };
            }
            return tx.category.toLowerCase() === targetLower ? tx : null;
          })
          .filter((tx): tx is MockTransactionRecord => tx !== null);
      }
      if (tagParam) {
        filtered = filtered.filter((tx) => (tx.tags || []).includes(tagParam));
      }
      if (periodParam === 'week' || periodParam === 'last_week' || periodParam === 'month') {
        filtered = filtered.filter((tx) => tx.transaction_date >= '2026-11-01');
      }

      if (
        includeAmortizedParam === 'true' &&
        categoryParam?.toLowerCase() === 'utilities' &&
        (periodParam === 'week' ||
          periodParam === 'last_week' ||
          periodParam === 'month' ||
          periodParam === 'last_month')
      ) {
        const cadence =
          periodParam === 'week' || periodParam === 'last_week' ? 'week' : 'month';
        filtered = [
          ...filtered,
          ...mockAmortizedUtilities.map((tx) => ({
            ...tx,
            amortized_cadence: cadence,
          })),
        ];
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(filtered),
      });
    }
  });

  // 7a. Mock Tag Spending Summary Endpoint
  await page.route('**/api/transactions/summary/tags**', async (route) => {
    const url = new URL(route.request().url());
    const periodParam = url.searchParams.get('period') || 'all';
    const isShortMonth = periodParam === 'month' || periodParam === 'last_month';
    const tags = isShortMonth
      ? [
          {
            tag: 'weekly-shop',
            total_spend: 120.5,
            transaction_count: 1,
            first_date: '2026-11-04',
            last_date: '2026-11-04',
            categories: [
              { category: 'Groceries', total_spend: 120.5, transaction_count: 1, percentage: 100.0 },
            ],
          },
        ]
      : [
          {
            tag: 'queenstown-trip',
            total_spend: 1450.0,
            transaction_count: 3,
            first_date: '2026-08-14',
            last_date: '2026-08-16',
            categories: [
              { category: 'Travel', total_spend: 1050.0, transaction_count: 1, percentage: 72.4 },
              { category: 'Food', total_spend: 250.0, transaction_count: 1, percentage: 17.2 },
              { category: 'Transport', total_spend: 150.0, transaction_count: 1, percentage: 10.3 },
            ],
          },
          {
            tag: 'weekly-shop',
            total_spend: 120.5,
            transaction_count: 1,
            first_date: '2026-11-04',
            last_date: '2026-11-04',
            categories: [
              { category: 'Groceries', total_spend: 120.5, transaction_count: 1, percentage: 100.0 },
            ],
          },
        ];

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        period: periodParam,
        start_date: null,
        end_date: null,
        total_tagged_spend: isShortMonth ? 120.5 : 1570.5,
        tags,
      }),
    });
  });

  // 7b. Mock Reconcile Transfers Endpoint
  await page.route('**/api/transactions/reconcile-transfers', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'ok', matched_transfers: 2 }),
    });
  });

  // 8. Mock Outlook-style Categorization Rules Endpoints (stateful)
  interface MockRuleRecord {
    id: number;
    name: string;
    description_pattern: string;
    match_type: 'contains' | 'exact' | 'starts_with';
    amount_equals: number | null;
    min_amount: number | null;
    max_amount: number | null;
    direction: 'outflow' | 'inflow' | null;
    target_category: string;
    target_tags: string[];
    target_recurrence: string | null;
    rename_merchant: string | null;
    counterpart_account_id: number | null;
    counterpart_account_name: string | null;
    loan_id: number | null;
    loan_name: string | null;
    loan_type: 'borrowed' | 'lent' | null;
    priority: number;
    is_active: boolean;
    match_count: number;
    created_at: string;
    updated_at: string;
  }

  let mockRules: MockRuleRecord[] = [
    {
      id: 1,
      name: 'Utilities Regular',
      description_pattern: '12-0323-0895056',
      match_type: 'contains',
      amount_equals: 400.0,
      min_amount: null,
      max_amount: null,
      direction: 'outflow',
      target_category: 'Utilities',
      target_tags: [],
      target_recurrence: null,
      rename_merchant: 'Power/Water Utilities',
      counterpart_account_id: null,
      counterpart_account_name: null,
      loan_id: null,
      loan_name: null,
      loan_type: null,
      priority: 10,
      is_active: true,
      match_count: 4,
      created_at: '2026-11-01T00:00:00Z',
      updated_at: '2026-11-01T00:00:00Z',
    },
    {
      id: 2,
      name: 'Wise Transfer',
      description_pattern: 'WISE',
      match_type: 'contains',
      amount_equals: null,
      min_amount: null,
      max_amount: null,
      direction: null,
      target_category: 'Transfers',
      target_tags: [],
      target_recurrence: null,
      rename_merchant: 'Wise Multi-Currency',
      counterpart_account_id: null,
      counterpart_account_name: null,
      loan_id: null,
      loan_name: null,
      loan_type: null,
      priority: 15,
      is_active: true,
      match_count: 8,
      created_at: '2026-11-01T00:00:00Z',
      updated_at: '2026-11-01T00:00:00Z',
    },
    {
      id: 3,
      name: 'BPme Fuel',
      description_pattern: 'BPME',
      match_type: 'contains',
      amount_equals: null,
      min_amount: 30.0,
      max_amount: null,
      direction: 'outflow',
      target_category: 'Fuel',
      target_tags: ['fuel'],
      target_recurrence: null,
      rename_merchant: 'BP',
      counterpart_account_id: null,
      counterpart_account_name: null,
      loan_id: null,
      loan_name: null,
      loan_type: null,
      priority: 5,
      is_active: true,
      match_count: 6,
      created_at: '2026-11-01T00:00:00Z',
      updated_at: '2026-11-01T00:00:00Z',
    },
    {
      id: 4,
      name: 'BPme Coffee & Snacks',
      description_pattern: 'BPME',
      match_type: 'contains',
      amount_equals: null,
      min_amount: null,
      max_amount: 29.99,
      direction: 'outflow',
      target_category: 'Dining',
      target_tags: ['cafe'],
      target_recurrence: null,
      rename_merchant: 'BP Wild Bean Cafe',
      counterpart_account_id: null,
      counterpart_account_name: null,
      loan_id: null,
      loan_name: null,
      loan_type: null,
      priority: 6,
      is_active: true,
      match_count: 3,
      created_at: '2026-11-01T00:00:00Z',
      updated_at: '2026-11-01T00:00:00Z',
    },
    {
      id: 5,
      name: 'Manulife Dividends',
      description_pattern: 'IBG MANULIFE',
      match_type: 'contains',
      amount_equals: null,
      min_amount: null,
      max_amount: null,
      direction: 'inflow',
      target_category: 'Income',
      target_tags: ['dividend'],
      target_recurrence: null,
      rename_merchant: 'Dividends from Manulife',
      counterpart_account_id: 5,
      counterpart_account_name: 'Manulife',
      loan_id: null,
      loan_name: null,
      loan_type: null,
      priority: 8,
      is_active: true,
      match_count: 2,
      created_at: '2026-11-01T00:00:00Z',
      updated_at: '2026-11-01T00:00:00Z',
    },
  ];
  let nextRuleId = 6;

  await page.route(/\/api\/rules\/apply-all/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ evaluated: 42, updated: 6 }),
    });
  });

  await page.route(/\/api\/rules(\/.*|\?.*)?$/, async (route) => {
    const method = route.request().method();
    if (method === 'POST') {
      const body = route.request().postDataJSON() || {};
      const minAmt = body.min_amount !== undefined ? body.min_amount : null;
      const maxAmt = body.max_amount !== undefined ? body.max_amount : null;
      if (minAmt !== null && maxAmt !== null && Number(minAmt) > Number(maxAmt)) {
        await route.fulfill({
          status: 422,
          contentType: 'application/json',
          body: JSON.stringify({ detail: 'min_amount must be less than or equal to max_amount.' }),
        });
        return;
      }
      const counterpartId =
        body.counterpart_account_id !== undefined && body.counterpart_account_id !== null
          ? Number(body.counterpart_account_id)
          : null;
      const loanId =
        body.loan_id !== undefined && body.loan_id !== null ? Number(body.loan_id) : null;
      const created: MockRuleRecord = {
        id: nextRuleId++,
        name: body.name || 'New Custom Rule',
        description_pattern: body.description_pattern || 'PATTERN',
        match_type: body.match_type || 'contains',
        amount_equals: body.amount_equals !== undefined ? body.amount_equals : null,
        min_amount: minAmt,
        max_amount: maxAmt,
        direction: body.direction !== undefined ? body.direction : null,
        target_category: body.target_category || 'General',
        target_tags: Array.isArray(body.target_tags) ? body.target_tags : [],
        target_recurrence: body.target_recurrence !== undefined ? body.target_recurrence : null,
        rename_merchant: body.rename_merchant !== undefined ? body.rename_merchant : null,
        counterpart_account_id: counterpartId,
        counterpart_account_name: resolveAccountName(counterpartId),
        loan_id: loanId,
        loan_name: resolveLoanName(loanId),
        loan_type: resolveLoanType(loanId),
        priority: body.priority ?? 10,
        is_active: body.is_active ?? true,
        match_count: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      mockRules = [...mockRules, created];
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify(created),
      });
    } else if (method === 'PUT') {
      const match = route.request().url().match(/\/api\/rules\/(\d+)/);
      const ruleId = match ? Number(match[1]) : 1;
      const existing = mockRules.find((r) => r.id === ruleId);
      if (!existing) {
        await route.fulfill({
          status: 404,
          contentType: 'application/json',
          body: JSON.stringify({ detail: 'Categorization rule not found' }),
        });
        return;
      }
      const body = route.request().postDataJSON() || {};
      const nextMin = 'min_amount' in body ? body.min_amount : existing.min_amount;
      const nextMax = 'max_amount' in body ? body.max_amount : existing.max_amount;
      if (nextMin !== null && nextMax !== null && Number(nextMin) > Number(nextMax)) {
        await route.fulfill({
          status: 422,
          contentType: 'application/json',
          body: JSON.stringify({ detail: 'min_amount must be less than or equal to max_amount.' }),
        });
        return;
      }
      const nextCounterpartId =
        'counterpart_account_id' in body
          ? body.counterpart_account_id !== null && body.counterpart_account_id !== undefined
            ? Number(body.counterpart_account_id)
            : null
          : existing.counterpart_account_id;
      const nextLoanId =
        'loan_id' in body
          ? body.loan_id !== null && body.loan_id !== undefined
            ? Number(body.loan_id)
            : null
          : existing.loan_id;
      const updated: MockRuleRecord = {
        ...existing,
        name: body.name ?? existing.name,
        description_pattern: body.description_pattern ?? existing.description_pattern,
        match_type: body.match_type ?? existing.match_type,
        amount_equals: 'amount_equals' in body ? body.amount_equals : existing.amount_equals,
        min_amount: nextMin,
        max_amount: nextMax,
        direction: 'direction' in body ? body.direction : existing.direction,
        target_category: body.target_category ?? existing.target_category,
        target_tags: 'target_tags' in body ? body.target_tags : existing.target_tags,
        target_recurrence:
          'target_recurrence' in body ? body.target_recurrence : existing.target_recurrence,
        rename_merchant:
          'rename_merchant' in body ? body.rename_merchant : existing.rename_merchant,
        counterpart_account_id: nextCounterpartId,
        counterpart_account_name: resolveAccountName(nextCounterpartId),
        loan_id: nextLoanId,
        loan_name: resolveLoanName(nextLoanId),
        loan_type: resolveLoanType(nextLoanId),
        priority: body.priority ?? existing.priority,
        is_active: body.is_active !== undefined ? body.is_active : existing.is_active,
        updated_at: new Date().toISOString(),
      };
      mockRules = mockRules.map((r) => (r.id === ruleId ? updated : r));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(updated),
      });
    } else if (method === 'DELETE') {
      const match = route.request().url().match(/\/api\/rules\/(\d+)/);
      const ruleId = match ? Number(match[1]) : -1;
      mockRules = mockRules.filter((r) => r.id !== ruleId);
      await route.fulfill({
        status: 204,
        body: '',
      });
    } else {
      const url = new URL(route.request().url());
      const activeParam = url.searchParams.get('is_active');
      const filtered = mockRules
        .filter((r) => activeParam === null || String(r.is_active) === activeParam)
        .sort((a, b) => a.priority - b.priority || a.id - b.id);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(filtered),
      });
    }
  });

  // 9. Mock Receipts & Product Statistics Endpoints
  await page.route(/\/api\/receipts\/statistics\/products(\?.*)?$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        domain: null,
        total_products: 2,
        total_spend: 194.95,
        products: [
          {
            item_name: 'Vitamin C Serum 30ml',
            brand: 'La Roche-Posay',
            category: 'Health',
            domain: '02-skin',
            product_type: 'serum',
            volume_ml: '30ml',
            purchase_count: 3,
            total_spent: 134.97,
            unit_price_latest: 44.99,
            first_purchased: '2026-05-15',
            last_purchased: '2026-11-03',
            avg_days_between_purchases: 86.0,
            estimated_depletion_date: '2027-01-28',
          },
          {
            item_name: 'Vitamin C 1000mg 150 Tablets',
            brand: 'Blackmores',
            category: 'Health',
            domain: '01-health',
            product_type: 'supplement',
            volume_ml: null,
            purchase_count: 2,
            total_spent: 59.98,
            unit_price_latest: 29.99,
            first_purchased: '2026-06-10',
            last_purchased: '2026-11-03',
            avg_days_between_purchases: 146.0,
            estimated_depletion_date: '2027-03-29',
          },
        ],
      }),
    });
  });

  await page.route(/\/api\/receipts\/reconcile$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'reconciled',
        matched_count: 1,
        unmatched_count: 1,
      }),
    });
  });

  await page.route(/\/api\/receipts\/upload$/, async (route) => {
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 10,
        merchant: 'Chemist Warehouse Albany',
        receipt_date: '2026-11-04',
        total_amount: 74.98,
        currency: 'NZD',
        status: 'matched',
        transaction_id: 101,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        items: [
          {
            id: 20,
            receipt_id: 10,
            item_name: 'Vitamin C Serum 30ml',
            brand: 'La Roche-Posay',
            category: 'Health',
            domain: '02-skin',
            product_type: 'serum',
            volume_ml: '30ml',
            quantity: 1.0,
            unit_price: 44.99,
            total_price: 44.99,
            created_at: new Date().toISOString(),
          },
        ],
      }),
    });
  });

  interface MockReceiptItemRecord {
    id: number;
    receipt_id: number;
    item_name: string;
    brand?: string | null;
    category: string;
    domain?: string | null;
    product_type?: string | null;
    volume_ml?: string | null;
    quantity: number;
    unit_price: number;
    discount_amount?: number | null;
    total_price: number;
    inherited_tags?: string[];
    created_at: string;
  }

  interface MockReceiptRecord {
    id: number;
    document_type?: 'receipt' | 'payslip';
    merchant: string;
    receipt_date: string;
    total_amount: number;
    tax_amount?: number | null;
    currency: string;
    status: 'unlinked' | 'needs_review' | 'matched' | 'verified';
    transaction_id: number | null;
    order_number?: string | null;
    source_email_message_id?: string | null;
    has_image: boolean;
    is_processed: boolean;
    image_mime_type?: string | null;
    image_filename?: string | null;
    created_at: string;
    updated_at: string;
    items: MockReceiptItemRecord[];
  }

  interface MockReceiptCandidateRecord {
    transaction_id: number;
    transaction_date: string;
    merchant: string | null;
    raw_description: string;
    amount: number;
    currency: string;
    account_id: number;
    account_name: string | null;
    original_amount?: number | null;
    original_currency?: string | null;
    estimated_receipt_amount?: number | null;
    confidence: number;
    match_reason: string;
  }

  let mockReceipts: MockReceiptRecord[] = [
    {
      id: 1,
      merchant: 'Chemist Warehouse Albany',
      receipt_date: '2026-11-03',
      total_amount: 74.98,
      currency: 'NZD',
      status: 'matched',
      transaction_id: 101,
      has_image: true,
      is_processed: true,
      image_mime_type: 'image/svg+xml',
      image_filename: 'cw-receipt.webp',
      created_at: '2026-11-03T10:00:00Z',
      updated_at: '2026-11-03T10:00:00Z',
      items: [
        {
          id: 1,
          receipt_id: 1,
          item_name: 'Vitamin C 1000mg 150 Tablets',
          brand: 'Blackmores',
          category: 'Health',
          domain: '01-health',
          product_type: 'supplement',
          volume_ml: null,
          quantity: 1.0,
          unit_price: 34.99,
          discount_amount: 5.0,
          total_price: 29.99,
          inherited_tags: ['weekly-shop', 'pantry'],
          created_at: '2026-11-03T10:00:00Z',
        },
        {
          id: 2,
          receipt_id: 1,
          item_name: 'Vitamin C Serum 30ml',
          brand: 'La Roche-Posay',
          category: 'Health',
          domain: '02-skin',
          product_type: 'serum',
          volume_ml: '30ml',
          quantity: 1.0,
          unit_price: 44.99,
          total_price: 44.99,
          inherited_tags: ['weekly-shop', 'pantry'],
          created_at: '2026-11-03T10:00:00Z',
        },
      ],
    },
    {
      id: 2,
      merchant: 'Bunnings Warehouse',
      receipt_date: '2026-11-02',
      total_amount: 32.5,
      currency: 'NZD',
      status: 'unlinked',
      transaction_id: null,
      has_image: false,
      is_processed: true,
      created_at: '2026-11-02T14:30:00Z',
      updated_at: '2026-11-02T14:30:00Z',
      items: [
        {
          id: 3,
          receipt_id: 2,
          item_name: 'LED Smart Bulb E27',
          brand: 'Philips Hue',
          category: 'Utilities',
          domain: '20-home',
          product_type: 'lighting',
          volume_ml: null,
          quantity: 1.0,
          unit_price: 32.5,
          total_price: 32.5,
          created_at: '2026-11-02T14:30:00Z',
        },
      ],
    },
    {
      id: 3,
      merchant: 'Sydney Roasters Online',
      receipt_date: '2026-11-12',
      total_amount: 179.74,
      currency: 'AUD',
      status: 'needs_review',
      transaction_id: null,
      order_number: 'ORD-48219',
      source_email_message_id: '<order-48219@example-roasters.test>',
      has_image: false,
      is_processed: true,
      created_at: '2026-11-12T08:15:00Z',
      updated_at: '2026-11-12T08:15:00Z',
      items: [
        {
          id: 4,
          receipt_id: 3,
          item_name: 'Single Origin Espresso Beans 1kg',
          brand: 'Sydney Roasters',
          category: 'Groceries',
          domain: null,
          product_type: 'coffee',
          volume_ml: null,
          quantity: 2.0,
          unit_price: 89.87,
          total_price: 179.74,
          created_at: '2026-11-12T08:15:00Z',
        },
      ],
    },
    {
      id: 4,
      document_type: 'payslip',
      merchant: 'Acme Corp',
      receipt_date: '2026-11-19',
      total_amount: 4250.5,
      tax_amount: 1180.25,
      currency: 'NZD',
      status: 'matched',
      transaction_id: 150,
      order_number: '2026-11-01 to 2026-11-30',
      source_email_message_id: '<payslip-2026-11@acme-payroll.test>',
      has_image: true,
      is_processed: true,
      image_mime_type: 'application/pdf',
      image_filename: 'payslip.pdf',
      created_at: '2026-11-19T08:00:00Z',
      updated_at: '2026-11-19T08:00:00Z',
      items: [],
    },
  ];

  const mockReceiptCandidates: Record<number, MockReceiptCandidateRecord[]> = {
    3: [
      {
        transaction_id: 201,
        transaction_date: '2026-11-12',
        merchant: 'Sydney Roasters Pty',
        raw_description: 'CARD PURCHASE SYDNEY ROASTERS AUD 179.74',
        amount: -195.4,
        currency: 'NZD',
        account_id: 1,
        account_name: 'ASB Everyday Checking',
        original_amount: 179.74,
        original_currency: 'AUD',
        estimated_receipt_amount: 179.74,
        confidence: 0.94,
        match_reason: 'Same date, merchant similarity, exact AUD original amount match',
      },
      {
        transaction_id: 202,
        transaction_date: '2026-11-13',
        merchant: 'AU Online Merchant',
        raw_description: 'VISA INTL PURCHASE SYDNEY AU',
        amount: -196.1,
        currency: 'NZD',
        account_id: 2,
        account_name: 'ANZ Low Rate Visa',
        original_amount: null,
        original_currency: null,
        estimated_receipt_amount: 180.25,
        confidence: 0.68,
        match_reason: 'Estimated FX match within 1 day',
      },
    ],
    2: [
      {
        transaction_id: 203,
        transaction_date: '2026-11-02',
        merchant: 'Bunnings Albany',
        raw_description: 'EFTPOS BUNNINGS WAREHOUSE ALBANY',
        amount: -32.5,
        currency: 'NZD',
        account_id: 1,
        account_name: 'ASB Everyday Checking',
        original_amount: null,
        original_currency: null,
        estimated_receipt_amount: null,
        confidence: 0.89,
        match_reason: 'Exact NZD amount match on receipt date',
      },
    ],
  };

  await page.route(/\/api\/receipts(\?.*)?$/, async (route) => {
    const url = new URL(route.request().url());
    const statusParam = url.searchParams.get('status');
    const results = statusParam
      ? mockReceipts.filter((r) => r.status === statusParam)
      : mockReceipts;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(results),
    });
  });

  await page.route(/\/api\/receipts\/(\d+)\/candidates(\?.*)?$/, async (route) => {
    const match = route.request().url().match(/\/api\/receipts\/(\d+)\/candidates/);
    const id = match ? Number(match[1]) : 0;
    const receipt = mockReceipts.find((r) => r.id === id);
    if (!receipt) {
      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ detail: 'Receipt not found' }),
      });
      return;
    }
    const candidates = receipt.transaction_id != null ? [] : mockReceiptCandidates[id] || [];
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(candidates),
    });
  });

  await page.route(/\/api\/receipts\/(\d+)\/link\/(\d+)(\?.*)?$/, async (route) => {
    if (route.request().method() !== 'POST') {
      await route.continue();
      return;
    }
    const match = route.request().url().match(/\/api\/receipts\/(\d+)\/link\/(\d+)/);
    const receiptId = match ? Number(match[1]) : 0;
    const txId = match ? Number(match[2]) : 0;
    const receipt = mockReceipts.find((r) => r.id === receiptId);
    if (!receipt) {
      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ detail: 'Receipt not found' }),
      });
      return;
    }
    receipt.transaction_id = txId;
    receipt.status = 'matched';
    receipt.updated_at = new Date().toISOString();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(receipt),
    });
  });

  await page.route(/\/api\/receipts\/(\d+)\/image$/, async (route) => {
    const match = route.request().url().match(/\/api\/receipts\/(\d+)\/image$/);
    const id = match ? Number(match[1]) : 0;
    const receipt = mockReceipts.find((r) => r.id === id);
    if (
      receipt?.image_mime_type === 'application/pdf' ||
      receipt?.image_filename?.toLowerCase().endsWith('.pdf')
    ) {
      const minimalPdf = Buffer.from(
        '%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n',
        'utf-8'
      );
      await route.fulfill({
        status: 200,
        contentType: 'application/pdf',
        body: minimalPdf,
      });
      return;
    }
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="140" viewBox="0 0 240 140"><rect width="240" height="140" fill="#0f172a"/><rect x="16" y="14" width="208" height="112" rx="8" fill="#1e293b" stroke="#f59e0b" stroke-opacity="0.5"/><text x="120" y="54" fill="#f8fafc" font-family="monospace" font-size="13" text-anchor="middle">CHEMIST WAREHOUSE</text><text x="120" y="78" fill="#94a3b8" font-family="monospace" font-size="11" text-anchor="middle">2x Items   NZ$74.98</text><text x="120" y="102" fill="#fbbf24" font-family="monospace" font-size="10" text-anchor="middle">STORED WEBP RECEIPT</text></svg>`;
    await route.fulfill({
      status: 200,
      contentType: 'image/svg+xml',
      body: svg,
    });
  });

  await page.route(/\/api\/receipts\/(\d+)\/items\/(\d+)$/, async (route) => {
    const match = route.request().url().match(/\/api\/receipts\/(\d+)\/items\/(\d+)$/);
    const receiptId = match ? Number(match[1]) : 0;
    const itemId = match ? Number(match[2]) : 0;
    if (route.request().method() === 'PATCH') {
      const payload = JSON.parse(route.request().postData() || '{}');
      const receipt = mockReceipts.find((r) => r.id === receiptId);
      const item = receipt?.items.find((it) => it.id === itemId);
      if (!item) {
        await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ detail: 'Not found' }) });
        return;
      }
      if (payload.category !== undefined) {
        item.category = payload.category;
      }
      if (payload.tags !== undefined) {
        (item as { tags?: string[] }).tags = payload.tags;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(item),
      });
      return;
    }
    await route.continue();
  });

  await page.route(/\/api\/receipts\/(\d+)$/, async (route) => {
    const match = route.request().url().match(/\/api\/receipts\/(\d+)$/);
    const id = match ? Number(match[1]) : 0;
    if (route.request().method() === 'GET') {
      const receipt = mockReceipts.find((r) => r.id === id);
      if (!receipt) {
        await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ detail: 'Receipt not found' }) });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(receipt),
      });
      return;
    }
    if (route.request().method() === 'DELETE') {
      mockReceipts = mockReceipts.filter((r) => r.id !== id);
      await route.fulfill({ status: 204 });
      return;
    }
    await route.continue();
  });

  // Mock Products Catalog & Price History Endpoint
  await page.route(/\/api\/products(\?.*)?$/, async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_PRODUCTS_DATA),
      });
    } else {
      await route.continue();
    }
  });

  await page.route(/\/api\/products\/\d+$/, async (route) => {
    const method = route.request().method();
    if (method === 'PATCH') {
      const payload = JSON.parse(route.request().postData() || '{}');
      const prod = { ...MOCK_PRODUCTS_DATA.products[0], ...payload };
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(prod),
      });
    } else if (method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_PRODUCTS_DATA.products[0]),
      });
    } else {
      await route.continue();
    }
  });

  // Mock Loans Endpoint (stateful, transaction-driven)
  await page.route(/\/api\/loans(\/\d+)?(\?.*)?$/, async (route) => {
    const method = route.request().method();
    if (method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(computeLoansSummary()),
      });
    } else if (method === 'POST') {
      const body = route.request().postDataJSON() || {};
      const loanType: 'borrowed' | 'lent' = body.loan_type === 'lent' ? 'lent' : 'borrowed';
      const newId = nextLoanId++;
      const created: MockLoanRecord = {
        id: newId,
        name: body.name || 'New Loan',
        lender: body.lender || 'Lender',
        loan_type: loanType,
        principal_amount: Number(body.principal_amount) || 0,
        annual_interest_rate: Number(body.annual_interest_rate) || 0,
        term_months: Number(body.term_months) || 0,
        monthly_payment: Number(body.monthly_payment) || 0,
        start_date: body.start_date || '2026-11-20',
        asset_value: body.asset_value != null ? Number(body.asset_value) : null,
        currency: body.currency || 'NZD',
        is_active: true,
        payments_made: 0,
        payments_remaining: loanType === 'lent' ? 0 : Number(body.term_months) || 0,
        payoff_date: loanType === 'lent' ? null : '2029-10-20',
        next_payment_date: null,
        remaining_principal: Number(body.principal_amount) || 0,
        principal_paid: 0,
        remaining_interest: 0,
        weekly_payment_equivalent: 0,
        net_worth_impact: Number(body.principal_amount) || 0,
        total_paid_amount: 0,
        interest_paid: 0,
        last_payment_date: null,
        is_payment_due: false,
        linked_payments: [],
        disbursements: [],
      };
      mockLoans.push(created);
      const summary = computeLoansSummary();
      const createdView = summary.loans.find((l) => l.id === newId) || created;
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify(createdView),
      });
    } else if (method === 'DELETE') {
      const match = route.request().url().match(/\/api\/loans\/(\d+)/);
      const delId = match ? Number(match[1]) : -1;
      const idx = mockLoans.findIndex((l) => l.id === delId);
      if (idx >= 0) {
        mockLoans.splice(idx, 1);
      }
      await route.fulfill({ status: 204, body: '' });
    } else {
      await route.continue();
    }
  });

  // Mock Dynamic Hierarchical Categories Endpoints
  let mockCategories = buildInitialMockCategories();
  let nextCategoryId = 100;

  const normalizeMockCategories = (rows: MockCategoryRecord[]): MockCategoryRecord[] => {
    const byId = new Map(rows.map((r) => [r.id, r]));
    const childCounts = new Map<number, number>();
    for (const r of rows) {
      if (r.is_active && r.parent_id !== null) {
        childCounts.set(r.parent_id, (childCounts.get(r.parent_id) || 0) + 1);
      }
    }
    const enriched = rows.map((r) => {
      const parent = r.parent_id !== null ? byId.get(r.parent_id) || null : null;
      return {
        ...r,
        parent_name: parent ? parent.name : null,
        child_count: childCounts.get(r.id) || 0,
      };
    });
    const enrichedById = new Map(enriched.map((r) => [r.id, r]));
    return enriched.sort((a, b) => {
      const rootA = (a.parent_id !== null ? enrichedById.get(a.parent_id) : a) || a;
      const rootB = (b.parent_id !== null ? enrichedById.get(b.parent_id) : b) || b;
      const sysDiff = Number(rootA.is_system) - Number(rootB.is_system);
      if (sysDiff !== 0) return sysDiff;
      if (rootA.sort_order !== rootB.sort_order) return rootA.sort_order - rootB.sort_order;
      const rootNameCmp = rootA.name.toLowerCase().localeCompare(rootB.name.toLowerCase());
      if (rootNameCmp !== 0) return rootNameCmp;
      const depthDiff = Number(a.parent_id !== null) - Number(b.parent_id !== null);
      if (depthDiff !== 0) return depthDiff;
      if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
      return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
    });
  };

  await page.route(/\/api\/categories(\?.*)?$/, async (route) => {
    const method = route.request().method();
    if (method === 'GET') {
      const url = new URL(route.request().url());
      const includeInactive = url.searchParams.get('include_inactive') === 'true';
      const ordered = normalizeMockCategories(mockCategories).filter(
        (c) => includeInactive || c.is_active
      );
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(ordered),
      });
      return;
    }
    if (method === 'POST') {
      const body = route.request().postDataJSON() || {};
      const cleanedName = String(body.name || '').trim();
      const duplicate = mockCategories.find(
        (c) => c.name.toLowerCase() === cleanedName.toLowerCase()
      );
      if (duplicate) {
        await route.fulfill({
          status: 409,
          contentType: 'application/json',
          body: JSON.stringify({ detail: `Category '${duplicate.name}' already exists.` }),
        });
        return;
      }
      const parent =
        body.parent_id !== null && body.parent_id !== undefined
          ? mockCategories.find((c) => c.id === Number(body.parent_id)) || null
          : null;
      const created: MockCategoryRecord = {
        id: nextCategoryId++,
        name: cleanedName,
        parent_id: parent ? parent.id : null,
        parent_name: parent ? parent.name : null,
        is_system: false,
        is_active: true,
        amortize_period: body.amortize_period === 'annual' ? 'annual' : null,
        sort_order: body.sort_order ?? (parent ? parent.sort_order + 5 : 150),
        transaction_count: 0,
        rule_count: 0,
        child_count: 0,
        has_budget_rule: false,
        budget_period: body.amortize_period === 'annual' ? 'annual' : null,
        weekly_limit: null,
        monthly_limit: null,
        annual_limit: null,
      };
      mockCategories = normalizeMockCategories([...mockCategories, created]);
      const result = mockCategories.find((c) => c.id === created.id)!;
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify(result),
      });
      return;
    }
    await route.continue();
  });

  await page.route(/\/api\/categories\/(\d+)(\?.*)?$/, async (route) => {
    const match = route.request().url().match(/\/api\/categories\/(\d+)/);
    const catId = match ? Number(match[1]) : -1;
    const method = route.request().method();
    const target = mockCategories.find((c) => c.id === catId);
    if (!target) {
      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ detail: 'Category not found.' }),
      });
      return;
    }
    if (method === 'PATCH') {
      const body = route.request().postDataJSON() || {};
      const nextName =
        typeof body.name === 'string' && body.name.trim() ? body.name.trim() : target.name;
      const nextParentId =
        'parent_id' in body ? (body.parent_id === null ? null : Number(body.parent_id)) : target.parent_id;
      const nextAmortize =
        'amortize_period' in body
          ? body.amortize_period === 'annual'
            ? 'annual'
            : null
          : target.amortize_period;
      mockCategories = normalizeMockCategories(
        mockCategories.map((c) =>
          c.id === catId
            ? {
                ...c,
                name: nextName,
                parent_id: nextParentId,
                amortize_period: nextAmortize,
                budget_period:
                  nextAmortize === 'annual'
                    ? 'annual'
                    : c.has_budget_rule
                      ? 'monthly'
                      : null,
              }
            : c
        )
      );
      const updated = mockCategories.find((c) => c.id === catId)!;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(updated),
      });
      return;
    }
    if (method === 'DELETE') {
      const url = new URL(route.request().url());
      const reassignTo =
        url.searchParams.get('reassign_to') || target.parent_name || 'General';
      let childrenPromoted = 0;
      mockCategories = normalizeMockCategories(
        mockCategories
          .filter((c) => c.id !== catId)
          .map((c) => {
            if (c.parent_id === catId) {
              childrenPromoted += 1;
              return { ...c, parent_id: null, parent_name: null };
            }
            return c;
          })
      );
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          deleted_id: catId,
          deleted_name: target.name,
          reassigned_to: reassignTo,
          transactions_reassigned: target.transaction_count,
          rules_reassigned: target.rule_count,
          receipt_items_reassigned: 0,
          products_reassigned: 0,
          children_promoted: childrenPromoted,
        }),
      });
      return;
    }
    await route.continue();
  });

  await page.route(/\/api\/integrations\/sync\/all(\?.*)?$/, async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          provider: 'all',
          accounts_synced: 3,
          transactions_created: 5,
          transactions_skipped: 12,
          snapshots_updated: 3,
          accounts: [
            {
              account_id: 1,
              account_name: 'ANZ Freedom',
              institution: 'ANZ',
              currency: 'NZD',
              balance: 12450.0,
              transactions_created: 3,
              transactions_skipped: 6,
            },
            {
              account_id: 2,
              account_name: 'ANZ Low Rate Visa',
              institution: 'ANZ',
              currency: 'NZD',
              balance: -840.25,
              transactions_created: 1,
              transactions_skipped: 4,
            },
            {
              account_id: 3,
              account_name: 'Wise Multi-Currency',
              institution: 'Wise',
              currency: 'SGD',
              balance: 4200.0,
              transactions_created: 1,
              transactions_skipped: 2,
            },
          ],
        }),
      });
    } else {
      await route.continue();
    }
  });
}

/**
 * Sets up the shared mock API routes plus cashflow projection (`flow=inflow|outflow`),
 * dynamic breakdown updates, and synthetic payslip 901 fixture routes.
 */
export async function setupCashflowMockApi(
  page: Page,
  options?: { cashflowPageSize?: number }
): Promise<void> {
  await setupMockApi(page);
  await registerCashflowMockRoutes(page, options?.cashflowPageSize);
}
