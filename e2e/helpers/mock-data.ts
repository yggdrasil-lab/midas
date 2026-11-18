import type { Page } from '@playwright/test';

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
    },
  ],
  total_liabilities: 45399.42,
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
  await page.route(/\/api\/accounts\/\d+\/snapshots(\?.*)?$/, async (route) => {
    if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON() || {};
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 99,
          snapshot_date: body.snapshot_date || '2026-11-04',
          account_id: 1,
          balance: Number(body.balance) || 25000.0,
          currency: body.currency || 'NZD',
          exchange_rate: body.exchange_rate || 1.0,
          balance_nzd: Number(body.balance) || 25000.0,
          source: body.source || 'manual',
          notes: body.notes || 'Manual balance update',
          created_at: '2026-11-04T12:00:00Z',
        }),
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

  await page.route(/\/api\/accounts(\?.*)?$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
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
      ]),
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

  const mockTransactions = [
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
  ];

  // 7. Mock Transactions Endpoints for Inspection & Category Correction
  await page.route(/\/api\/transactions(\/.*|\?.*)?$/, async (route) => {
    if (route.request().method() === 'PATCH') {
      const body = route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 101,
          transaction_date: '2026-11-04',
          account_id: 1,
          account_name: 'ANZ Freedom',
          amount: -120.5,
          currency: 'NZD',
          merchant: 'Pak n Save Albany',
          category: body?.category || 'Food',
          tags: body?.tags || ['weekly-shop'],
        }),
      });
    } else {
      const url = new URL(route.request().url());
      const categoryParam = url.searchParams.get('category');
      const tagParam = url.searchParams.get('tag');
      const periodParam = url.searchParams.get('period');
      const accountIdParam = url.searchParams.get('account_id');

      let filtered = mockTransactions;
      if (accountIdParam) {
        filtered = filtered.filter((tx) => String(tx.account_id) === accountIdParam);
      }
      if (categoryParam) {
        filtered = filtered.filter(
          (tx) => tx.category.toLowerCase() === categoryParam.toLowerCase()
        );
      }
      if (tagParam) {
        filtered = filtered.filter((tx) => (tx.tags || []).includes(tagParam));
      }
      if (periodParam === 'week' || periodParam === 'last_week' || periodParam === 'month') {
        filtered = filtered.filter((tx) => tx.transaction_date >= '2026-11-01');
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

  // 8. Mock Outlook-style Categorization Rules Endpoints
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
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 3,
          name: body.name || 'New Custom Rule',
          description_pattern: body.description_pattern || 'PATTERN',
          match_type: body.match_type || 'contains',
          amount_equals: body.amount_equals || null,
          target_category: body.target_category || 'General',
          rename_merchant: body.rename_merchant || null,
          priority: body.priority || 10,
          is_active: body.is_active ?? true,
          match_count: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }),
      });
    } else if (method === 'PUT') {
      const body = route.request().postDataJSON() || {};
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 1,
          name: body.name || 'Updated Rule',
          description_pattern: body.description_pattern || '12-0323-0895056',
          match_type: body.match_type || 'contains',
          amount_equals: body.amount_equals !== undefined ? body.amount_equals : 400.0,
          target_category: body.target_category || 'Utilities',
          rename_merchant: body.rename_merchant || 'Power/Water Utilities',
          priority: body.priority || 10,
          is_active: body.is_active !== undefined ? body.is_active : true,
          match_count: 5,
          created_at: '2026-11-01T00:00:00Z',
          updated_at: new Date().toISOString(),
        }),
      });
    } else if (method === 'DELETE') {
      await route.fulfill({
        status: 204,
        body: '',
      });
    } else {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 1,
            name: 'Utilities Regular',
            description_pattern: '12-0323-0895056',
            match_type: 'contains',
            amount_equals: 400.0,
            target_category: 'Utilities',
            rename_merchant: 'Power/Water Utilities',
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
            target_category: 'Transfers',
            rename_merchant: 'Wise Multi-Currency',
            priority: 15,
            is_active: true,
            match_count: 8,
            created_at: '2026-11-01T00:00:00Z',
            updated_at: '2026-11-01T00:00:00Z',
          },
        ]),
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

  await page.route(/\/api\/receipts(\?.*)?$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          id: 1,
          merchant: 'Chemist Warehouse Albany',
          receipt_date: '2026-11-03',
          total_amount: 74.98,
          currency: 'NZD',
          status: 'matched',
          transaction_id: 101,
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
              unit_price: 29.99,
              total_price: 29.99,
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
      ]),
    });
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

  // Mock External Bank Feed Sync Endpoint
  await page.route(/\/api\/loans(\/\d+)?(\?.*)?$/, async (route) => {
    const method = route.request().method();
    if (method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_LOANS_DATA),
      });
    } else if (method === 'POST') {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_LOANS_DATA.loans[0]),
      });
    } else if (method === 'DELETE') {
      await route.fulfill({ status: 204, body: '' });
    } else {
      await route.continue();
    }
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
