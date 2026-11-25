import { describe, expect, it } from 'vitest';
import { Transaction } from '../types';
import {
  collapsePairedTransfers,
  filterCounterpartAccountTransactions,
} from './transfers';

function makeTx(overrides: Partial<Transaction>): Transaction {
  return {
    id: 1,
    transaction_date: '2026-11-12',
    account_id: 1001,
    amount: -50,
    currency: 'NZD',
    merchant: 'Alex Transfer',
    category: 'Transfers',
    ...overrides,
  };
}

describe('filterCounterpartAccountTransactions', () => {
  it('returns all transactions unchanged when accountId is undefined', () => {
    const txs = [
      makeTx({ id: 1, account_id: 1001 }),
      makeTx({ id: 2, account_id: 2002, counterpart_account_id: 1001, linked_transaction_id: 1 }),
    ];

    expect(filterCounterpartAccountTransactions(txs, undefined)).toEqual(txs);
  });

  it('keeps owned account rows and unlinked counterpart legs while dropping linked counterpart duplicates', () => {
    const owned = makeTx({ id: 1, account_id: 1001 });
    const unlinkedCounterpart = makeTx({
      id: 2,
      account_id: 2002,
      counterpart_account_id: 1001,
      linked_transaction_id: null,
    });
    const linkedCounterpart = makeTx({
      id: 3,
      account_id: 2002,
      counterpart_account_id: 1001,
      linked_transaction_id: 1,
    });
    const unrelated = makeTx({
      id: 4,
      account_id: 2002,
      counterpart_account_id: 3003,
      linked_transaction_id: null,
    });

    const filtered = filterCounterpartAccountTransactions(
      [owned, unlinkedCounterpart, linkedCounterpart, unrelated],
      1001
    );

    expect(filtered.map((tx) => tx.id)).toEqual([1, 2]);
  });

  it('collapses paired transfer legs with outflow as primary', () => {
    const inflow = makeTx({
      id: 10,
      account_id: 2002,
      account_name: 'Savings',
      amount: 200,
      linked_transaction_id: 11,
      tags: ['savings'],
    });
    const outflow = makeTx({
      id: 11,
      account_id: 1001,
      account_name: 'Checking',
      amount: -200,
      linked_transaction_id: 10,
      tags: ['monthly'],
    });

    const collapsed = collapsePairedTransfers([inflow, outflow]);
    expect(collapsed).toHaveLength(1);
    expect(collapsed[0].id).toBe(11);
    expect(collapsed[0].linked_account_name).toBe('Savings');
    expect(collapsed[0].linked_amount).toBe(200);
    expect(collapsed[0].tags).toEqual(['monthly', 'savings']);
  });
});
