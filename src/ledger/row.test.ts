import { describe, expect, it } from 'vitest';
import { Account, LoanItem, Transaction } from '../types';
import {
  buildAmortizedOriginSummary,
  buildCategoryOptions,
  deriveRowMeta,
  deriveSplitLoanEntries,
  formatFxRateLabel,
  formatRecurrenceLabel,
  getSelectableCounterparts,
} from './index';

function makeTx(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 1,
    transaction_date: '2026-11-12',
    account_id: 1001,
    account_name: 'Checking',
    amount: -120,
    currency: 'NZD',
    merchant: 'Alex Hardware',
    category: 'Home',
    ...overrides,
  };
}

function makeLoan(overrides: Partial<LoanItem> = {}): LoanItem {
  return {
    id: 5,
    name: 'Home Improvement',
    lender: 'Pacific Bank',
    loan_type: 'borrowed',
    principal_amount: 5000,
    annual_interest_rate: 7,
    term_months: 24,
    monthly_payment: 220,
    start_date: '2026-01-01',
    currency: 'NZD',
    is_active: true,
    payments_made: 3,
    payments_remaining: 21,
    remaining_principal: 4400,
    principal_paid: 600,
    remaining_interest: 320,
    weekly_payment_equivalent: 50,
    net_worth_impact: -4400,
    ...overrides,
  };
}

function makeAccount(overrides: Partial<Account> = {}): Account {
  return {
    id: 1001,
    name: 'Checking',
    account_type: 'checking',
    tier: 'cash',
    institution: 'Main Bank',
    currency: 'NZD',
    expected_annual_return: 0,
    is_active: true,
    ...overrides,
  };
}

describe('row presentation helpers', () => {
  it('prepends missing currentCategory in buildCategoryOptions without duplicating existing ones', () => {
    expect(buildCategoryOptions(['Food', 'Rent'], 'Income')).toEqual(['Income', 'Food', 'Rent']);
    expect(buildCategoryOptions(['Food', 'Rent'], 'Rent')).toEqual(['Food', 'Rent']);
    expect(buildCategoryOptions(['Food', 'Rent'], '   ')).toEqual(['Food', 'Rent']);
  });

  it('formats recurrence labels with fallback', () => {
    expect(formatRecurrenceLabel('monthly')).toBe('Monthly');
    expect(formatRecurrenceLabel('  fortnightly ')).toBe('Fortnightly');
    expect(formatRecurrenceLabel(null)).toBe('Recurring');
  });

  it('builds amortized origin summaries for NZD and foreign-currency transactions', () => {
    const nzdTx = makeTx({ recurrence: 'annual', amount: -1200, currency: 'NZD' });
    expect(buildAmortizedOriginSummary(nzdTx, 'NZD', -1200)).toBe('From $1,200.00 NZD/yr');

    const usdTx = makeTx({
      recurrence: 'monthly',
      amount: -20,
      currency: 'USD',
      exchange_rate: 1.65,
    });
    expect(buildAmortizedOriginSummary(usdTx, 'USD', -20)).toBe('From USD 20.00 ($33.00 NZD/mo)');
  });

  it('formats FX rate labels with 2dp for rates >= 100 and up to 6dp below 100', () => {
    expect(formatFxRateLabel(145.678)).toBe('145.68');
    expect(formatFxRateLabel(1.6234567)).toBe('1.623457');
  });
});

describe('deriveSplitLoanEntries, deriveRowMeta, and getSelectableCounterparts', () => {
  it('derives split loan entries using split metadata with loan list fallback', () => {
    const loans = [makeLoan({ id: 5, name: 'Home Improvement', loan_type: 'lent' })];
    const entries = deriveSplitLoanEntries(
      [
        { id: 101, signedAmount: -80, loan_id: 5 },
        { id: 102, signedAmount: -40, loan_id: null },
      ],
      loans
    );
    expect(entries).toEqual([
      {
        key: 'split-101',
        loanName: 'Home Improvement',
        loanType: 'lent',
        paymentAmount: 80,
        flowSignAmt: -80,
      },
    ]);
  });

  it('computes derived row meta for legacy splits, loan selectors, and amortized status', () => {
    const loans = [makeLoan({ id: 5 })];
    const splitTx = makeTx({
      amount: -100,
      category: 'Debt & Loans',
      is_split: true,
      splits: [
        { id: 11, transaction_id: 1, amount: 70, category: 'Debt & Loans', tags: [], loan_id: 5 },
        { id: 12, transaction_id: 1, amount: 30, category: 'Groceries', tags: [] },
      ],
    });
    const splitMeta = deriveRowMeta(splitTx, loans);
    expect(splitMeta.isSplit).toBe(true);
    expect(splitMeta.showLoanSelector).toBe(false);
    expect(splitMeta.effectiveSplits.map((s) => s.signedAmount)).toEqual([-70, -30]);
    expect(splitMeta.splitLoanEntries).toHaveLength(1);
    expect(splitMeta.parentAmt).toBe(-100);

    const debtTx = makeTx({ category: 'Debt & Loans', amount: -200 });
    const debtMeta = deriveRowMeta(debtTx, loans);
    expect(debtMeta.showLoanSelector).toBe(true);

    const amortizedTx = makeTx({
      is_amortized_commitment: true,
      amortized_period_amount_nzd: 25,
      excluded_from_period_budget: true,
    });
    const amortizedMeta = deriveRowMeta(amortizedTx, loans);
    expect(amortizedMeta.isAmortized).toBe(true);
    expect(amortizedMeta.isExcluded).toBe(false);
  });

  it('returns active counterpart accounts plus currently linked inactive account while excluding source account', () => {
    const accounts = [
      makeAccount({ id: 1001, name: 'Checking', is_active: true }),
      makeAccount({ id: 2002, name: 'Savings', is_active: true }),
      makeAccount({ id: 3003, name: 'Closed Note', is_active: false }),
      makeAccount({ id: 4004, name: 'Archived Vault', is_active: false }),
    ];
    const tx = makeTx({ account_id: 1001, counterpart_account_id: 3003 });
    expect(getSelectableCounterparts(tx, accounts).map((a) => a.id)).toEqual([2002, 3003]);
  });
});
