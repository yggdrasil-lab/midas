import { authFetch } from '@yggdrasil-lab/ui';
import {
  Account,
  BudgetRule,
  InstitutionInfo,
  RunwayAiSynthesisResult,
  RunwayData,
  RunwayScenarioResult,
  SpendingBreakdownResponse,
  StatementParseResult,
} from '../types';

const API_BASE = '/api';

export async function fetchRunway(annualReturn = 0.05): Promise<RunwayData> {
  const res = await authFetch(`${API_BASE}/runway?annual_return=${annualReturn}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch runway metrics: ${res.statusText}`);
  }
  return res.json();
}

export async function simulateScenario(params: {
  weekly_burn_adjustment: number;
  custom_annual_return?: number;
  lump_sum_adjustment?: number;
}): Promise<RunwayScenarioResult> {
  const res = await authFetch(`${API_BASE}/runway/simulate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    throw new Error(`Scenario simulation failed: ${res.statusText}`);
  }
  return res.json();
}

export async function synthesizeRunway(params: {
  weekly_burn_adjustment?: number;
  custom_annual_return?: number;
  lump_sum_adjustment?: number;
  custom_context?: string;
}): Promise<RunwayAiSynthesisResult> {
  const res = await authFetch(`${API_BASE}/runway/synthesize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    throw new Error(`AI runway synthesis failed: ${res.statusText}`);
  }
  return res.json();
}

export async function quickLogExpense(payload: {
  amount: number;
  merchant: string;
  category?: string;
  notes?: string;
}) {
  const res = await authFetch(`${API_BASE}/integrations/quick-log`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(`Quick-log failed: ${res.statusText}`);
  }
  return res.json();
}

export async function uploadStatement(
  file: File,
  institution = 'auto',
  commit = false,
  accountId?: number,
  closingBalance?: number,
  tier?: string,
  accountType?: string,
  accountName?: string
): Promise<StatementParseResult> {
  const formData = new FormData();
  formData.append('file', file);

  let url = `${API_BASE}/integrations/statement?institution=${encodeURIComponent(institution)}&commit=${commit}`;
  if (accountId) {
    url += `&account_id=${accountId}`;
  }
  if (closingBalance !== undefined && !isNaN(closingBalance)) {
    url += `&closing_balance=${closingBalance}`;
  }
  if (tier) {
    url += `&tier=${encodeURIComponent(tier)}`;
  }
  if (accountType) {
    url += `&account_type=${encodeURIComponent(accountType)}`;
  }
  if (accountName) {
    url += `&account_name=${encodeURIComponent(accountName)}`;
  }

  const res = await authFetch(url, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    throw new Error(`Statement upload failed: ${res.statusText}`);
  }
  return res.json();
}

export async function fetchInstitutions(): Promise<InstitutionInfo[]> {
  try {
    const res = await authFetch(`${API_BASE}/institutions`);
    if (res.ok) {
      return res.json();
    }
  } catch (err) {
    console.warn('Could not fetch institutions from API, using defaults:', err);
  }
  return [
    { name: 'ASB', default_tier: 'cash', default_type: 'checking', currency: 'NZD' },
    { name: 'ANZ', default_tier: 'cash', default_type: 'checking', currency: 'NZD' },
    { name: 'BNZ', default_tier: 'cash', default_type: 'checking', currency: 'NZD' },
    { name: 'Westpac', default_tier: 'cash', default_type: 'checking', currency: 'NZD' },
    { name: 'Kiwibank', default_tier: 'cash', default_type: 'checking', currency: 'NZD' },
    { name: 'Rabobank', default_tier: 'cash', default_type: 'savings', currency: 'NZD' },
    { name: 'TSB', default_tier: 'cash', default_type: 'checking', currency: 'NZD' },
    { name: 'Sharesies', default_tier: 'growth', default_type: 'brokerage', currency: 'NZD' },
    { name: 'Hatch', default_tier: 'growth', default_type: 'brokerage', currency: 'NZD' },
    { name: 'Kernel', default_tier: 'growth', default_type: 'brokerage', currency: 'NZD' },
    { name: 'Milford', default_tier: 'growth', default_type: 'brokerage', currency: 'NZD' },
    { name: 'InvestNow', default_tier: 'growth', default_type: 'brokerage', currency: 'NZD' },
    { name: 'Interactive Brokers', default_tier: 'growth', default_type: 'brokerage', currency: 'NZD' },
    { name: 'Simplicity', default_tier: 'locked', default_type: 'kiwisaver', currency: 'NZD' },
  ];
}

export async function fetchSampleStatement(institution = 'ASB'): Promise<string> {
  const res = await authFetch(`${API_BASE}/integrations/sample-statement?institution=${encodeURIComponent(institution)}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch sample statement: ${res.statusText}`);
  }
  return res.text();
}

export async function fetchAccounts(): Promise<Account[]> {
  const res = await authFetch(`${API_BASE}/accounts`);
  if (!res.ok) {
    throw new Error(`Failed to fetch accounts: ${res.statusText}`);
  }
  return res.json();
}

export async function seedTestData(): Promise<{
  status: string;
  message: string;
  cash_balance: number;
  growth_balance: number;
  locked_balance: number;
  total_liquid: number;
}> {
  const res = await authFetch(`${API_BASE}/admin/seed`, {
    method: 'POST',
  });
  if (!res.ok) {
    throw new Error(`Failed to seed test data: ${res.statusText}`);
  }
  return res.json();
}

export async function resetDatabase(clearAccounts = false): Promise<{
  status: string;
  message: string;
  cleared_transactions: number;
  cleared_snapshots: number;
  cleared_accounts: number;
}> {
  const res = await authFetch(`${API_BASE}/admin/reset?clear_accounts=${clearAccounts}`, {
    method: 'POST',
  });
  if (!res.ok) {
    throw new Error(`Failed to reset data: ${res.statusText}`);
  }
  return res.json();
}

export async function fetchSpendingBreakdown(period = 'month'): Promise<SpendingBreakdownResponse> {
  const res = await authFetch(`${API_BASE}/budgets/breakdown?period=${encodeURIComponent(period)}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch spending breakdown: ${res.statusText}`);
  }
  return res.json();
}

export async function fetchBudgetRules(): Promise<BudgetRule[]> {
  const res = await authFetch(`${API_BASE}/budgets`);
  if (!res.ok) {
    throw new Error(`Failed to fetch budget rules: ${res.statusText}`);
  }
  return res.json();
}

export async function upsertBudgetRule(
  category: string,
  weeklyLimit?: number,
  monthlyLimit?: number
): Promise<BudgetRule> {
  const res = await authFetch(`${API_BASE}/budgets`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      category,
      weekly_limit: weeklyLimit,
      monthly_limit: monthlyLimit,
      is_active: true,
    }),
  });
  if (!res.ok) {
    throw new Error(`Failed to save budget rule: ${res.statusText}`);
  }
  return res.json();
}

export async function deleteBudgetRule(id: number): Promise<void> {
  const res = await authFetch(`${API_BASE}/budgets/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    throw new Error(`Failed to delete budget rule: ${res.statusText}`);
  }
}

export async function initDefaultBudgets(): Promise<BudgetRule[]> {
  const res = await authFetch(`${API_BASE}/budgets/init-defaults`, {
    method: 'POST',
  });
  if (!res.ok) {
    throw new Error(`Failed to initialize default budgets: ${res.statusText}`);
  }
  return res.json();
}
