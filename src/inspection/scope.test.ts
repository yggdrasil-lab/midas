import { describe, expect, it } from 'vitest';
import { createPlutusTransport } from '../transport';
import { FakeHttpAdapter } from '../transport/fakeHttpAdapter';
import { Transaction } from '../types';
import { InspectionScopeRequest, runScopeLoad } from './index';

function createDeferred<T = Response>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function makeTx(id: number, overrides: Partial<Transaction> = {}): Transaction {
  return {
    id,
    transaction_date: '2026-11-18',
    account_id: 1001,
    amount: -50,
    currency: 'NZD',
    merchant: 'Alex Store',
    category: 'Groceries',
    ...overrides,
  };
}

describe('inspection scope loading vs post-mutation reload preservation', () => {
  it('sets loading=true on initial/scope-switch load, keeps loading=false and rows mounted during post-mutation reload', async () => {
    const adapter = new FakeHttpAdapter();
    const transport = createPlutusTransport(adapter);

    const requestIdRef = { current: 0 };
    const loadedScopeKeyRef = { current: null as string | null };
    const loadingHistory: boolean[] = [];
    let transactions: Transaction[] = [];
    let error: string | null = null;

    const runWithRequest = (request: InspectionScopeRequest) =>
      runScopeLoad({
        request,
        transport,
        requestIdRef,
        loadedScopeKeyRef,
        setTransactions: (items) => {
          transactions = items;
        },
        setLoading: (val) => {
          loadingHistory.push(val);
        },
        setError: (err) => {
          error = err;
        },
      });

    // 1. Initial load: loading transitions true -> false
    const account1Req: InspectionScopeRequest = { kind: 'account', accountId: 1001, period: 'month' };
    adapter.enqueueJson([makeTx(140, { category: 'Debt & Loans' })]);
    await runWithRequest(account1Req);

    expect(loadingHistory).toEqual([true, false]);
    expect(transactions.map((t) => t.id)).toEqual([140]);
    expect(error).toBeNull();

    // 2. Post-mutation reload on the same scope: loading stays false and rows stay mounted while awaiting
    const deferredReload = createDeferred();
    adapter.enqueue(() => deferredReload.promise);
    loadingHistory.length = 0;

    const reloadTask = runWithRequest(account1Req);
    await Promise.resolve();
    expect(loadingHistory).toEqual([]);
    expect(transactions.map((t) => t.id)).toEqual([140]);

    deferredReload.resolve(
      new Response(JSON.stringify([makeTx(140, { category: 'Debt & Loans', loan_id: 1 })]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );
    await reloadTask;
    expect(loadingHistory).toEqual([]);
    expect(transactions[0].loan_id).toBe(1);

    // 3. Switching to a different scope sets loading=true again
    const account2Req: InspectionScopeRequest = { kind: 'account', accountId: 2002, period: 'month' };
    adapter.enqueueJson([makeTx(201, { account_id: 2002 })]);
    await runWithRequest(account2Req);
    expect(loadingHistory).toEqual([true, false]);
    expect(transactions.map((t) => t.id)).toEqual([201]);
  });

  it('preserves mounted rows and surfaces error loudly if post-mutation reload fails', async () => {
    const adapter = new FakeHttpAdapter()
      .enqueueJson([makeTx(140)])
      .enqueueJson({ detail: 'Transient backend error' }, 500);
    const transport = createPlutusTransport(adapter);

    const requestIdRef = { current: 0 };
    const loadedScopeKeyRef = { current: null as string | null };
    const loadingHistory: boolean[] = [];
    let transactions: Transaction[] = [];
    let error: string | null = null;
    const req: InspectionScopeRequest = { kind: 'category', category: 'Groceries', period: 'month', includeSubclasses: false, includeAmortized: false };

    await runScopeLoad({
      request: req,
      transport,
      requestIdRef,
      loadedScopeKeyRef,
      setTransactions: (items) => { transactions = items; },
      setLoading: (val) => { loadingHistory.push(val); },
      setError: (err) => { error = err; },
    });
    expect(transactions.map((t) => t.id)).toEqual([140]);

    loadingHistory.length = 0;
    await runScopeLoad({
      request: req,
      transport,
      requestIdRef,
      loadedScopeKeyRef,
      setTransactions: (items) => { transactions = items; },
      setLoading: (val) => { loadingHistory.push(val); },
      setError: (err) => { error = err; },
    });

    expect(loadingHistory).toEqual([]);
    expect(transactions.map((t) => t.id)).toEqual([140]);
    expect(error).toContain('Transient backend error');
  });
});
