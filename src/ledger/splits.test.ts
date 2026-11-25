import { describe, expect, it } from 'vitest';
import { LoanItem, Transaction } from '../types';
import {
  applyAutoRemainder,
  areLegacyPositiveOutflowSplits,
  buildSplitPayload,
  computeSplitAllocation,
  createInitialSplitRows,
  getFilteredLoans,
  getSplitPrecision,
  hasValidSplitLines,
  isDebtLoansCategory,
  parseRuleTagsCsv,
  parseSignedAmountInput,
  parseTagsCsv,
  resolveLoanIdForSign,
  resolveParentTransactionAmount,
  roundToDecimals,
  SplitDraftRow,
} from './index';

function makeTx(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 1,
    transaction_date: '2026-11-12',
    account_id: 1001,
    amount: -100,
    currency: 'NZD',
    merchant: 'Alex Market',
    category: 'Groceries',
    ...overrides,
  };
}

function makeLoan(overrides: Partial<LoanItem> = {}): LoanItem {
  return {
    id: 10,
    name: 'Car Loan',
    lender: 'Main Bank',
    loan_type: 'borrowed',
    principal_amount: 10000,
    annual_interest_rate: 6.5,
    term_months: 36,
    monthly_payment: 300,
    start_date: '2026-01-01',
    currency: 'NZD',
    is_active: true,
    payments_made: 5,
    payments_remaining: 31,
    remaining_principal: 8500,
    principal_paid: 1500,
    remaining_interest: 900,
    weekly_payment_equivalent: 70,
    net_worth_impact: -8500,
    ...overrides,
  };
}

describe('getSplitPrecision & roundToDecimals', () => {
  it('returns 8 decimals and 1e-8 tolerance for crypto currencies', () => {
    expect(getSplitPrecision('BTC')).toEqual({ decimals: 8, tolerance: 1e-8 });
    expect(getSplitPrecision('eth')).toEqual({ decimals: 8, tolerance: 1e-8 });
    expect(getSplitPrecision('SOL')).toEqual({ decimals: 8, tolerance: 1e-8 });
  });

  it('returns 2 decimals and 0.01 tolerance for fiat or missing currencies', () => {
    expect(getSplitPrecision('NZD')).toEqual({ decimals: 2, tolerance: 0.01 });
    expect(getSplitPrecision('USD')).toEqual({ decimals: 2, tolerance: 0.01 });
    expect(getSplitPrecision(undefined)).toEqual({ decimals: 2, tolerance: 0.01 });
  });

  it('rounds values to requested decimal places', () => {
    expect(roundToDecimals(10.125, 2)).toBe(10.13);
    expect(roundToDecimals(0.123456789, 8)).toBe(0.12345679);
  });
});

describe('legacy split detection and parent amount resolution', () => {
  it('detects legacy positive outflow splits matching abs parent amount', () => {
    const legacyTx = makeTx({
      amount: -100,
      is_split: true,
      splits: [
        { id: 1, transaction_id: 1, amount: 60, category: 'Groceries', tags: [] },
        { id: 2, transaction_id: 1, amount: 40, category: 'Dining', tags: [] },
      ],
    });
    expect(hasValidSplitLines(legacyTx)).toBe(true);
    expect(areLegacyPositiveOutflowSplits(legacyTx)).toBe(true);
    expect(resolveParentTransactionAmount(legacyTx, 2)).toBe(-100);
  });

  it('reconstructs true signed parent amount from full splits when tx.amount is sliced', () => {
    const slicedTx = makeTx({
      amount: -40,
      is_split: true,
      splits: [
        { id: 1, transaction_id: 1, amount: -60, category: 'Groceries', tags: [] },
        { id: 2, transaction_id: 1, amount: -40, category: 'Dining', tags: [] },
      ],
    });
    expect(areLegacyPositiveOutflowSplits(slicedTx)).toBe(false);
    expect(resolveParentTransactionAmount(slicedTx, 2)).toBe(-100);
  });

  it('supports crypto precision when reconstructing signed netted parent amounts', () => {
    const cryptoTx = makeTx({
      currency: 'BTC',
      amount: -0.005,
      is_split: true,
      splits: [
        { id: 1, transaction_id: 1, amount: -0.0075, category: 'Trading', tags: [] },
        { id: 2, transaction_id: 1, amount: 0.0025, category: 'Rebates', tags: [] },
      ],
    });
    expect(resolveParentTransactionAmount(cryptoTx, 8)).toBe(-0.005);
  });

  it('returns raw tx amount when transaction is not validly split', () => {
    const plainTx = makeTx({ amount: -42.5, is_split: false, splits: [] });
    expect(hasValidSplitLines(plainTx)).toBe(false);
    expect(resolveParentTransactionAmount(plainTx, 2)).toBe(-42.5);
  });
});

describe('createInitialSplitRows & isDebtLoansCategory', () => {
  it('identifies Debt & Loans category case-insensitively', () => {
    expect(isDebtLoansCategory('Debt & Loans')).toBe(true);
    expect(isDebtLoansCategory('  debt & loans ')).toBe(true);
    expect(isDebtLoansCategory('Groceries')).toBe(false);
  });

  it('creates two blank draft rows inheriting loanId only for Debt & Loans', () => {
    const debtTx = makeTx({ amount: -250, category: 'Debt & Loans', loan_id: 7 });
    const rows = createInitialSplitRows(debtTx, 'General', 2);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({
      sign: -1,
      amount: '',
      category: 'Debt & Loans',
      loanId: '7',
      notes: '',
      tagsText: '',
    });
    expect(rows[1].loanId).toBe('');

    const nonDebtTx = makeTx({ amount: 500, category: 'Income', loan_id: 7 });
    const inflowRows = createInitialSplitRows(nonDebtTx, 'General', 2);
    expect(inflowRows[0].sign).toBe(1);
    expect(inflowRows[0].loanId).toBe('');
  });

  it('normalizes legacy positive outflow splits into negative draft rows', () => {
    const legacyTx = makeTx({
      amount: -100,
      is_split: true,
      splits: [
        { id: 1, transaction_id: 1, amount: 75, category: 'Groceries', tags: ['food'], notes: 'Main' },
        { id: 2, transaction_id: 1, amount: 25, category: 'Dining', tags: ['coffee', 'lunch'] },
      ],
    });
    const rows = createInitialSplitRows(legacyTx, 'General', 2);
    expect(rows[0]).toMatchObject({ sign: -1, amount: '75.00', category: 'Groceries', tagsText: 'food', notes: 'Main' });
    expect(rows[1]).toMatchObject({ sign: -1, amount: '25.00', category: 'Dining', tagsText: 'coffee, lunch' });
  });
});

describe('computeSplitAllocation & applyAutoRemainder', () => {
  const baseRow = (overrides: Partial<SplitDraftRow> = {}): SplitDraftRow => ({
    sign: -1,
    amount: '',
    category: 'Groceries',
    loanId: '',
    notes: '',
    tagsText: '',
    ...overrides,
  });

  it('validates signed-netted balancing for fiat tolerance (0.01) and crypto tolerance (1e-8)', () => {
    const fiatRows = [
      baseRow({ sign: -1, amount: '120.00' }),
      baseRow({ sign: 1, amount: '20.00', category: 'Rebates' }),
    ];
    const fiatResult = computeSplitAllocation(fiatRows, -100, getSplitPrecision('NZD'));
    expect(fiatResult.allocatedSum).toBe(-100);
    expect(fiatResult.remaining).toBe(0);
    expect(fiatResult.isBalanced).toBe(true);
    expect(fiatResult.isReadyToSave).toBe(true);

    const cryptoRows = [
      baseRow({ sign: -1, amount: '0.00500001' }),
      baseRow({ sign: -1, amount: '0.00499999' }),
    ];
    const cryptoUnbalanced = computeSplitAllocation(
      [baseRow({ sign: -1, amount: '0.00500000' }), baseRow({ sign: -1, amount: '0.00499990' })],
      -0.01,
      getSplitPrecision('BTC')
    );
    expect(cryptoUnbalanced.isBalanced).toBe(false);
    expect(computeSplitAllocation(cryptoRows, -0.01, getSplitPrecision('BTC')).isReadyToSave).toBe(true);
  });

  it('auto-populates Row 2 remainder including sign flip when Row 1 exceeds parent outflow', () => {
    const borrowedLoan = makeLoan({ id: 10, loan_type: 'borrowed' });
    const rows = [
      baseRow({ sign: -1, amount: '150' }),
      baseRow({ sign: -1, amount: '', category: 'Debt & Loans', loanId: '10' }),
    ];
    const next = applyAutoRemainder(rows, {
      txAmount: -100,
      decimals: 2,
      defaultSign: -1,
      row2ManuallyEdited: false,
      loans: [borrowedLoan],
    });
    expect(next[1].sign).toBe(1);
    expect(next[1].amount).toBe('50.00');
    expect(next[1].loanId).toBe('');
  });

  it('skips auto-remainder when Row 2 was manually edited or row count != 2', () => {
    const rows = [baseRow({ sign: -1, amount: '60' }), baseRow({ sign: -1, amount: '10' })];
    const untouched = applyAutoRemainder(rows, {
      txAmount: -100,
      decimals: 2,
      defaultSign: -1,
      row2ManuallyEdited: true,
      loans: [],
    });
    expect(untouched[1].amount).toBe('10');
  });
});

describe('loans filtering, signed input parsing, and payload building', () => {
  it('filters loans by active state and sign direction', () => {
    const borrowed = makeLoan({ id: 1, loan_type: 'borrowed', is_active: true });
    const lent = makeLoan({ id: 2, loan_type: 'lent', is_active: true });
    const inactiveLent = makeLoan({ id: 3, loan_type: 'lent', is_active: false });

    expect(getFilteredLoans([borrowed, lent, inactiveLent], -1, '').map((l) => l.id)).toEqual([1, 2]);
    expect(getFilteredLoans([borrowed, lent, inactiveLent], 1, '').map((l) => l.id)).toEqual([2]);
    expect(getFilteredLoans([borrowed, lent, inactiveLent], 1, '3').map((l) => l.id)).toEqual([2, 3]);

    expect(resolveLoanIdForSign([borrowed, lent], 1, '1')).toBe('');
    expect(resolveLoanIdForSign([borrowed, lent], 1, '2')).toBe('2');
    expect(resolveLoanIdForSign([borrowed, lent], -1, '1')).toBe('1');
  });

  it('parses signed decimal input and rejects non-numeric text', () => {
    expect(parseSignedAmountInput('-45.50')).toEqual({ explicitSign: -1, cleanAmount: '45.50' });
    expect(parseSignedAmountInput('+12')).toEqual({ explicitSign: 1, cleanAmount: '12' });
    expect(parseSignedAmountInput('99.25')).toEqual({ explicitSign: null, cleanAmount: '99.25' });
    expect(parseSignedAmountInput('12abc')).toBeNull();
  });

  it('builds split payloads with rounded amounts, parsed CSV tags, and debt-gated loan IDs', () => {
    const payload = buildSplitPayload(
      [
        {
          sign: -1,
          amount: '60.126',
          category: 'Debt & Loans',
          loanId: '10',
          notes: '  Principal  ',
          tagsText: '#Auto, auto, Monthly',
        },
        {
          sign: -1,
          amount: '39.874',
          category: 'Groceries',
          loanId: '10',
          notes: '   ',
          tagsText: 'food',
        },
      ],
      2
    );
    expect(payload).toEqual([
      {
        amount: -60.13,
        category: 'Debt & Loans',
        tags: ['Auto', 'Monthly'],
        loan_id: 10,
        notes: 'Principal',
      },
      {
        amount: -39.87,
        category: 'Groceries',
        tags: ['food'],
        loan_id: null,
        notes: null,
      },
    ]);
  });
});

describe('CSV tag parsing', () => {
  it('parseTagsCsv preserves casing, strips leading #, and dedupes case-insensitively', () => {
    expect(parseTagsCsv('#Family, family, Dinner , , #Trip-2026')).toEqual([
      'Family',
      'Dinner',
      'Trip-2026',
    ]);
  });

  it('parseRuleTagsCsv lowercases, collapses spaces to hyphens, strips #, and dedupes', () => {
    expect(parseRuleTagsCsv('#Date Night, date   night, URGENT, ')).toEqual([
      'date-night',
      'urgent',
    ]);
  });
});
