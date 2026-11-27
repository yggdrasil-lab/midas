import { describe, expect, it } from 'vitest';
import { Account, AssetSnapshot } from '../types';
import {
  buildCreditBackstopSummary,
  computeAccountCreditMetrics,
  getCreditSeverityBadgeVariant,
  getCreditUtilizationSeverity,
} from './creditBackstop';

function makeAccount(overrides: Partial<Account> = {}): Account {
  return {
    id: 1,
    name: 'NZ Synthetic Visa',
    account_type: 'credit_card',
    tier: 'cash',
    institution: 'North Bank',
    currency: 'NZD',
    expected_annual_return: 0,
    is_active: true,
    ...overrides,
  };
}

function makeSnapshot(overrides: Partial<AssetSnapshot> = {}): AssetSnapshot {
  return {
    id: 10,
    snapshot_date: '2026-11-20',
    account_id: 1,
    balance: -1500,
    currency: 'NZD',
    exchange_rate: 1,
    balance_nzd: -1500,
    source: 'manual',
    ...overrides,
  };
}

describe('creditBackstop helper', () => {
  it('maps utilization percentages to severity thresholds (<30, 30-70, >=70)', () => {
    expect(getCreditUtilizationSeverity(null)).toBe('emerald');
    expect(getCreditUtilizationSeverity(0)).toBe('emerald');
    expect(getCreditUtilizationSeverity(29.99)).toBe('emerald');
    expect(getCreditUtilizationSeverity(30)).toBe('amber');
    expect(getCreditUtilizationSeverity(69.99)).toBe('amber');
    expect(getCreditUtilizationSeverity(70)).toBe('rose');
    expect(getCreditUtilizationSeverity(110)).toBe('rose');

    expect(getCreditSeverityBadgeVariant('emerald')).toBe('success');
    expect(getCreditSeverityBadgeVariant('amber')).toBe('warning');
    expect(getCreditSeverityBadgeVariant('rose')).toBe('error');
  });

  it('prefers server-computed credit fields when snapshot balance matches', () => {
    const account = makeAccount({
      id: 9,
      name: 'SG Synthetic Cashline',
      account_type: 'credit_line',
      currency: 'SGD',
      credit_limit: 10000,
      credit_limit_nzd: 12900,
      credit_owed_native: 4500,
      credit_owed_nzd: 5805,
      available_credit_native: 5500,
      available_credit_nzd: 7095,
      credit_utilization_pct: 45,
    });
    const snap = makeSnapshot({
      account_id: 9,
      balance: -4500,
      currency: 'SGD',
      exchange_rate: 1.29,
      balance_nzd: -5805,
    });

    const metrics = computeAccountCreditMetrics(account, snap);
    expect(metrics.hasLimit).toBe(true);
    expect(metrics.isCreditLine).toBe(true);
    expect(metrics.limitNative).toBe(10000);
    expect(metrics.limitNzd).toBe(12900);
    expect(metrics.owedNative).toBe(4500);
    expect(metrics.owedNzd).toBe(5805);
    expect(metrics.availableNative).toBe(5500);
    expect(metrics.availableNzd).toBe(7095);
    expect(metrics.utilizationPct).toBe(45);
    expect(metrics.severity).toBe('amber');
  });

  it('computes fallback metrics when server fields are absent or snapshot is fresher', () => {
    const account = makeAccount({
      credit_limit: 10000,
      credit_limit_nzd: 10000,
      credit_owed_native: 1500,
      credit_owed_nzd: 1500,
      available_credit_native: 8500,
      available_credit_nzd: 8500,
      credit_utilization_pct: 15,
    });
    const fresherSnap = makeSnapshot({
      balance: -7500,
      balance_nzd: -7500,
    });

    const metrics = computeAccountCreditMetrics(account, fresherSnap);
    expect(metrics.owedNative).toBe(7500);
    expect(metrics.availableNative).toBe(2500);
    expect(metrics.utilizationPct).toBe(75);
    expect(metrics.severity).toBe('rose');
  });

  it('handles CR positive overpayment and over-limit clamping in fallback mode', () => {
    const crCard = makeAccount({ credit_limit: 5000 });
    const overpaid = computeAccountCreditMetrics(
      crCard,
      makeSnapshot({ balance: 300, balance_nzd: 300 })
    );
    expect(overpaid.owedNative).toBe(0);
    expect(overpaid.availableNative).toBe(5000);
    expect(overpaid.utilizationPct).toBe(0);

    const overLimit = computeAccountCreditMetrics(
      crCard,
      makeSnapshot({ balance: -5500, balance_nzd: -5500 })
    );
    expect(overLimit.owedNative).toBe(5500);
    expect(overLimit.availableNative).toBe(0);
    expect(overLimit.utilizationPct).toBe(110);
    expect(overLimit.isOverLimit).toBe(true);
    expect(overLimit.severity).toBe('rose');
  });

  it('handles unconfigured credit account without limit and aggregates active accounts', () => {
    const checking = makeAccount({ id: 1, name: 'Checking', account_type: 'checking' });
    const inactiveCard = makeAccount({ id: 2, is_active: false, credit_limit: 5000 });
    const unconfiguredCard = makeAccount({ id: 3, name: 'Unconfigured Card', credit_limit: null });
    const configuredLine = makeAccount({
      id: 4,
      name: 'SG Synthetic Cashline',
      account_type: 'credit_line',
      currency: 'SGD',
      credit_limit: 10000,
      credit_limit_nzd: 12900,
      credit_owed_native: 2000,
      credit_owed_nzd: 2580,
      available_credit_native: 8000,
      available_credit_nzd: 10320,
      credit_utilization_pct: 20,
    });

    const summary = buildCreditBackstopSummary(
      [checking, inactiveCard, unconfiguredCard, configuredLine],
      {
        3: [makeSnapshot({ account_id: 3, balance: -420, balance_nzd: -420 })],
        4: [makeSnapshot({ account_id: 4, balance: -2000, currency: 'SGD', exchange_rate: 1.29, balance_nzd: -2580 })],
      }
    );

    expect(summary.revolvingAccounts).toHaveLength(2);
    expect(summary.configuredCount).toBe(1);
    expect(summary.totalLimitNzd).toBe(12900);
    expect(summary.totalOwedNzd).toBe(3000);
    expect(summary.totalAvailableNzd).toBe(10320);
    expect(summary.utilizationPct).toBe(23.26);
    expect(summary.severity).toBe('emerald');
  });
});
