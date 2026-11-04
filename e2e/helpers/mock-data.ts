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
  },
};

export const MOCK_SIMULATED_DATA = {
  simulated_runway_weeks: 228.0,
  simulated_runway_years: 4.4,
  is_perpetual: false,
  delta_weeks_compared_to_baseline: 44.0,
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

  // 5. Mock Accounts Endpoint
  await page.route('**/api/accounts**', async (route) => {
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
      ]),
    });
  });
}
