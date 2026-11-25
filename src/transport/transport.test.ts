import { afterEach, describe, expect, it, vi } from 'vitest';
import { FakeHttpAdapter } from './fakeHttpAdapter';
import {
  authHttpAdapter,
  createPlutusTransport,
  isMidasApiError,
  isSessionExpiredError,
  MidasApiError,
  SessionExpiredError,
} from './index';
import { Transaction } from '../types';

async function expectReject(
  promise: Promise<unknown>,
  assertError: (err: unknown) => void
): Promise<void> {
  try {
    await promise;
    expect.unreachable('Expected promise to reject');
  } catch (err) {
    assertError(err);
  }
}

function makeTx(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 101,
    transaction_date: '2026-11-10',
    account_id: 1,
    amount: -45.5,
    currency: 'NZD',
    merchant: 'Alex Corner Store',
    category: 'Groceries',
    ...overrides,
  };
}

describe('Plutus HTTP transport seam', () => {
  describe('MidasApiError decoding and SessionExpiredError passthrough', () => {
    it('decodes FastAPI string detail into MidasApiError', async () => {
      const adapter = new FakeHttpAdapter().enqueueJson(
        { detail: 'Category already exists' },
        409,
        {},
        'Conflict'
      );
      const transport = createPlutusTransport(adapter);

      await expectReject(
        transport.createCategory({ name: 'Groceries' }),
        (err) => {
          expect(isMidasApiError(err)).toBe(true);
          const apiErr = err as MidasApiError;
          expect(apiErr.status).toBe(409);
          expect(apiErr.statusText).toBe('Conflict');
          expect(apiErr.detail).toBe('Category already exists');
          expect(apiErr.path).toBe('/categories');
          expect(apiErr.message).toBe('Category already exists');
        }
      );
    });

    it('decodes Pydantic validation array detail into MidasApiError', async () => {
      const adapter = new FakeHttpAdapter().enqueueJson(
        {
          detail: [
            { loc: ['body', 'amount'], msg: 'Input should be greater than 0' },
            { loc: ['body', 'merchant'], msg: 'Field required' },
          ],
        },
        422,
        {},
        'Unprocessable Entity'
      );
      const transport = createPlutusTransport(adapter);

      await expectReject(
        transport.quickLogExpense({ amount: 0, merchant: '' }),
        (err) => {
          expect(err).toBeInstanceOf(MidasApiError);
          const apiErr = err as MidasApiError;
          expect(apiErr.status).toBe(422);
          expect(apiErr.detail).toBe('Input should be greater than 0; Field required');
          expect(apiErr.message).toBe('Input should be greater than 0; Field required');
        }
      );
    });

    it('decodes plain text error body into MidasApiError', async () => {
      const adapter = new FakeHttpAdapter().enqueueText(
        'Upstream gateway timeout',
        502,
        'Bad Gateway'
      );
      const transport = createPlutusTransport(adapter);

      await expectReject(transport.fetchRunway(), (err) => {
        expect(isMidasApiError(err)).toBe(true);
        const apiErr = err as MidasApiError;
        expect(apiErr.status).toBe(502);
        expect(apiErr.detail).toBe('Upstream gateway timeout');
        expect(apiErr.message).toBe('Upstream gateway timeout');
      });
    });

    it('falls back to statusText and HTTP status when error body is empty', async () => {
      const adapter = new FakeHttpAdapter()
        .enqueueEmpty(503, 'Service Unavailable')
        .enqueueEmpty(500, '');
      const transport = createPlutusTransport(adapter);

      await expectReject(transport.fetchAccounts(), (err) => {
        expect(isMidasApiError(err)).toBe(true);
        const apiErr = err as MidasApiError;
        expect(apiErr.detail).toBe('Service Unavailable');
        expect(apiErr.message).toBe('Failed to fetch accounts: Service Unavailable');
      });

      await expectReject(transport.fetchAccounts(), (err) => {
        expect(isMidasApiError(err)).toBe(true);
        const apiErr = err as MidasApiError;
        expect(apiErr.detail).toBe('HTTP 500');
        expect(apiErr.message).toBe('Failed to fetch accounts: HTTP 500');
      });
    });

    it('preserves SessionExpiredError without wrapping into MidasApiError', async () => {
      const adapter = new FakeHttpAdapter().enqueueThrow(
        new SessionExpiredError('Authentik session expired', { status: 401 })
      );
      const transport = createPlutusTransport(adapter);

      await expectReject(transport.fetchRunway(), (err) => {
        expect(isSessionExpiredError(err)).toBe(true);
        expect(isMidasApiError(err)).toBe(false);
      });
    });
  });

  describe('fail-loud fetchInstitutions', () => {
    it('fails loudly with MidasApiError on 500 rather than returning hardcoded institutions', async () => {
      const adapter = new FakeHttpAdapter().enqueueJson(
        { detail: 'Institution catalog unavailable' },
        500,
        {},
        'Internal Server Error'
      );
      const transport = createPlutusTransport(adapter);

      await expectReject(transport.fetchInstitutions(), (err) => {
        expect(isMidasApiError(err)).toBe(true);
        const apiErr = err as MidasApiError;
        expect(apiErr.status).toBe(500);
        expect(apiErr.path).toBe('/institutions');
        expect(apiErr.detail).toBe('Institution catalog unavailable');
      });
    });

    it('fails loudly on network error rather than swallowing rejection', async () => {
      const adapter = new FakeHttpAdapter().enqueueThrow(
        new TypeError('Failed to fetch')
      );
      const transport = createPlutusTransport(adapter);

      await expect(transport.fetchInstitutions()).rejects.toThrow('Failed to fetch');
    });
  });

  describe('consolidated transaction query and period parameter building', () => {
    it('returns raw account transactions without counterpart filtering in transport', async () => {
      const rows = [
        makeTx({ id: 1, account_id: 10 }),
        makeTx({ id: 2, account_id: 20, counterpart_account_id: 10, linked_transaction_id: 99 }),
      ];
      const adapter = new FakeHttpAdapter().enqueueJson(rows);
      const transport = createPlutusTransport(adapter);

      const res = await transport.fetchAccountTransactions({
        accountId: 10,
        period: 'month',
        limit: 100,
      });

      expect(res).toHaveLength(2);
      expect(adapter.calls[0].input).toBe('/api/transactions?period=month&account_id=10&limit=100');
    });

    it('maps custom period dates and flags for category and tag queries', async () => {
      const adapter = new FakeHttpAdapter()
        .enqueueJson([makeTx()])
        .enqueueJson([makeTx()]);
      const transport = createPlutusTransport(adapter);

      await transport.fetchCategoryTransactions(
        'Food',
        'custom',
        '2026-10-01',
        '2026-10-31',
        true,
        true
      );
      await transport.fetchTagTransactions('travel', 'month', undefined, undefined, 'Food');

      expect(adapter.calls[0].input).toBe(
        '/api/transactions?start_date=2026-10-01&end_date=2026-10-31&category=Food&include_subclasses=true&include_amortized=true&limit=200'
      );
      expect(adapter.calls[1].input).toBe(
        '/api/transactions?period=month&category=Food&tag=travel&limit=500'
      );
    });

    it('reads X-Total-Count header and falls back to non-amortized row count in fetchFlowTransactions', async () => {
      const txs = [
        makeTx({ id: 1, is_amortized_commitment: false }),
        makeTx({ id: 2, is_amortized_commitment: true }),
      ];
      const adapter = new FakeHttpAdapter()
        .enqueueJson(txs, 200, { 'X-Total-Count': '42' })
        .enqueueJson(txs, 200);
      const transport = createPlutusTransport(adapter);

      const pageWithHeader = await transport.fetchFlowTransactions({
        flow: 'outflow',
        period: 'week',
        offset: 20,
      });
      const pageWithoutHeader = await transport.fetchFlowTransactions({
        flow: 'inflow',
        period: 'all',
      });

      expect(pageWithHeader.totalCount).toBe(42);
      expect(adapter.calls[0].input).toBe(
        '/api/transactions?period=week&flow=outflow&limit=200&offset=20'
      );
      expect(pageWithoutHeader.totalCount).toBe(1);
    });
  });

  describe('consolidated PATCH /transactions/{id}, void DELETE, and FormData uploads', () => {
    it('routes all transaction field updates through PATCH /transactions/{id}', async () => {
      const updated = makeTx({ id: 55 });
      const adapter = new FakeHttpAdapter()
        .enqueueJson(updated)
        .enqueueJson(updated)
        .enqueueJson(updated)
        .enqueueJson(updated)
        .enqueueJson(updated);
      const transport = createPlutusTransport(adapter);

      await transport.updateTransactionCategory(55, 'Utilities');
      await transport.updateTransactionTags(55, ['home', 'fixed']);
      await transport.updateTransactionRecurrence(55, 'monthly');
      await transport.updateTransactionLoan(55, 7, 250);
      await transport.updateTransactionCounterpart(55, 3);

      expect(adapter.calls).toHaveLength(5);
      for (const call of adapter.calls) {
        expect(call.input).toBe('/api/transactions/55');
        expect(call.init?.method).toBe('PATCH');
      }
      expect(JSON.parse(String(adapter.calls[0].init?.body))).toEqual({ category: 'Utilities' });
      expect(JSON.parse(String(adapter.calls[1].init?.body))).toEqual({ tags: ['home', 'fixed'] });
      expect(JSON.parse(String(adapter.calls[2].init?.body))).toEqual({ recurrence: 'monthly' });
      expect(JSON.parse(String(adapter.calls[3].init?.body))).toEqual({
        loan_id: 7,
        loan_payment_amount: 250,
      });
      expect(JSON.parse(String(adapter.calls[4].init?.body))).toEqual({
        counterpart_account_id: 3,
      });
    });

    it('handles 204 No Content void responses on DELETE requests', async () => {
      const adapter = new FakeHttpAdapter()
        .enqueueEmpty(204)
        .enqueueEmpty(204)
        .enqueueEmpty(204)
        .enqueueEmpty(204);
      const transport = createPlutusTransport(adapter);

      await expect(transport.deleteBudgetRule(12)).resolves.toBeUndefined();
      await expect(transport.deleteLoan(14)).resolves.toBeUndefined();
      await expect(transport.deleteRule(16)).resolves.toBeUndefined();
      await expect(transport.deleteReceipt(18)).resolves.toBeUndefined();

      expect(adapter.calls.map((c) => [c.input, c.init?.method])).toEqual([
        ['/api/budgets/12', 'DELETE'],
        ['/api/loans/14', 'DELETE'],
        ['/api/rules/16', 'DELETE'],
        ['/api/receipts/18', 'DELETE'],
      ]);
    });

    it('sends FormData without forcing Content-Type header for statement and receipt uploads', async () => {
      const adapter = new FakeHttpAdapter()
        .enqueueJson({
          institution: 'ASB',
          start_date: '2026-11-01',
          end_date: '2026-11-20',
          opening_balance: 1000,
          closing_balance: 1200,
          currency: 'NZD',
          transaction_count: 1,
          transactions: [],
        })
        .enqueueJson({ id: 9, status: 'pending' });
      const transport = createPlutusTransport(adapter);

      const statementFile = new File(['date,amount\n'], 'statement.csv', { type: 'text/csv' });
      const receiptFile = new File(['img'], 'receipt.png', { type: 'image/png' });

      await transport.uploadStatement(statementFile, 'ASB', true, 1, 1200, 'cash', 'checking');
      await transport.uploadReceipt(receiptFile);

      expect(adapter.calls[0].input).toBe(
        '/api/integrations/statement?institution=ASB&commit=true&account_id=1&closing_balance=1200&tier=cash&account_type=checking'
      );
      expect(adapter.calls[0].init?.body).toBeInstanceOf(FormData);
      expect(adapter.calls[0].init?.headers).toBeUndefined();

      expect(adapter.calls[1].input).toBe('/api/receipts/upload');
      expect(adapter.calls[1].init?.body).toBeInstanceOf(FormData);
      expect(adapter.calls[1].init?.headers).toBeUndefined();
      expect(transport.getReceiptImageUrl(9)).toBe('/api/receipts/9/image');
    });
  });

  describe('authHttpAdapter', () => {
    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('delegates to authFetch with cache no-store', async () => {
      const fetchMock = vi.fn(
        async () =>
          new Response(JSON.stringify([]), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
      );
      vi.stubGlobal('fetch', fetchMock);

      const transport = createPlutusTransport(authHttpAdapter);
      await transport.fetchInstitutions();

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/institutions',
        expect.objectContaining({ cache: 'no-store' })
      );
    });
  });
});
