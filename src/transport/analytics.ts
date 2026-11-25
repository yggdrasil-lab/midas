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

export function createAnalyticsTransport(client: HttpClient) {
  return {
    fetchRunway(annualReturn = 0.05): Promise<RunwayData> {
      return client.requestJson<RunwayData>(`/runway?annual_return=${annualReturn}`, {
        fallbackError: 'Failed to fetch runway metrics',
      });
    },

    simulateScenario(params: {
      weekly_burn_adjustment: number;
      custom_annual_return?: number;
      lump_sum_adjustment?: number;
      pay_off_loans?: boolean;
    }): Promise<RunwayScenarioResult> {
      return client.requestJson<RunwayScenarioResult>(
        '/runway/simulate',
        jsonRequestInit('POST', params, 'Scenario simulation failed')
      );
    },

    synthesizeRunway(params: {
      weekly_burn_adjustment?: number;
      custom_annual_return?: number;
      lump_sum_adjustment?: number;
      custom_context?: string;
    }): Promise<RunwayAiSynthesisResult> {
      return client.requestJson<RunwayAiSynthesisResult>(
        '/runway/synthesize',
        jsonRequestInit('POST', params, 'AI runway synthesis failed')
      );
    },

    fetchSpendingBreakdown(
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
    },

    fetchBudgetRules(): Promise<BudgetRule[]> {
      return client.requestJson<BudgetRule[]>('/budgets', {
        fallbackError: 'Failed to fetch budget rules',
      });
    },

    upsertBudgetRule(
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
    },

    deleteBudgetRule(id: number): Promise<void> {
      return client.requestVoid(`/budgets/${id}`, {
        method: 'DELETE',
        fallbackError: 'Failed to delete budget rule',
      });
    },

    initDefaultBudgets(): Promise<BudgetRule[]> {
      return client.requestJson<BudgetRule[]>('/budgets/init-defaults', {
        method: 'POST',
        fallbackError: 'Failed to initialize default budgets',
      });
    },

    fetchAverageBurn(lookbackWeeks = 12): Promise<AverageBurnReportResponse> {
      return client.requestJson<AverageBurnReportResponse>(
        `/budgets/average-burn?lookback_weeks=${lookbackWeeks}`,
        { fallbackError: 'Failed to fetch average weekly burn' }
      );
    },

    syncBudgetsFromBurn(lookbackWeeks = 12): Promise<BudgetRule[]> {
      return client.requestJson<BudgetRule[]>(
        `/budgets/sync-from-burn?lookback_weeks=${lookbackWeeks}`,
        {
          method: 'POST',
          fallbackError: 'Failed to calculate budgets from average burn',
        }
      );
    },

    fetchTagSpendingSummary(
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
    },
  };
}
