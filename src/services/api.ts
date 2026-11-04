import { Account, RunwayData, RunwayScenarioResult, StatementParseResult } from '../types';

const API_BASE = '/api';

export async function fetchRunway(annualReturn = 0.05): Promise<RunwayData> {
  const res = await fetch(`${API_BASE}/runway?annual_return=${annualReturn}`);
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
  const res = await fetch(`${API_BASE}/runway/simulate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    throw new Error(`Scenario simulation failed: ${res.statusText}`);
  }
  return res.json();
}

export async function quickLogExpense(payload: {
  amount: number;
  merchant: string;
  category?: string;
  notes?: string;
}) {
  const res = await fetch(`${API_BASE}/integrations/quick-log`, {
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

  const res = await fetch(url, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    throw new Error(`Statement upload failed: ${res.statusText}`);
  }
  return res.json();
}

export async function fetchAccounts(): Promise<Account[]> {
  const res = await fetch(`${API_BASE}/accounts`);
  if (!res.ok) {
    throw new Error(`Failed to fetch accounts: ${res.statusText}`);
  }
  return res.json();
}
