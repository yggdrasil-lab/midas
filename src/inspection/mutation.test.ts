import { describe, expect, it } from 'vitest';
import { Account, Transaction } from '../types';
import {
  buildCounterpartUpdatePatch,
  buildLoanUpdatePatch,
  buildRulePrefillFromTx,
  executeAtomicMutation,
} from './index';

function createDeferred<T = void>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function makeTx(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 77,
    transaction_date: '2026-11-15',
    account_id: 1001,
    amount: -250,
    currency: 'NZD',
    merchant: 'Alex Motors',
    category: 'Debt & Loans',
    raw_description: 'AP ALEX MOTORS 1001',
    ...overrides,
  };
}

describe('atomic post-mutation reload ordering', () => {
  it('awaits both scope reload and parent refresh before clearing busy state', async () => {
    const scopeDeferred = createDeferred();
    const parentDeferred = createDeferred();
    const events: string[] = [];
    let busy = false;
    let resolved = false;

    const task = executeAtomicMutation({
      run: async () => {
        events.push('mutate');
        return 'ok';
      },
      onStart: () => {
        busy = true;
        events.push('start');
      },
      onApplied: () => {
        events.push('applied');
      },
      reloadScope: async () => {
        await scopeDeferred.promise;
        events.push('scope-reloaded');
      },
      onRefreshParent: async () => {
        await parentDeferred.promise;
        events.push('parent-refreshed');
      },
      onFinish: () => {
        busy = false;
        events.push('finish');
      },
      fallbackError: 'Mutation failed',
    }).then((ok) => {
      resolved = true;
      return ok;
    });

    await Promise.resolve();
    await Promise.resolve();
    expect(busy).toBe(true);
    expect(resolved).toBe(false);

    scopeDeferred.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(events).toContain('scope-reloaded');
    expect(busy).toBe(true);
    expect(resolved).toBe(false);

    parentDeferred.resolve();
    const ok = await task;
    expect(ok).toBe(true);
    expect(busy).toBe(false);
    expect(resolved).toBe(true);
    expect(events).toEqual([
      'start',
      'mutate',
      'applied',
      'scope-reloaded',
      'parent-refreshed',
      'finish',
    ]);
  });

  it('clears busy state and surfaces error when mutation or reload rejects', async () => {
    let busy = false;
    let capturedError: string | null = null;

    const ok = await executeAtomicMutation({
      run: async () => 'done',
      onStart: () => {
        busy = true;
      },
      reloadScope: async () => {
        throw new Error('Scope reload failed');
      },
      onError: (msg) => {
        capturedError = msg;
      },
      onFinish: () => {
        busy = false;
      },
      fallbackError: 'Fallback',
    });

    expect(ok).toBe(false);
    expect(busy).toBe(false);
    expect(capturedError).toBe('Scope reload failed');
  });
});

describe('mutation patch builders', () => {
  it('builds loan, counterpart, and rule prefill patches deterministically', () => {
    const tx = makeTx({ tags: ['auto'] });
    const loanRes = buildLoanUpdatePatch(
      { ...tx, loan_id: 5 },
      5,
      250,
      'Car Loan',
      'borrowed'
    );
    expect(loanRes.note).toBe('Linked transaction to "Car Loan"');
    expect(loanRes.patch).toEqual({
      loan_id: 5,
      loan_name: 'Car Loan',
      loan_type: 'borrowed',
      loan_payment_amount: 250,
    });

    const acc: Account = {
      id: 2002,
      name: 'Savings Vault',
      account_type: 'savings',
      tier: 'cash',
      institution: 'Main Bank',
      currency: 'NZD',
      expected_annual_return: 0.04,
      is_active: true,
    };
    const cpRes = buildCounterpartUpdatePatch(
      { ...tx, counterpart_account_id: 2002 },
      2002,
      acc
    );
    expect(cpRes.note).toBe('Attributed transaction to "Savings Vault"');
    expect(cpRes.patch.counterpart_account_name).toBe('Savings Vault');

    const prefill = buildRulePrefillFromTx(tx);
    expect(prefill.name).toBe('Rule for Alex Motors');
    expect(prefill.description_pattern).toBe('AP ALEX MOTORS 1001');
  });
});
