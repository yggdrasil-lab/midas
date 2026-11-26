import type { Page, Route } from '@playwright/test';
import {
  MOCK_INSTITUTIONS,
  MOCK_STATEMENT_RESPONSE,
  MOCK_SYNC_ALL_RESPONSE,
} from '../fixtures/accounts-fixtures';
import { MOCK_RUNWAY_DATA, MOCK_SIMULATED_DATA } from '../mock-fixtures';
import type { MockApiState } from '../mock-types';

function fulfillJson(route: Route, status: number, payload: unknown): Promise<void> {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(payload),
  });
}

function buildAccountSnapshots(reqAccountId: number) {
  if (reqAccountId === 5) {
    return [
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
    ];
  }
  if (reqAccountId === 6) {
    return [
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
    ];
  }
  return [
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
  ];
}

async function handleAccountSnapshotsRoute(route: Route): Promise<void> {
  const match = route.request().url().match(/\/api\/accounts\/(\d+)\/snapshots/);
  const reqAccountId = match ? Number(match[1]) : 1;
  if (route.request().method() === 'POST') {
    const body = route.request().postDataJSON() || {};
    const currency = body.currency || 'NZD';
    const fx = body.exchange_rate ?? (currency === 'SGD' ? 1.29 : 1.0);
    const bal = Number(body.balance) || 25000.0;
    await fulfillJson(route, 201, {
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
    });
    return;
  }
  await fulfillJson(route, 200, buildAccountSnapshots(reqAccountId));
}

export async function registerAccountRoutes(page: Page, state: MockApiState): Promise<void> {
  await page.route('**/api/runway/simulate**', (route) => fulfillJson(route, 200, MOCK_SIMULATED_DATA));
  await page.route(/\/api\/runway(\?.*)?$/, (route) => fulfillJson(route, 200, MOCK_RUNWAY_DATA));

  await page.route('**/api/integrations/quick-log**', (route) => {
    const postData = JSON.parse(route.request().postData() || '{}');
    return fulfillJson(route, 201, {
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
    });
  });

  await page.route('**/api/integrations/statement**', (route) =>
    fulfillJson(route, 200, MOCK_STATEMENT_RESPONSE)
  );
  await page.route(/\/api\/accounts\/(\d+)\/snapshots(\?.*)?$/, handleAccountSnapshotsRoute);
  await page.route(/\/api\/institutions(\?.*)?$/, (route) =>
    fulfillJson(route, 200, MOCK_INSTITUTIONS)
  );
  await page.route(/\/api\/accounts(\?.*)?$/, (route) => fulfillJson(route, 200, state.accounts));
}

export async function registerIntegrationSyncRoute(page: Page): Promise<void> {
  await page.route(/\/api\/integrations\/sync\/all(\?.*)?$/, async (route) => {
    if (route.request().method() === 'POST') {
      await fulfillJson(route, 200, MOCK_SYNC_ALL_RESPONSE);
      return;
    }
    await route.continue();
  });
}
