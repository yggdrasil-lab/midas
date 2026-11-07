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

  // 4b. Mock Sample Statement Endpoint
  await page.route(/\/api\/integrations\/sample-statement(\?.*)?$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'text/csv',
      body: `Date,Amount,Payee,Description\n2026-10-02,-145.50,Pak n Save Albany,Groceries\n2026-10-05,-12.50,Columbus Coffee,Cafe\n`,
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
            percent_used: 85.0,
            is_over_budget: false,
            warning_level: 'warning',
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

  await page.route(/\/api\/budgets(\?.*)?$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        { id: 1, category: 'Groceries', weekly_limit: 75.0, monthly_limit: 300.0, is_active: true },
        { id: 2, category: 'Transport', weekly_limit: 50.0, monthly_limit: 200.0, is_active: true },
      ]),
    });
  });

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
        }),
      });
    } else {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 101,
            transaction_date: '2026-11-04',
            account_id: 1,
            account_name: 'ANZ Freedom',
            amount: -120.5,
            currency: 'NZD',
            merchant: 'Pak n Save Albany',
            category: 'Groceries',
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
        ]),
      });
    }
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
}
