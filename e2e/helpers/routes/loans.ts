import type { Page, Route } from '@playwright/test';
import type {
  LoanLinkedEntry,
  MockApiState,
  MockLoanRecord,
  MockTransactionRecord,
} from '../mock-types';

function fulfillJson(route: Route, status: number, payload: unknown): Promise<void> {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(payload),
  });
}

function collectLoanEntries(
  transactions: MockTransactionRecord[],
  loanId: number
): LoanLinkedEntry[] {
  const entries: LoanLinkedEntry[] = [];
  for (const tx of transactions) {
    const rawAmt = Math.abs(tx.amount);
    if (tx.is_split && tx.splits && tx.splits.length > 0) {
      for (const split of tx.splits) {
        if (split.loan_id !== loanId) continue;
        const signedAmt = Number(split.amount);
        const splitAmt = Math.abs(signedAmt);
        entries.push({
          tx,
          appliedAmt: splitAmt,
          signedAmt,
          loanPaymentAmount: splitAmt,
          splitId: split.id,
          notes: split.notes ?? null,
          category: split.category,
        });
      }
      continue;
    }
    if (tx.loan_id === loanId) {
      const appliedAmt =
        tx.loan_payment_amount != null
          ? Math.min(rawAmt, Number(tx.loan_payment_amount))
          : rawAmt;
      entries.push({
        tx,
        appliedAmt,
        signedAmt: Number(tx.amount),
        loanPaymentAmount: tx.loan_payment_amount ?? null,
        splitId: null,
        notes: null,
        category: tx.category,
      });
    }
  }
  return entries.sort((a, b) => a.tx.transaction_date.localeCompare(b.tx.transaction_date));
}

function mapLoanEntry(
  entry: LoanLinkedEntry,
  entryType: 'repayment' | 'disbursement',
  amountNzd: number,
  signedFieldAmount: number
) {
  return {
    id: entry.tx.id,
    transaction_date: entry.tx.transaction_date,
    amount: signedFieldAmount,
    currency: entry.tx.currency,
    amount_nzd: amountNzd,
    applied_amount: entry.appliedAmt,
    loan_payment_amount: entry.loanPaymentAmount,
    split_id: entry.splitId,
    notes: entry.notes,
    entry_type: entryType,
    merchant: entry.tx.merchant,
    account_id: entry.tx.account_id,
    account_name: entry.tx.account_name,
    category: entry.category,
  };
}

function computeLentLoanSummary(loan: MockLoanRecord, allLinkedEntries: LoanLinkedEntry[]) {
  const repaymentEntries = allLinkedEntries.filter((e) => e.signedAmt > 0);
  const disbursementEntries = allLinkedEntries.filter((e) => e.signedAmt < 0);
  const effectivePrincipal =
    disbursementEntries.length > 0
      ? Math.round(disbursementEntries.reduce((sum, e) => sum + e.appliedAmt, 0) * 100) / 100
      : loan.principal_amount;
  let remaining = effectivePrincipal;
  let totalRepaid = 0;

  for (const entry of repaymentEntries) {
    totalRepaid = Math.round((totalRepaid + entry.appliedAmt) * 100) / 100;
    remaining = Math.max(0, Math.round((remaining - entry.appliedAmt) * 100) / 100);
  }
  const lastPaymentDate =
    repaymentEntries.length > 0
      ? repaymentEntries[repaymentEntries.length - 1].tx.transaction_date
      : null;

  return {
    ...loan,
    principal_amount: effectivePrincipal,
    payments_made: repaymentEntries.length,
    payments_remaining: 0,
    payoff_date: null,
    next_payment_date: null,
    remaining_principal: remaining,
    principal_paid: totalRepaid,
    total_paid_amount: totalRepaid,
    interest_paid: 0,
    last_payment_date: lastPaymentDate,
    is_payment_due: false,
    net_worth_impact: remaining,
    linked_payments: [...repaymentEntries]
      .reverse()
      .map((e) => mapLoanEntry(e, 'repayment', Math.abs(e.signedAmt), e.tx.amount)),
    disbursements: [...disbursementEntries]
      .reverse()
      .map((e) => mapLoanEntry(e, 'disbursement', Math.abs(e.signedAmt), e.signedAmt)),
  };
}

function computeBorrowedLoanSummary(loan: MockLoanRecord, allLinkedEntries: LoanLinkedEntry[]) {
  const linkedEntries = allLinkedEntries.filter((e) => e.signedAmt < 0);
  const monthlyRate = loan.annual_interest_rate / 12;
  let remaining = loan.principal_amount;
  let totalPaid = 0;
  let interestPaid = 0;
  let principalPaid = 0;

  for (const entry of linkedEntries) {
    const paymentAmt = entry.appliedAmt;
    const interest = Math.round(remaining * monthlyRate * 100) / 100;
    const principalPortion = Math.min(
      remaining,
      Math.max(0, Math.round((paymentAmt - interest) * 100) / 100)
    );
    totalPaid = Math.round((totalPaid + paymentAmt) * 100) / 100;
    interestPaid = Math.round((interestPaid + interest) * 100) / 100;
    principalPaid = Math.round((principalPaid + principalPortion) * 100) / 100;
    remaining = Math.max(0, Math.round((remaining - principalPortion) * 100) / 100);
  }

  const paymentsMade = linkedEntries.length;
  const lastPaymentDate =
    paymentsMade > 0 ? linkedEntries[paymentsMade - 1].tx.transaction_date : null;

  return {
    ...loan,
    payments_made: paymentsMade,
    payments_remaining: Math.max(0, loan.term_months - paymentsMade),
    next_payment_date: paymentsMade === 0 ? loan.next_payment_date || loan.start_date : '2026-12-20',
    remaining_principal: remaining,
    principal_paid: principalPaid,
    total_paid_amount: totalPaid,
    interest_paid: interestPaid,
    last_payment_date: lastPaymentDate,
    is_payment_due: paymentsMade === 0,
    net_worth_impact: Math.round(((loan.asset_value ?? 0) - remaining) * 100) / 100,
    linked_payments: [...linkedEntries]
      .reverse()
      .map((e) => mapLoanEntry(e, 'repayment', Math.abs(e.tx.amount), e.tx.amount)),
    disbursements: [],
  };
}

export function computeLoansSummary(state: MockApiState) {
  const computedLoans = state.loans.map((loan) => {
    const entries = collectLoanEntries(state.transactions, loan.id);
    return loan.loan_type === 'lent'
      ? computeLentLoanSummary(loan, entries)
      : computeBorrowedLoanSummary(loan, entries);
  });

  const borrowedLoans = computedLoans.filter((l) => l.loan_type !== 'lent');
  const lentLoans = computedLoans.filter((l) => l.loan_type === 'lent');
  const round2 = (v: number) => Math.round(v * 100) / 100;
  const totalLiabilities = round2(borrowedLoans.reduce((s, l) => s + l.remaining_principal, 0));
  const totalAssetValue = round2(borrowedLoans.reduce((s, l) => s + (l.asset_value ?? 0), 0));

  return {
    loans: computedLoans,
    total_liabilities: totalLiabilities,
    total_receivables: round2(lentLoans.reduce((s, l) => s + l.remaining_principal, 0)),
    total_asset_value: totalAssetValue,
    net_loan_impact: round2(totalAssetValue - totalLiabilities),
    total_monthly_payment: round2(borrowedLoans.reduce((s, l) => s + l.monthly_payment, 0)),
    total_weekly_payment: round2(borrowedLoans.reduce((s, l) => s + l.weekly_payment_equivalent, 0)),
    latest_payoff_date: borrowedLoans[0]?.payoff_date || null,
  };
}

function handleCreateLoan(route: Route, state: MockApiState): Promise<void> {
  const body = route.request().postDataJSON() || {};
  const loanType: 'borrowed' | 'lent' = body.loan_type === 'lent' ? 'lent' : 'borrowed';
  const newId = state.nextLoanId++;
  const principal = Number(body.principal_amount) || 0;
  const created: MockLoanRecord = {
    id: newId,
    name: body.name || 'New Loan',
    lender: body.lender || 'Lender',
    loan_type: loanType,
    principal_amount: principal,
    annual_interest_rate: Number(body.annual_interest_rate) || 0,
    term_months: Number(body.term_months) || 0,
    monthly_payment: Number(body.monthly_payment) || 0,
    start_date: body.start_date || '2026-11-20',
    asset_value: body.asset_value != null ? Number(body.asset_value) : null,
    currency: body.currency || 'NZD',
    is_active: true,
    payments_made: 0,
    payments_remaining: loanType === 'lent' ? 0 : Number(body.term_months) || 0,
    payoff_date: loanType === 'lent' ? null : '2029-10-20',
    next_payment_date: null,
    remaining_principal: principal,
    principal_paid: 0,
    remaining_interest: 0,
    weekly_payment_equivalent: 0,
    net_worth_impact: principal,
    total_paid_amount: 0,
    interest_paid: 0,
    last_payment_date: null,
    is_payment_due: false,
    linked_payments: [],
    disbursements: [],
  };
  state.loans.push(created);
  const summary = computeLoansSummary(state);
  const createdView = summary.loans.find((l) => l.id === newId) || created;
  return fulfillJson(route, 201, createdView);
}

export async function registerLoanRoutes(page: Page, state: MockApiState): Promise<void> {
  await page.route(/\/api\/loans(\/\d+)?(\?.*)?$/, (route) => {
    const method = route.request().method();
    if (method === 'GET') return fulfillJson(route, 200, computeLoansSummary(state));
    if (method === 'POST') return handleCreateLoan(route, state);
    if (method === 'DELETE') {
      const match = route.request().url().match(/\/api\/loans\/(\d+)/);
      const delId = match ? Number(match[1]) : -1;
      const idx = state.loans.findIndex((l) => l.id === delId);
      if (idx >= 0) state.loans.splice(idx, 1);
      return route.fulfill({ status: 204, body: '' });
    }
    return route.continue();
  });
}
