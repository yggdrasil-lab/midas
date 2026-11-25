import { describe, expect, it } from 'vitest';
import { Account, SpendingBreakdownResponse, Transaction } from '../types';
import {
  computeAccountCashflow,
  computeCashflowSummary,
  computeTagStats,
  deriveAnnualizedCategories,
  deriveInflowCategoryChips,
  deriveOutflowCategoryChips,
  getAnnualizedPeriodShare,
  mergeCashflowRegularRows,
  partitionCashflowTransactions,
} from './index';

function makeTx(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 1,
    transaction_date: '2026-11-12',
    account_id: 1001,
    amount: -50,
    currency: 'NZD',
    merchant: 'Alex Corner Store',
    category: 'Groceries',
    ...overrides,
  };
}

const SAMPLE_BREAKDOWN: SpendingBreakdownResponse = {
  period: 'month',
  total_spend: 750,
  total_income: 3200,
  total_transfers: 600,
  net_savings: 2450,
  over_budget_count: 0,
  categories: [
    {
      category: 'Groceries',
      total_spend: 350,
      transaction_count: 4,
      percentage: 46.7,
      is_over_budget: false,
      warning_level: 'normal',
      is_transfer: false,
      budget_period: 'monthly',
    },
    {
      category: 'Travel',
      total_spend: 1200,
      transaction_count: 2,
      percentage: 14.5,
      is_over_budget: false,
      warning_level: 'normal',
      is_transfer: false,
      budget_period: 'annual',
    },
    {
      category: 'Transfers',
      total_spend: 600,
      transaction_count: 2,
      percentage: 0,
      is_over_budget: false,
      warning_level: 'normal',
      is_transfer: true,
    },
  ],
};

describe('cashflow partitioning, pagination merge, and summaries', () => {
  it('partitions actual, amortized commitments, and excluded transactions', () => {
    const actual = makeTx({ id: 1, amount: -85 });
    const amortized = makeTx({
      id: 2,
      is_amortized_commitment: true,
      amortized_period_amount_nzd: 36.99,
      excluded_from_period_budget: true,
    });
    const excluded = makeTx({ id: 3, amount: -200, excluded_from_period_budget: true });

    const partition = partitionCashflowTransactions([actual, amortized, excluded]);
    expect(partition.actualTransactions.map((t) => t.id)).toEqual([1]);
    expect(partition.amortizedCommitments.map((t) => t.id)).toEqual([2]);
    expect(partition.excludedTransactions.map((t) => t.id)).toEqual([3]);
  });

  it('merges regular cashflow pages without duplicating rows or re-adding amortized items', () => {
    const page1 = [
      makeTx({ id: 10, amount: -30 }),
      makeTx({ id: 11, is_amortized_commitment: true, amortized_period_amount_nzd: 20 }),
    ];
    const page2 = [
      makeTx({ id: 10, amount: -30 }),
      makeTx({ id: 12, amount: -45 }),
      makeTx({ id: 11, is_amortized_commitment: true, amortized_period_amount_nzd: 20 }),
    ];

    const merged = mergeCashflowRegularRows(page1, page2);
    expect(merged.map((t) => t.id)).toEqual([10, 12]);
  });

  it('derives category chips, annualized categories, and outflow Fixed + 52w summary', () => {
    expect(deriveOutflowCategoryChips(SAMPLE_BREAKDOWN)).toEqual(['Groceries']);
    expect(deriveAnnualizedCategories(SAMPLE_BREAKDOWN).map((c) => c.category)).toEqual(['Travel']);
    expect(getAnnualizedPeriodShare(1200, false)).toBe(100);
    expect(getAnnualizedPeriodShare(520, true)).toBe(10);

    const inflowChips = deriveInflowCategoryChips([
      makeTx({ id: 1, amount: 200, category: 'Dividends' }),
      makeTx({ id: 2, amount: 3000, category: 'Income' }),
      makeTx({ id: 3, amount: 100, category: 'Excluded', excluded_from_period_budget: true }),
    ]);
    expect(inflowChips).toEqual(['Income', 'Dividends']);

    const partition = partitionCashflowTransactions([
      makeTx({ id: 10, amount: -85 }),
      makeTx({ id: 11, is_amortized_commitment: true, amortized_period_amount_nzd: 36.99 }),
    ]);
    const summary = computeCashflowSummary({
      activeFlow: 'outflow',
      period: 'month',
      selectedCategory: 'ALL',
      totalCount: 1,
      breakdown: SAMPLE_BREAKDOWN,
      partition,
      annualizedCategories: deriveAnnualizedCategories(SAMPLE_BREAKDOWN),
    });

    expect(summary.headlineTotal).toBe(750);
    expect(summary.thirdMetricLabel).toBe('Fixed + 52w');
    expect(summary.thirdMetricValue).toBeCloseTo(136.99, 2);
    expect(summary.itemSubvalue).toBe('+ 1 fixed');
  });

  it('computes account cashflow and tag breakdown summaries cleanly', () => {
    const account: Account = {
      id: 1001,
      name: 'Main Checking',
      account_type: 'checking',
      tier: 'cash',
      institution: 'ASB',
      currency: 'NZD',
      expected_annual_return: 0,
      is_active: true,
    };
    const txs = [
      makeTx({ id: 1, account_id: 1001, amount: -100, category: 'Food' }),
      makeTx({ id: 2, account_id: 1001, amount: 500, category: 'Income' }),
      makeTx({ id: 3, account_id: 1001, amount: -250, category: 'Transfers' }),
      makeTx({ id: 4, account_id: 2002, counterpart_account_id: 1001, amount: 75, category: 'Income' }),
    ];

    expect(computeAccountCashflow(txs, account)).toEqual({
      totalSpend: 100,
      totalIncome: 500,
      totalTransfers: 250,
    });

    const tagStats = computeTagStats(false, 2, null, [
      makeTx({ id: 5, amount: -80, category: 'Dining' }),
      makeTx({ id: 6, amount: -20, category: 'Transit' }),
    ]);
    expect(tagStats.totalSpend).toBe(100);
    expect(tagStats.txCount).toBe(2);
    expect(tagStats.categories.map((c) => c.category)).toEqual(['Dining', 'Transit']);
  });
});
