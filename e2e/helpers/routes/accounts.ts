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
  if (reqAccountId === 8) {
    return [
      {
        id: 80,
        snapshot_date: '2026-11-04',
        account_id: 8,
        balance: -1500.0,
        currency: 'NZD',
        exchange_rate: 1.0,
        balance_nzd: -1500.0,
        source: 'api',
        notes: 'Synthetic Visa statement',
        created_at: '2026-11-04T10:00:00Z',
      },
    ];
  }
  if (reqAccountId === 9) {
    return [
      {
        id: 90,
        snapshot_date: '2026-11-04',
        account_id: 9,
        balance: -4500.0,
        currency: 'SGD',
        exchange_rate: 1.29,
        balance_nzd: -5805.0,
        source: 'manual',
        notes: 'Synthetic Cashline statement',
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

function recomputeMockCreditFields(acc: MockApiState['accounts'][number]): void {
  const isCredit = acc.account_type === 'credit_card' || acc.account_type === 'credit_line';
  if (!isCredit || acc.credit_limit == null || acc.credit_limit <= 0) {
    acc.credit_limit_nzd = null;
    acc.credit_owed_native = null;
    acc.credit_owed_nzd = null;
    acc.available_credit_native = null;
    acc.available_credit_nzd = null;
    acc.credit_utilization_pct = null;
    return;
  }
  const snaps = buildAccountSnapshots(acc.id);
  const snap = snaps[0];
  const fx = acc.currency.toUpperCase() === 'SGD' ? 1.29 : 1.0;
  const owedNative = snap ? Math.max(0, -snap.balance) : 0;
  const owedNzd = Math.round(owedNative * fx * 100) / 100;
  const limitNzd = Math.round(acc.credit_limit * fx * 100) / 100;
  acc.credit_limit_nzd = limitNzd;
  acc.credit_owed_native = Math.round(owedNative * 100) / 100;
  acc.credit_owed_nzd = owedNzd;
  acc.available_credit_native = Math.round(Math.max(0, acc.credit_limit - owedNative) * 100) / 100;
  acc.available_credit_nzd = Math.round(Math.max(0, limitNzd - owedNzd) * 100) / 100;
  acc.credit_utilization_pct = Math.round((owedNative / acc.credit_limit) * 10000) / 100;
}

function buildDynamicCreditBackstop(accounts: MockApiState['accounts']) {
  const configured = accounts.filter(
    (a) =>
      a.is_active &&
      (a.account_type === 'credit_card' || a.account_type === 'credit_line') &&
      a.credit_limit != null &&
      a.credit_limit > 0
  );
  if (configured.length === 0) return undefined;
  const totalLimit = Math.round(configured.reduce((s, a) => s + (a.credit_limit_nzd ?? 0), 0) * 100) / 100;
  const totalOwed = Math.round(configured.reduce((s, a) => s + (a.credit_owed_nzd ?? 0), 0) * 100) / 100;
  const totalAvail = Math.round(configured.reduce((s, a) => s + (a.available_credit_nzd ?? 0), 0) * 100) / 100;
  const utilPct = totalLimit > 0 ? Math.round((totalOwed / totalLimit) * 10000) / 100 : 0;
  const burnRate = MOCK_RUNWAY_DATA.breakdown.weekly_burn_rate || 1000;
  return {
    total_credit_limit_nzd: totalLimit,
    total_credit_owed_nzd: totalOwed,
    total_available_credit_nzd: totalAvail,
    credit_utilization_pct: utilPct,
    backstop_weeks: Math.round((totalAvail / burnRate) * 10) / 10,
    credit_card_available_nzd: configured
      .filter((a) => a.account_type === 'credit_card')
      .reduce((s, a) => s + (a.available_credit_nzd ?? 0), 0),
    credit_line_available_nzd: configured
      .filter((a) => a.account_type === 'credit_line')
      .reduce((s, a) => s + (a.available_credit_nzd ?? 0), 0),
    account_count: configured.length,
  };
}

export async function registerAccountRoutes(page: Page, state: MockApiState): Promise<void> {
  await page.route('**/api/runway/simulate**', (route) => fulfillJson(route, 200, MOCK_SIMULATED_DATA));
  await page.route(/\/api\/runway(\?.*)?$/, (route) =>
    fulfillJson(route, 200, {
      ...MOCK_RUNWAY_DATA,
      breakdown: {
        ...MOCK_RUNWAY_DATA.breakdown,
        credit_backstop: buildDynamicCreditBackstop(state.accounts),
      },
    })
  );

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
  await page.route(/\/api\/accounts\/(\d+)(\?.*)?$/, async (route) => {
    const match = route.request().url().match(/\/api\/accounts\/(\d+)/);
    const accId = match ? Number(match[1]) : -1;
    const acc = state.accounts.find((a) => a.id === accId);
    if (!acc) return fulfillJson(route, 404, { detail: 'Account not found' });
    if (route.request().method() === 'PATCH') {
      const body = route.request().postDataJSON() || {};
      if (body.credit_limit !== undefined && body.credit_limit !== null) {
        if (typeof body.credit_limit !== 'number' || !Number.isFinite(body.credit_limit) || body.credit_limit <= 0) {
          return fulfillJson(route, 422, { detail: 'Credit limit must be greater than 0.' });
        }
      }
      if (body.name !== undefined) acc.name = String(body.name);
      if (body.account_type !== undefined) acc.account_type = String(body.account_type);
      if (body.tier !== undefined) acc.tier = String(body.tier);
      if (body.institution !== undefined) acc.institution = String(body.institution);
      if (body.expected_annual_return !== undefined) acc.expected_annual_return = Number(body.expected_annual_return);
      if (body.credit_limit !== undefined) acc.credit_limit = body.credit_limit;
      if (body.is_active !== undefined) acc.is_active = Boolean(body.is_active);
      recomputeMockCreditFields(acc);
      return fulfillJson(route, 200, acc);
    }
    return fulfillJson(route, 200, acc);
  });
  await page.route(/\/api\/institutions(\?.*)?$/, (route) =>
    fulfillJson(route, 200, MOCK_INSTITUTIONS)
  );
  await page.route(/\/api\/accounts(\?.*)?$/, (route) =>
    fulfillJson(route, 200, state.accounts.filter((a) => a.is_active))
  );
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
