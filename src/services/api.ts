import { authFetch } from '@yggdrasil-lab/ui';
import { Account, RunwayAiSynthesisResult, RunwayData, RunwayScenarioResult, StatementParseResult } from '../types';

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
  institution = 'Unknown',
  commit = false,
  accountId?: number
): Promise<StatementParseResult> {
  const formData = new FormData();
  formData.append('file', file);

  let url = `${API_BASE}/integrations/statement?institution=${encodeURIComponent(institution)}&commit=${commit}`;
  if (accountId) {
    url += `&account_id=${accountId}`;
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
