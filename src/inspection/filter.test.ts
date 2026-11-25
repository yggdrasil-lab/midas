import { describe, expect, it } from 'vitest';
import { Transaction } from '../types';
import {
  collapseInspectionTransfers,
  filterAccountTransactions,
  filterTagTransactions,
  matchesInspectionCategory,
  matchesInspectionSearch,
} from './index';

function makeTx(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 1,
    transaction_date: '2026-11-12',
    account_id: 1001,
    account_name: 'Main Checking',
    amount: -120,
    currency: 'NZD',
    merchant: 'Harbour Market',
    category: 'Groceries',
    raw_description: 'POS HARBOUR MARKET 1001',
    tags: ['weekly-shop'],
    ...overrides,
  };
}

describe('unified split-aware inspection search across all 4 scopes', () => {
  it('matches all core transaction fields, hash-prefixed tags, accounts, loan, and recurrence', () => {
    const tx = makeTx({
      merchant: 'Alex Hardware',
      category: 'Household',
      raw_description: 'EFTPOS ALEX HARDWARE WELLINGTON',
      notes: 'Kitchen tap repair',
      account_name: 'Everyday Checking',
      linked_account_name: 'Reserve Vault',
      counterpart_account_name: 'Alex Savings',
      loan_name: 'Home Improvement Loan',
      recurrence: 'fortnightly',
      tags: ['renovation', 'plumbing'],
    });

    expect(matchesInspectionSearch(tx, 'wellington')).toBe(true);
    expect(matchesInspectionSearch(tx, 'alex hardware')).toBe(true);
    expect(matchesInspectionSearch(tx, 'household')).toBe(true);
    expect(matchesInspectionSearch(tx, 'tap repair')).toBe(true);
    expect(matchesInspectionSearch(tx, '#plumbing')).toBe(true);
    expect(matchesInspectionSearch(tx, 'everyday checking')).toBe(true);
    expect(matchesInspectionSearch(tx, 'reserve vault')).toBe(true);
    expect(matchesInspectionSearch(tx, 'alex savings')).toBe(true);
    expect(matchesInspectionSearch(tx, 'improvement loan')).toBe(true);
    expect(matchesInspectionSearch(tx, 'Fortnightly')).toBe(true);
    expect(matchesInspectionSearch(tx, 'nonexistent-term')).toBe(false);
    expect(matchesInspectionSearch(tx, '   ')).toBe(true);
  });

  it('matches amortized recurrence origin summary for smoothed commitments', () => {
    const amortized = makeTx({
      is_amortized_commitment: true,
      recurrence: 'annual',
      amount: -1200,
      currency: 'NZD',
    });

    expect(matchesInspectionSearch(amortized, 'annual')).toBe(true);
    expect(matchesInspectionSearch(amortized, 'NZD/yr')).toBe(true);
  });

  it('matches split category, loan_name, notes, and tags consistently across scopes', () => {
    const splitTx = makeTx({
      id: 42,
      merchant: 'Department Store',
      category: 'Shopping',
      is_split: true,
      splits: [
        {
          id: 501,
          transaction_id: 42,
          amount: -80,
          category: 'Debt & Loans',
          tags: ['repay-plan'],
          loan_id: 7,
          loan_name: 'Car Finance',
          notes: 'Monthly principal allocation',
        },
        {
          id: 502,
          transaction_id: 42,
          amount: -40,
          category: 'Travel',
          tags: ['south-island'],
          notes: 'Luggage tag',
        },
      ],
    });

    for (const q of ['Debt & Loans', 'Car Finance', 'principal allocation', '#south-island', 'Travel']) {
      expect(matchesInspectionSearch(splitTx, q)).toBe(true);
      expect(filterAccountTransactions([splitTx], null, q)).toHaveLength(1);
      expect(filterTagTransactions([splitTx], 'ALL', q)).toHaveLength(1);
    }

    expect(matchesInspectionCategory(splitTx, 'Travel')).toBe(true);
    expect(filterAccountTransactions([splitTx], 'Debt & Loans', 'Car Finance')).toHaveLength(1);
    expect(filterTagTransactions([splitTx], 'Travel', 'Luggage')).toHaveLength(1);
    expect(filterTagTransactions([splitTx], 'Groceries', 'Luggage')).toHaveLength(0);
  });
});

describe('single-pass paired transfer collapse', () => {
  it('collapses paired transfer legs once into outflow primary with merged tags', () => {
    const inflow = makeTx({
      id: 201,
      account_id: 2002,
      account_name: 'Growth Vault',
      amount: 500,
      category: 'Transfers',
      linked_transaction_id: 200,
      tags: ['auto'],
    });
    const outflow = makeTx({
      id: 200,
      account_id: 1001,
      account_name: 'Main Checking',
      amount: -500,
      category: 'Transfers',
      linked_transaction_id: 201,
      tags: ['monthly'],
    });

    const once = collapseInspectionTransfers([inflow, outflow]);
    expect(once).toHaveLength(1);
    expect(once[0].id).toBe(200);
    expect(once[0].linked_account_name).toBe('Growth Vault');
    expect(once[0].tags).toEqual(['monthly', 'auto']);

    // Idempotent when already collapsed
    expect(collapseInspectionTransfers(once)).toHaveLength(1);
  });
});
