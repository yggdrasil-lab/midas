import { describe, expect, it } from 'vitest';
import type { LoanItem, LoanPaymentItem, RecurringCommitmentItem } from '../types';
import { filterActiveBorrowedLoans, reconcileFixedBurn } from './burnAnatomy';

function makeCommitment(
  overrides: Partial<RecurringCommitmentItem> = {}
): RecurringCommitmentItem {
  return {
    transaction_id: 501,
    merchant: 'Alex Auto',
    category: 'Debt & Loans',
    recurrence: 'monthly',
    last_charged_date: '2026-11-20',
    original_amount: 650,
    currency: 'NZD',
    amount_nzd: 650,
    weekly_nzd: 150,
    monthly_nzd: 650,
    percentage_of_recurring: 50,
    ...overrides,
  };
}

function makePayment(overrides: Partial<LoanPaymentItem> = {}): LoanPaymentItem {
  return {
    id: 501,
    transaction_date: '2026-11-20',
    amount: -650,
    currency: 'NZD',
    amount_nzd: 650,
    entry_type: 'repayment',
    merchant: 'Alex Auto',
    account_id: 1001,
    category: 'Debt & Loans',
    split_id: null,
    ...overrides,
  };
}

function makeLoan(overrides: Partial<LoanItem> = {}): LoanItem {
  return {
    id: 1,
    name: 'Compact SUV Financing',
    lender: 'Metro Finance',
    loan_type: 'borrowed',
    principal_amount: 20000,
    annual_interest_rate: 0.089,
    term_months: 36,
    monthly_payment: 650,
    start_date: '2026-10-20',
    currency: 'NZD',
    is_active: true,
    payments_made: 1,
    payments_remaining: 35,
    remaining_principal: 19400,
    principal_paid: 600,
    remaining_interest: 2500,
    weekly_payment_equivalent: 150,
    net_worth_impact: -19400,
    linked_payments: [],
    ...overrides,
  };
}

describe('filterActiveBorrowedLoans', () => {
  it('excludes lent, inactive, and zero-payment loans', () => {
    const activeBorrowed = makeLoan({ id: 1 });
    const lentLoan = makeLoan({ id: 2, name: 'Family Bridge Loan', loan_type: 'lent' });
    const inactiveLoan = makeLoan({ id: 3, name: 'Old Scooter Loan', is_active: false });
    const zeroPaymentLoan = makeLoan({ id: 4, name: 'Deferred Facility', monthly_payment: 0 });

    const filtered = filterActiveBorrowedLoans([
      activeBorrowed,
      lentLoan,
      inactiveLoan,
      zeroPaymentLoan,
    ]);

    expect(filtered.map((loan) => loan.id)).toEqual([1]);
  });
});

describe('reconcileFixedBurn', () => {
  it('merges a linked loan into its matching recurring commitment without double-counting', () => {
    const commitment = makeCommitment({ transaction_id: 501 });
    const loan = makeLoan({
      id: 1,
      linked_payments: [makePayment({ id: 501, entry_type: 'repayment' })],
    });

    const result = reconcileFixedBurn([commitment], [loan]);

    expect(result.commitments).toHaveLength(1);
    expect(result.commitments[0].linkedLoan?.id).toBe(1);
    expect(result.pendingLoans).toEqual([]);
    expect(result.totalItemCount).toBe(1);
  });

  it('keeps an unlinked active borrowed loan in pendingLoans', () => {
    const rent = makeCommitment({
      transaction_id: 201,
      merchant: 'Harbour Rentals',
      category: 'Housing',
    });
    const unlinkedLoan = makeLoan({ id: 7, name: 'Solar Battery Plan', linked_payments: [] });

    const result = reconcileFixedBurn([rent], [unlinkedLoan]);

    expect(result.commitments[0].linkedLoan).toBeNull();
    expect(result.pendingLoans.map((loan) => loan.id)).toEqual([7]);
    expect(result.totalItemCount).toBe(2);
  });

  it('handles mixed linked and pending loans accurately', () => {
    const rent = makeCommitment({
      transaction_id: 201,
      merchant: 'Harbour Rentals',
      category: 'Housing',
    });
    const autoPayment = makeCommitment({
      transaction_id: 501,
      merchant: 'Alex Auto',
      category: 'Debt & Loans',
    });
    const linkedLoan = makeLoan({
      id: 1,
      linked_payments: [makePayment({ id: 501 })],
    });
    const pendingLoan = makeLoan({
      id: 2,
      name: 'Home Appliance Finance',
      lender: 'City Credit',
      linked_payments: [],
    });

    const result = reconcileFixedBurn([rent, autoPayment], [linkedLoan, pendingLoan]);

    expect(result.commitments[0].linkedLoan).toBeNull();
    expect(result.commitments[1].linkedLoan?.id).toBe(1);
    expect(result.pendingLoans.map((loan) => loan.id)).toEqual([2]);
    expect(result.totalItemCount).toBe(3);
  });

  it('attaches linkedLoan only to the matching category split on a split transaction', () => {
    const loanSplit = makeCommitment({
      transaction_id: 880,
      merchant: 'Metro Bundle',
      category: 'Debt & Loans',
    });
    const feeSplit = makeCommitment({
      transaction_id: 880,
      merchant: 'Metro Bundle',
      category: 'Utilities',
    });
    const loan = makeLoan({
      id: 3,
      linked_payments: [
        makePayment({
          id: 880,
          split_id: 42,
          category: 'Debt & Loans',
          entry_type: 'repayment',
        }),
      ],
    });

    const result = reconcileFixedBurn([loanSplit, feeSplit], [loan]);

    expect(result.commitments[0].linkedLoan?.id).toBe(3);
    expect(result.commitments[1].linkedLoan).toBeNull();
    expect(result.pendingLoans).toEqual([]);
    expect(result.totalItemCount).toBe(2);
  });

  it('ignores disbursement entries when reconciling linked payments', () => {
    const commitment = makeCommitment({ transaction_id: 910 });
    const loan = makeLoan({
      id: 4,
      linked_payments: [makePayment({ id: 910, entry_type: 'disbursement' })],
    });

    const result = reconcileFixedBurn([commitment], [loan]);

    expect(result.commitments[0].linkedLoan).toBeNull();
    expect(result.pendingLoans.map((item) => item.id)).toEqual([4]);
    expect(result.totalItemCount).toBe(2);
  });

  it('excludes lent, inactive, and zero-payment loans from reconciliation', () => {
    const commitment = makeCommitment({ transaction_id: 501 });
    const lentLoan = makeLoan({
      id: 10,
      loan_type: 'lent',
      linked_payments: [makePayment({ id: 501 })],
    });
    const inactiveLoan = makeLoan({
      id: 11,
      is_active: false,
      linked_payments: [],
    });
    const zeroPaymentLoan = makeLoan({
      id: 12,
      monthly_payment: 0,
      linked_payments: [],
    });

    const result = reconcileFixedBurn([commitment], [lentLoan, inactiveLoan, zeroPaymentLoan]);

    expect(result.commitments[0].linkedLoan).toBeNull();
    expect(result.pendingLoans).toEqual([]);
    expect(result.totalItemCount).toBe(1);
  });
});
