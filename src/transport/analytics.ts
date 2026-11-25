import {
  AverageBurnReportResponse,
  BudgetRule,
  PeriodType,
  RunwayAiSynthesisResult,
  RunwayData,
  RunwayScenarioResult,
  SpendingBreakdownResponse,
  TagSpendingSummaryResponse,
} from '../types';
import { appendPeriodParams, HttpClient, jsonRequestInit } from './http';

function fetchSpendingBreakdownRequest(
  client: HttpClient,
  period: PeriodType = 'month',
  startDate?: string,
  endDate?: string,
  groupBy: 'leaf' | 'base' = 'leaf'
): Promise<SpendingBreakdownResponse> {
  const params = new URLSearchParams();
  appendPeriodParams(params, period, startDate, endDate);
  if (groupBy !== 'leaf') params.set('group_by', groupBy);
  return client.requestJson<SpendingBreakdownResponse>(
    `/budgets/breakdown?${params.toString()}`,
    { fallbackError: 'Failed to fetch spending breakdown' }
  );
}

function upsertBudgetRuleRequest(
  client: HttpClient,
  category: string,
  weeklyLimit?: number,
  monthlyLimit?: number,
  annualLimit?: number,
  budgetPeriod?: 'weekly' | 'monthly' | 'annual'
): Promise<BudgetRule> {
  return client.requestJson<BudgetRule>(
    '/budgets',
    jsonRequestInit(
      'POST',
      {
        category,
        weekly_limit: weeklyLimit,
        monthly_limit: monthlyLimit,
        annual_limit: annualLimit,
        budget_period: budgetPeriod,
        is_active: true,
      },
      'Failed to save budget rule'
    )
  );
}

function fetchTagSpendingSummaryRequest(
  client: HttpClient,
  period: PeriodType = 'all',
  startDate?: string,
  endDate?: string
): Promise<TagSpendingSummaryResponse> {
  const params = new URLSearchParams();
  appendPeriodParams(params, period, startDate, endDate);
  return client.requestJson<TagSpendingSummaryResponse>(
    `/transactions/summary/tags?${params.toString()}`,
    { fallbackError: 'Failed to fetch tag spending summary' }
  );
}

function createRunwayAnalytics(client: HttpClient) {
  return {
    fetchRunway: (annualReturn = 0.05) =>
      client.requestJson<RunwayData>(`/runway?annual_return=${annualReturn}`, {
        fallbackError: 'Failed to fetch runway metrics',
      }),
    simulateScenario: (params: {
      weekly_burn_adjustment: number;
      custom_annual_return?: number;
      lump_sum_adjustment?: number;
      pay_off_loans?: boolean;
    }) =>
      client.requestJson<RunwayScenarioResult>(
        '/runway/simulate',
        jsonRequestInit('POST', params, 'Scenario simulation failed')
      ),
    synthesizeRunway: (params: {
      weekly_burn_adjustment?: number;
      custom_annual_return?: number;
      lump_sum_adjustment?: number;
      custom_context?: string;
    }) =>
      client.requestJson<RunwayAiSynthesisResult>(
        '/runway/synthesize',
        jsonRequestInit('POST', params, 'AI runway synthesis failed')
      ),
  };
}

function createBudgetAnalytics(client: HttpClient) {
  return {
    fetchSpendingBreakdown: (
      period: PeriodType = 'month',
      startDate?: string,
      endDate?: string,
      groupBy: 'leaf' | 'base' = 'leaf'
    ) => fetchSpendingBreakdownRequest(client, period, startDate, endDate, groupBy),
    fetchBudgetRules: () =>
      client.requestJson<BudgetRule[]>('/budgets', {
        fallbackError: 'Failed to fetch budget rules',
      }),
    upsertBudgetRule: (
      category: string,
      weeklyLimit?: number,
      monthlyLimit?: number,
      annualLimit?: number,
      budgetPeriod?: 'weekly' | 'monthly' | 'annual'
    ) =>
      upsertBudgetRuleRequest(
        client,
        category,
        weeklyLimit,
        monthlyLimit,
        annualLimit,
        budgetPeriod
      ),
    deleteBudgetRule: (id: number) =>
      client.requestVoid(`/budgets/${id}`, {
        method: 'DELETE',
        fallbackError: 'Failed to delete budget rule',
      }),
    initDefaultBudgets: () =>
      client.requestJson<BudgetRule[]>('/budgets/init-defaults', {
        method: 'POST',
        fallbackError: 'Failed to initialize default budgets',
      }),
    fetchAverageBurn: (lookbackWeeks = 12) =>
      client.requestJson<AverageBurnReportResponse>(
        `/budgets/average-burn?lookback_weeks=${lookbackWeeks}`,
        { fallbackError: 'Failed to fetch average weekly burn' }
      ),
    syncBudgetsFromBurn: (lookbackWeeks = 12) =>
      client.requestJson<BudgetRule[]>(
        `/budgets/sync-from-burn?lookback_weeks=${lookbackWeeks}`,
        {
          method: 'POST',
          fallbackError: 'Failed to calculate budgets from average burn',
        }
      ),
    fetchTagSpendingSummary: (
      period: PeriodType = 'all',
      startDate?: string,
      endDate?: string
    ) => fetchTagSpendingSummaryRequest(client, period, startDate, endDate),
  };
}

export function createAnalyticsTransport(client: HttpClient) {
  return {
    ...createRunwayAnalytics(client),
    ...createBudgetAnalytics(client),
  };
}
