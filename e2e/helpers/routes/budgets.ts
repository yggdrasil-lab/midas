import type { Page, Route } from '@playwright/test';
import {
  MOCK_BUDGET_BREAKDOWN,
  MOCK_RECURRING_COMMITMENTS,
  MOCK_SYNC_FROM_BURN_RULES,
} from '../fixtures/budgets-fixtures';
import type { MockApiState } from '../mock-types';

function fulfillJson(route: Route, status: number, payload: unknown): Promise<void> {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(payload),
  });
}

function getRulePeriod(state: MockApiState, categoryName: string): 'weekly' | 'monthly' | 'annual' {
  const matched = state.budgetRules.find(
    (rule) => rule.category.toLowerCase() === categoryName.toLowerCase()
  );
  return matched ? matched.budget_period : 'monthly';
}

function buildAverageBurnPayload(state: MockApiState, lookback: number) {
  const is4w = lookback === 4;
  const variableTotal = is4w ? 450.0 : 490.0;
  const grocVar = is4w ? 250.0 : 285.0;
  const foodVar = is4w ? 200.0 : 205.0;
  const effectiveTotal = 510.0 + variableTotal;

  return {
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
        budget_period: getRulePeriod(state, 'Housing'),
        variable_percentage: 0.0,
        total_percentage: 40.0,
      },
      {
        category: 'Groceries',
        variable_weekly_burn: grocVar,
        recurring_weekly_burn: 0.0,
        average_weekly_burn: grocVar,
        suggested_monthly_limit: Math.round(((grocVar * 52) / 12) * 100) / 100,
        suggested_annual_limit: Math.round(grocVar * 52 * 100) / 100,
        budget_period: getRulePeriod(state, 'Groceries'),
        variable_percentage: Math.round((grocVar / variableTotal) * 1000) / 10,
        total_percentage: Math.round((grocVar / effectiveTotal) * 1000) / 10,
      },
      {
        category: 'Food',
        variable_weekly_burn: foodVar,
        recurring_weekly_burn: 0.0,
        average_weekly_burn: foodVar,
        suggested_monthly_limit: Math.round(((foodVar * 52) / 12) * 100) / 100,
        suggested_annual_limit: Math.round(foodVar * 52 * 100) / 100,
        budget_period: getRulePeriod(state, 'Food'),
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
        budget_period: getRulePeriod(state, 'Insurance'),
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
        budget_period: getRulePeriod(state, 'Health'),
        variable_percentage: 0.0,
        total_percentage: 1.4,
      },
    ],
    recurring_commitments: MOCK_RECURRING_COMMITMENTS,
  };
}

function handlePostBudget(route: Route, state: MockApiState): Promise<void> {
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

  const existingIdx = state.budgetRules.findIndex(
    (r) => r.category.toLowerCase() === payload.category.toLowerCase()
  );
  const updated = {
    id: existingIdx >= 0 ? state.budgetRules[existingIdx].id : state.budgetRules.length + 1,
    category: payload.category,
    weekly_limit: weeklyLimit,
    monthly_limit: monthlyLimit,
    annual_limit: annualLimit,
    budget_period: period,
    is_active: true,
  };
  if (existingIdx >= 0) {
    state.budgetRules[existingIdx] = updated;
  } else {
    state.budgetRules.push(updated);
  }
  return fulfillJson(route, 201, updated);
}

export async function registerBudgetRoutes(page: Page, state: MockApiState): Promise<void> {
  await page.route('**/api/budgets/breakdown**', (route) =>
    fulfillJson(route, 200, MOCK_BUDGET_BREAKDOWN)
  );

  await page.route('**/api/budgets/average-burn**', (route) => {
    const url = new URL(route.request().url());
    const lookback = Number(url.searchParams.get('lookback_weeks') || '12');
    return fulfillJson(route, 200, buildAverageBurnPayload(state, lookback));
  });

  await page.route('**/api/budgets/sync-from-burn**', (route) =>
    fulfillJson(route, 200, MOCK_SYNC_FROM_BURN_RULES)
  );

  await page.route(/\/api\/budgets(\?.*)?$/, (route) => {
    if (route.request().method() === 'POST') {
      return handlePostBudget(route, state);
    }
    return fulfillJson(route, 200, state.budgetRules);
  });
}
