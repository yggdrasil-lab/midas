import { describe, expect, it } from 'vitest';
import { createPlutusTransport } from '../transport';
import { FakeHttpAdapter } from '../transport/fakeHttpAdapter';
import { Account, LoanItem } from '../types';
import { loadInspectionContext } from './index';

const SYNTHETIC_LOAN: LoanItem = {
  id: 1,
  name: 'Vehicle Loan',
  lender: 'Main Bank',
  loan_type: 'borrowed',
  principal_amount: 10000,
  annual_interest_rate: 0.06,
  term_months: 36,
  monthly_payment: 300,
  start_date: '2026-01-01',
  currency: 'NZD',
  is_active: true,
  payments_made: 2,
  payments_remaining: 34,
  remaining_principal: 9500,
  principal_paid: 500,
  remaining_interest: 400,
  weekly_payment_equivalent: 70,
  net_worth_impact: -9500,
};

const SYNTHETIC_ACCOUNT: Account = {
  id: 1001,
  name: 'Alex Everyday',
  account_type: 'checking',
  tier: 'cash',
  institution: 'Main Bank',
  currency: 'NZD',
  expected_annual_return: 0,
  is_active: true,
};

describe('fail-loud inspection context loading and retry recovery', () => {
  it('surfaces contextError when fetchLoans rejects while retaining fetched accounts', async () => {
    const adapter = new FakeHttpAdapter().setDefault((input) => {
      if (input.includes('/loans')) {
        return new Response(JSON.stringify({ detail: 'Loans service unavailable' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify([SYNTHETIC_ACCOUNT]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    const result = await loadInspectionContext({ transport: createPlutusTransport(adapter) });
    expect(result.loans).toEqual([]);
    expect(result.accounts).toEqual([SYNTHETIC_ACCOUNT]);
    expect(result.contextError).toContain('Failed to load loans context');
    expect(result.contextError).toContain('Loans service unavailable');
  });

  it('surfaces contextError when fetchAccounts rejects while retaining fetched loans', async () => {
    const adapter = new FakeHttpAdapter().setDefault((input) => {
      if (input.includes('/accounts')) {
        return new Response(JSON.stringify({ detail: 'Accounts DB offline' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ loans: [SYNTHETIC_LOAN] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    const result = await loadInspectionContext({ transport: createPlutusTransport(adapter) });
    expect(result.loans).toEqual([SYNTHETIC_LOAN]);
    expect(result.accounts).toEqual([]);
    expect(result.contextError).toContain('Failed to load accounts context');
    expect(result.contextError).toContain('Accounts DB offline');
  });

  it('recovers cleanly on retry once loans and accounts endpoints succeed', async () => {
    let fail = true;
    const adapter = new FakeHttpAdapter().setDefault((input) => {
      if (fail) {
        return new Response(JSON.stringify({ detail: 'Temporary outage' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (input.includes('/loans')) {
        return new Response(JSON.stringify({ loans: [SYNTHETIC_LOAN] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify([SYNTHETIC_ACCOUNT]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    const transport = createPlutusTransport(adapter);
    const failed = await loadInspectionContext({ transport });
    expect(failed.contextError).not.toBeNull();
    expect(failed.loans).toEqual([]);
    expect(failed.accounts).toEqual([]);

    fail = false;
    const recovered = await loadInspectionContext({ transport });
    expect(recovered.contextError).toBeNull();
    expect(recovered.loans).toEqual([SYNTHETIC_LOAN]);
    expect(recovered.accounts).toEqual([SYNTHETIC_ACCOUNT]);
  });

  it('skips fetching accounts when providedAccounts is supplied', async () => {
    const adapter = new FakeHttpAdapter().enqueueJson({ loans: [SYNTHETIC_LOAN] });
    const result = await loadInspectionContext({
      transport: createPlutusTransport(adapter),
      providedAccounts: [SYNTHETIC_ACCOUNT],
    });

    expect(adapter.calls).toHaveLength(1);
    expect(adapter.calls[0].input).toContain('/loans');
    expect(result.contextError).toBeNull();
    expect(result.accounts).toEqual([SYNTHETIC_ACCOUNT]);
  });
});
