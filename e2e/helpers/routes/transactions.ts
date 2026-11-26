import type { Page, Route } from '@playwright/test';
import { MOCK_TAG_SUMMARY_ALL, MOCK_TAG_SUMMARY_MONTH } from '../fixtures/transactions-fixtures';
import {
  resolveAccountName,
  resolveLoanName,
  resolveLoanType,
} from '../mock-state';
import type {
  MockApiState,
  MockRuleRecord,
  MockTransactionRecord,
} from '../mock-types';

function fulfillJson(route: Route, status: number, payload: unknown): Promise<void> {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(payload),
  });
}

interface RawSplitInput {
  amount: number;
  category: string;
  tags?: string[];
  loan_id?: number | null;
  notes?: string | null;
}

function handlePutTransactionSplits(
  route: Route,
  state: MockApiState,
  reqUrl: string
): Promise<void> {
  const match = reqUrl.match(/\/api\/transactions\/(\d+)\/splits$/);
  const txId = match ? Number(match[1]) : 101;
  const rawBody = route.request().postDataJSON();
  const inputSplits: RawSplitInput[] = Array.isArray(rawBody)
    ? rawBody
    : Array.isArray(rawBody?.splits)
      ? rawBody.splits
      : [];
  const existing = state.transactions.find((tx) => tx.id === txId);
  if (!existing) return fulfillJson(route, 404, { detail: 'Transaction not found' });

  if (inputSplits.length === 0) {
    existing.splits = [];
    existing.is_split = false;
    return fulfillJson(route, 200, existing);
  }

  const signedSum =
    Math.round(inputSplits.reduce((sum, s) => sum + Number(s.amount), 0) * 100) / 100;
  const parentAmt = Math.round(Number(existing.amount) * 100) / 100;
  if (Math.abs(signedSum - parentAmt) > 0.01) {
    return fulfillJson(route, 422, {
      detail: `Split amounts (${signedSum.toFixed(2)}) must sum to transaction amount (${parentAmt.toFixed(2)}).`,
    });
  }

  existing.loan_id = null;
  existing.loan_name = null;
  existing.loan_type = null;
  existing.loan_payment_amount = null;
  existing.splits = inputSplits.map((s) => {
    const splitLoanId = s.loan_id != null ? Number(s.loan_id) : null;
    return {
      id: state.nextSplitId++,
      transaction_id: txId,
      amount: Number(s.amount),
      category: String(s.category || existing.category),
      tags: Array.isArray(s.tags) ? s.tags : [],
      loan_id: splitLoanId,
      loan_name: resolveLoanName(state, splitLoanId),
      loan_type: resolveLoanType(state, splitLoanId),
      notes: s.notes ?? null,
    };
  });
  existing.is_split = true;
  return fulfillJson(route, 200, existing);
}

function handlePatchTransaction(route: Route, state: MockApiState, reqUrl: string): Promise<void> {
  const match = reqUrl.match(/\/api\/transactions\/(\d+)/);
  const txId = match ? Number(match[1]) : 101;
  const body = route.request().postDataJSON();
  const existing =
    state.transactions.find((tx) => tx.id === txId) ||
    state.amortizedUtilities.find((tx) => tx.id === txId);

  if (existing) {
    if (body?.category !== undefined) existing.category = body.category;
    if (body?.tags !== undefined) existing.tags = body.tags;
    if (body?.recurrence !== undefined) existing.recurrence = body.recurrence;
    if ('loan_id' in (body || {})) {
      const nextLoanId = body.loan_id != null ? Number(body.loan_id) : null;
      existing.loan_id = nextLoanId;
      existing.loan_name = resolveLoanName(state, nextLoanId);
      existing.loan_type = resolveLoanType(state, nextLoanId);
      if (nextLoanId == null) existing.loan_payment_amount = null;
    }
    if ('loan_payment_amount' in (body || {})) {
      existing.loan_payment_amount =
        body.loan_payment_amount != null ? Number(body.loan_payment_amount) : null;
    }
  }

  return fulfillJson(route, 200, {
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
  });
}

function filterTransactions(state: MockApiState, url: URL): MockTransactionRecord[] {
  const categoryParam = url.searchParams.get('category');
  const tagParam = url.searchParams.get('tag');
  const periodParam = url.searchParams.get('period');
  const accountIdParam = url.searchParams.get('account_id');
  const includeAmortizedParam = url.searchParams.get('include_amortized');

  let filtered = [...state.transactions];
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
          const matched = tx.splits.filter((s) => s.category.toLowerCase() === targetLower);
          if (matched.length === 0) return null;
          const splitAmt = Math.round(matched.reduce((s, x) => s + Number(x.amount), 0) * 100) / 100;
          return { ...tx, amount: splitAmt, category: matched[0].category };
        }
        return tx.category.toLowerCase() === targetLower ? tx : null;
      })
      .filter((tx): tx is MockTransactionRecord => tx !== null);
  }
  if (tagParam) filtered = filtered.filter((tx) => (tx.tags || []).includes(tagParam));
  if (periodParam === 'week' || periodParam === 'last_week' || periodParam === 'month') {
    filtered = filtered.filter((tx) => tx.transaction_date >= '2026-11-01');
  }

  const isCadence =
    periodParam === 'week' ||
    periodParam === 'last_week' ||
    periodParam === 'month' ||
    periodParam === 'last_month';
  if (includeAmortizedParam === 'true' && categoryParam?.toLowerCase() === 'utilities' && isCadence) {
    const cadence = periodParam === 'week' || periodParam === 'last_week' ? 'week' : 'month';
    filtered = [
      ...filtered,
      ...state.amortizedUtilities.map((tx) => ({ ...tx, amortized_cadence: cadence })),
    ];
  }
  return filtered;
}

function handleCreateRule(route: Route, state: MockApiState): Promise<void> {
  const body = route.request().postDataJSON() || {};
  const minAmt = body.min_amount !== undefined ? body.min_amount : null;
  const maxAmt = body.max_amount !== undefined ? body.max_amount : null;
  if (minAmt !== null && maxAmt !== null && Number(minAmt) > Number(maxAmt)) {
    return fulfillJson(route, 422, { detail: 'min_amount must be less than or equal to max_amount.' });
  }
  const counterpartId =
    body.counterpart_account_id !== undefined && body.counterpart_account_id !== null
      ? Number(body.counterpart_account_id)
      : null;
  const loanId = body.loan_id !== undefined && body.loan_id !== null ? Number(body.loan_id) : null;
  const now = new Date().toISOString();
  const created: MockRuleRecord = {
    id: state.nextRuleId++,
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
    counterpart_account_name: resolveAccountName(state, counterpartId),
    loan_id: loanId,
    loan_name: resolveLoanName(state, loanId),
    loan_type: resolveLoanType(state, loanId),
    priority: body.priority ?? 10,
    is_active: body.is_active ?? true,
    match_count: 0,
    created_at: now,
    updated_at: now,
  };
  state.rules = [...state.rules, created];
  return fulfillJson(route, 201, created);
}

function buildUpdatedRule(
  state: MockApiState,
  existing: MockRuleRecord,
  body: Record<string, unknown>,
  nextMin: number | null,
  nextMax: number | null
): MockRuleRecord {
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
  return {
    ...existing,
    name: (body.name as string | undefined) ?? existing.name,
    description_pattern:
      (body.description_pattern as string | undefined) ?? existing.description_pattern,
    match_type: (body.match_type as MockRuleRecord['match_type'] | undefined) ?? existing.match_type,
    amount_equals:
      'amount_equals' in body ? (body.amount_equals as number | null) : existing.amount_equals,
    min_amount: nextMin,
    max_amount: nextMax,
    direction:
      'direction' in body ? (body.direction as MockRuleRecord['direction']) : existing.direction,
    target_category: (body.target_category as string | undefined) ?? existing.target_category,
    target_tags: 'target_tags' in body ? (body.target_tags as string[]) : existing.target_tags,
    target_recurrence:
      'target_recurrence' in body
        ? (body.target_recurrence as string | null)
        : existing.target_recurrence,
    rename_merchant:
      'rename_merchant' in body ? (body.rename_merchant as string | null) : existing.rename_merchant,
    counterpart_account_id: nextCounterpartId,
    counterpart_account_name: resolveAccountName(state, nextCounterpartId),
    loan_id: nextLoanId,
    loan_name: resolveLoanName(state, nextLoanId),
    loan_type: resolveLoanType(state, nextLoanId),
    priority: (body.priority as number | undefined) ?? existing.priority,
    is_active: body.is_active !== undefined ? Boolean(body.is_active) : existing.is_active,
    updated_at: new Date().toISOString(),
  };
}

function handleUpdateRule(route: Route, state: MockApiState): Promise<void> {
  const match = route.request().url().match(/\/api\/rules\/(\d+)/);
  const ruleId = match ? Number(match[1]) : 1;
  const existing = state.rules.find((r) => r.id === ruleId);
  if (!existing) return fulfillJson(route, 404, { detail: 'Categorization rule not found' });
  const body = (route.request().postDataJSON() || {}) as Record<string, unknown>;
  const nextMin =
    'min_amount' in body ? (body.min_amount as number | null) : existing.min_amount;
  const nextMax =
    'max_amount' in body ? (body.max_amount as number | null) : existing.max_amount;
  if (nextMin !== null && nextMax !== null && Number(nextMin) > Number(nextMax)) {
    return fulfillJson(route, 422, { detail: 'min_amount must be less than or equal to max_amount.' });
  }
  const updated = buildUpdatedRule(state, existing, body, nextMin, nextMax);
  state.rules = state.rules.map((r) => (r.id === ruleId ? updated : r));
  return fulfillJson(route, 200, updated);
}

export async function registerTransactionRoutes(page: Page, state: MockApiState): Promise<void> {
  await page.route(/\/api\/transactions(\/.*|\?.*)?$/, (route) => {
    const reqUrl = route.request().url();
    const method = route.request().method();
    if (method === 'PUT' && /\/api\/transactions\/(\d+)\/splits$/.test(reqUrl)) {
      return handlePutTransactionSplits(route, state, reqUrl);
    }
    if (method === 'PATCH') return handlePatchTransaction(route, state, reqUrl);
    return fulfillJson(route, 200, filterTransactions(state, new URL(reqUrl)));
  });

  await page.route('**/api/transactions/summary/tags**', (route) => {
    const periodParam = new URL(route.request().url()).searchParams.get('period') || 'all';
    const isShortMonth = periodParam === 'month' || periodParam === 'last_month';
    return fulfillJson(route, 200, {
      period: periodParam,
      start_date: null,
      end_date: null,
      total_tagged_spend: isShortMonth ? 120.5 : 1570.5,
      tags: isShortMonth ? MOCK_TAG_SUMMARY_MONTH : MOCK_TAG_SUMMARY_ALL,
    });
  });

  await page.route('**/api/transactions/reconcile-transfers', (route) =>
    fulfillJson(route, 200, { status: 'ok', matched_transfers: 2 })
  );

  await page.route(/\/api\/rules\/apply-all/, (route) =>
    fulfillJson(route, 200, { evaluated: 42, updated: 6 })
  );

  await page.route(/\/api\/rules(\/.*|\?.*)?$/, (route) => {
    const method = route.request().method();
    if (method === 'POST') return handleCreateRule(route, state);
    if (method === 'PUT') return handleUpdateRule(route, state);
    if (method === 'DELETE') {
      const match = route.request().url().match(/\/api\/rules\/(\d+)/);
      const ruleId = match ? Number(match[1]) : -1;
      state.rules = state.rules.filter((r) => r.id !== ruleId);
      return route.fulfill({ status: 204, body: '' });
    }
    const activeParam = new URL(route.request().url()).searchParams.get('is_active');
    const filtered = state.rules
      .filter((r) => activeParam === null || String(r.is_active) === activeParam)
      .sort((a, b) => a.priority - b.priority || a.id - b.id);
    return fulfillJson(route, 200, filtered);
  });
}
