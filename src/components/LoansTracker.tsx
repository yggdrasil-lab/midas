import React, { useState } from 'react';
import { CalendarClock, Car, ChevronDown, ChevronUp, Landmark, Plus, Trash2 } from 'lucide-react';
import { Button, EmptyState, GlassCard, SegmentedControl } from '@yggdrasil-lab/ui';
import { createLoan, deleteLoan } from '../services/api';
import { LoanCreatePayload, LoansSummaryResponse, LoanType } from '../types';
import { formatMoney } from '../utils/format';

interface LoansTrackerProps {
  summary: LoansSummaryResponse | null;
  onChanged: () => void;
}

const DEFAULT_LOAN_FORM = {
  loan_type: 'borrowed' as LoanType,
  name: '',
  lender: '',
  principal_amount: '',
  annual_interest_pct: '9.62',
  term_months: '36',
  monthly_payment: '',
  start_date: new Date().toISOString().slice(0, 10),
  asset_value: '',
};

/**
 * Displays active financed loans with payment countdown, remaining principal,
 * interest cost, and net worth impact.
 */
export const LoansTracker: React.FC<LoansTrackerProps> = ({ summary, onChanged }) => {
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(DEFAULT_LOAN_FORM);
  const [expandedLoanIds, setExpandedLoanIds] = useState<Record<number, boolean>>({});

  const togglePayments = (loanId: number) => {
    setExpandedLoanIds((prev) => ({ ...prev, [loanId]: !prev[loanId] }));
  };

  const loans = summary?.loans || [];

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const isLentForm = form.loan_type === 'lent';
    const principal = parseFloat(form.principal_amount);
    const ratePct = form.annual_interest_pct.trim() ? parseFloat(form.annual_interest_pct) : 0;
    const term = form.term_months.trim() ? parseInt(form.term_months, 10) : 0;
    const monthly = form.monthly_payment.trim() ? parseFloat(form.monthly_payment) : 0;
    const assetVal =
      !isLentForm && form.asset_value.trim() ? parseFloat(form.asset_value) : null;

    if (isLentForm) {
      if (!form.name.trim() || !form.lender.trim() || isNaN(principal) || principal <= 0) {
        setError('Please fill in loan name, borrower, and principal amount.');
        return;
      }
    } else if (
      !form.name.trim() ||
      !form.lender.trim() ||
      isNaN(principal) ||
      isNaN(monthly) ||
      isNaN(term)
    ) {
      setError('Please fill in loan name, lender, principal, term, and monthly payment.');
      return;
    }

    const payload: LoanCreatePayload = {
      name: form.name.trim(),
      lender: form.lender.trim(),
      loan_type: form.loan_type,
      principal_amount: principal,
      annual_interest_rate: (isNaN(ratePct) ? 0 : ratePct) / 100,
      term_months: isNaN(term) ? 0 : term,
      monthly_payment: isNaN(monthly) ? 0 : monthly,
      start_date: form.start_date,
      asset_value: assetVal !== null && !isNaN(assetVal) ? assetVal : null,
      currency: 'NZD',
    };

    setSaving(true);
    try {
      await createLoan(payload);
      setForm(DEFAULT_LOAN_FORM);
      setShowForm(false);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save loan');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteLoan(id);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove loan');
    }
  };

  return (
    <div data-testid="loans-tracker-panel">
      <GlassCard className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center space-x-2 min-w-0">
          <div className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20 shrink-0">
            <Car className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-slate-200">Financing & Loans</h3>
            <p className="text-xs text-slate-400">
              Payment countdown, remaining balance, and Net Worth impact
            </p>
          </div>
        </div>
        <div className="flex items-center flex-wrap gap-2">
          {(summary?.total_receivables || 0) > 0 && (
            <span
              data-testid="loans-receivables-pill"
              className="inline-flex items-center px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-300 border border-emerald-500/25 text-[11px] font-mono font-medium whitespace-nowrap"
            >
              Owed to Me:{' '}
              {formatMoney(Number(summary?.total_receivables || 0), {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}{' '}
              NZD
            </span>
          )}
          <Button
            variant="outline"
            size="xs"
            icon={<Plus className="w-3.5 h-3.5" />}
            onClick={() => setShowForm((v) => !v)}
            data-testid="add-loan-toggle-btn"
          >
            {showForm ? 'Cancel' : 'Add Loan'}
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300">
          {error}
        </div>
      )}

      {showForm && (
        <form
          onSubmit={handleCreate}
          className="p-3.5 rounded-xl bg-background/60 border border-amber-500/30 space-y-3"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[11px] text-slate-300 font-medium">Loan Type</span>
            <SegmentedControl<LoanType>
              idPrefix="loan-type"
              variant="amber"
              size="xs"
              value={form.loan_type}
              onChange={(nextType) =>
                setForm((prev) => ({
                  ...prev,
                  loan_type: nextType,
                  annual_interest_pct:
                    nextType === 'lent'
                      ? '0'
                      : prev.annual_interest_pct === '0'
                        ? '9.62'
                        : prev.annual_interest_pct,
                  term_months:
                    nextType === 'lent'
                      ? '0'
                      : prev.term_months === '0'
                        ? '36'
                        : prev.term_months,
                  monthly_payment:
                    nextType === 'lent'
                      ? '0'
                      : prev.monthly_payment === '0'
                        ? ''
                        : prev.monthly_payment,
                  asset_value: nextType === 'lent' ? '' : prev.asset_value,
                }))
              }
              options={[
                { id: 'borrowed', label: 'I Owe' },
                { id: 'lent', label: 'Owed to Me' },
              ]}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <input
              type="text"
              placeholder={
                form.loan_type === 'lent'
                  ? 'Loan Name (e.g. Loan to Brother)'
                  : 'Loan Name (e.g. Toyota Corolla Cross)'
              }
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              className="text-base sm:text-xs px-2.5 py-1.5 bg-background border border-border rounded-lg text-slate-200"
              required
            />
            <input
              type="text"
              placeholder={
                form.loan_type === 'lent'
                  ? 'Borrower (e.g. Brother)'
                  : 'Lender (e.g. Toyota Financial Services)'
              }
              aria-label={form.loan_type === 'lent' ? 'Borrower' : 'Lender'}
              value={form.lender}
              onChange={(e) => setForm((p) => ({ ...p, lender: e.target.value }))}
              className="text-base sm:text-xs px-2.5 py-1.5 bg-background border border-border rounded-lg text-slate-200"
              required
            />
            <input
              type="number"
              step="0.01"
              placeholder="Principal NZD (e.g. 45399.42)"
              value={form.principal_amount}
              onChange={(e) => setForm((p) => ({ ...p, principal_amount: e.target.value }))}
              className="text-base sm:text-xs px-2.5 py-1.5 bg-background border border-border rounded-lg text-slate-200 font-mono"
              required
            />
            <input
              type="number"
              step="0.01"
              placeholder={
                form.loan_type === 'lent'
                  ? 'Monthly Payment NZD (optional, default 0)'
                  : 'Monthly Payment NZD (e.g. 1452.42)'
              }
              value={form.monthly_payment}
              onChange={(e) => setForm((p) => ({ ...p, monthly_payment: e.target.value }))}
              className="text-base sm:text-xs px-2.5 py-1.5 bg-background border border-border rounded-lg text-slate-200 font-mono"
              required={form.loan_type !== 'lent'}
            />
            <input
              type="number"
              step="0.01"
              placeholder={
                form.loan_type === 'lent'
                  ? 'Interest % p.a. (optional, default 0)'
                  : 'Interest % p.a. (e.g. 9.62)'
              }
              value={form.annual_interest_pct}
              onChange={(e) => setForm((p) => ({ ...p, annual_interest_pct: e.target.value }))}
              className="text-base sm:text-xs px-2.5 py-1.5 bg-background border border-border rounded-lg text-slate-200 font-mono"
              required={form.loan_type !== 'lent'}
            />
            <input
              type="number"
              min={form.loan_type === 'lent' ? '0' : '1'}
              placeholder={
                form.loan_type === 'lent'
                  ? 'Term Months (optional, default 0)'
                  : 'Term Months (e.g. 36)'
              }
              value={form.term_months}
              onChange={(e) => setForm((p) => ({ ...p, term_months: e.target.value }))}
              className="text-base sm:text-xs px-2.5 py-1.5 bg-background border border-border rounded-lg text-slate-200 font-mono"
              required={form.loan_type !== 'lent'}
            />
            <input
              type="date"
              value={form.start_date}
              onChange={(e) => setForm((p) => ({ ...p, start_date: e.target.value }))}
              className="text-base sm:text-xs px-2.5 py-1.5 bg-background border border-border rounded-lg text-slate-200 font-mono"
              required
            />
            {form.loan_type !== 'lent' && (
              <input
                type="number"
                step="0.01"
                placeholder="Asset Value NZD (optional, e.g. 55000)"
                value={form.asset_value}
                onChange={(e) => setForm((p) => ({ ...p, asset_value: e.target.value }))}
                className="text-base sm:text-xs px-2.5 py-1.5 bg-background border border-border rounded-lg text-slate-200 font-mono"
              />
            )}
          </div>
          <div className="flex justify-end">
            <Button variant="primary" size="xs" type="submit" disabled={saving}>
              {saving ? 'Saving...' : 'Save Loan'}
            </Button>
          </div>
        </form>
      )}

      {loans.length === 0 ? (
        <EmptyState
          title="No active financing or loans"
          description="Add a car loan or installment plan to track its payoff countdown and Net Worth impact."
          variant="dashed"
        />
      ) : (
        <div className="space-y-3">
          {loans.map((loan) => {
            const isLent = loan.loan_type === 'lent';
            const pctPaid =
              loan.principal_amount > 0
                ? Math.min(100, Math.round((loan.principal_paid / loan.principal_amount) * 100))
                : 0;
            const linkedPayments = loan.linked_payments || [];
            const disbursements = loan.disbursements || [];
            const hasEntries = linkedPayments.length > 0 || disbursements.length > 0;
            const isExpanded = Boolean(expandedLoanIds[loan.id]);
            return (
              <div
                key={loan.id}
                data-testid={`loan-card-${loan.id}`}
                className={`p-3.5 rounded-xl bg-background/50 border space-y-2.5 ${
                  isLent ? 'border-emerald-500/25' : 'border-border/70'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {isLent ? (
                        <Landmark className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      ) : (
                        <Car className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                      )}
                      <span className="text-xs font-semibold text-slate-100">{loan.name}</span>
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {isLent
                        ? `Borrower: ${loan.lender}${
                            loan.annual_interest_rate > 0
                              ? ` · ${(loan.annual_interest_rate * 100).toFixed(2)}% p.a.`
                              : ''
                          }`
                        : `${loan.lender} · ${(loan.annual_interest_rate * 100).toFixed(2)}% p.a.`}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleDelete(loan.id)}
                    className="p-1 text-slate-500 hover:text-rose-400 transition-colors shrink-0"
                    title="Delete loan"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  {isLent ? (
                    <>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-[10px] font-medium whitespace-nowrap">
                        Owed to Me
                      </span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-800/80 text-slate-300 border border-slate-700 text-[10px] font-mono whitespace-nowrap">
                        {pctPaid}% repaid
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 text-[10px] font-mono whitespace-nowrap">
                        {loan.payments_made}/{loan.term_months} posted
                      </span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-300 border border-amber-500/20 text-[10px] font-mono whitespace-nowrap">
                        <CalendarClock className="w-3 h-3 shrink-0" />
                        {loan.payments_remaining}/{loan.term_months} left
                      </span>
                      {Boolean(loan.is_payment_due) && (
                        <span
                          data-testid={`loan-due-badge-${loan.id}`}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-200 border border-amber-500/35 text-[10px] font-mono whitespace-nowrap"
                        >
                          Due {loan.next_payment_date || 'now'}
                        </span>
                      )}
                    </>
                  )}
                </div>

                <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 transition-all"
                    style={{ width: `${pctPaid}%` }}
                  />
                </div>

                {isLent ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px]">
                    <div>
                      <div className="text-slate-400">Remaining Owed</div>
                      <div className="font-mono font-semibold text-emerald-400 whitespace-nowrap">
                        {formatMoney(loan.remaining_principal, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}{' '}
                        {loan.currency}
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-400">Repaid</div>
                      <div className="font-mono font-semibold text-slate-200 flex flex-wrap items-baseline gap-x-1">
                        <span className="whitespace-nowrap">
                          {formatMoney(loan.principal_paid, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </span>{' '}
                        <span className="text-slate-400 font-normal whitespace-nowrap">
                          /{' '}
                          {formatMoney(loan.principal_amount, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}{' '}
                          {loan.currency}
                        </span>
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-400">Lent Date</div>
                      <div className="font-mono font-semibold text-slate-300 whitespace-nowrap">
                        {loan.start_date}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                    <div>
                      <div className="text-slate-400">Remaining Debt</div>
                      <div className="font-mono font-semibold text-rose-400 whitespace-nowrap">
                        {formatMoney(loan.remaining_principal, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}{' '}
                        {loan.currency}
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-400">Payment</div>
                      <div className="font-mono font-semibold text-slate-200 whitespace-nowrap">
                        {formatMoney(loan.monthly_payment, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}{' '}
                        {loan.currency}/mo
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-400">Payoff Date</div>
                      <div className="font-mono font-semibold text-emerald-300 whitespace-nowrap">
                        {loan.payoff_date || 'N/A'}
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-400">Net Worth Effect</div>
                      <div
                        className={`font-mono font-semibold whitespace-nowrap ${
                          loan.net_worth_impact >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {formatMoney(loan.net_worth_impact, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                          showPlusSign: true,
                        })}{' '}
                        {loan.currency}
                      </div>
                    </div>
                  </div>
                )}

                <div className="pt-1 border-t border-border/50">
                  <button
                    type="button"
                    onClick={() => togglePayments(loan.id)}
                    aria-expanded={isExpanded}
                    data-testid={`loan-payments-toggle-${loan.id}`}
                    className="w-full flex items-center justify-between text-[11px] text-slate-300 hover:text-amber-300 py-1 transition-colors cursor-pointer"
                  >
                    <span className="font-medium">
                      {isLent
                        ? `Linked Repayments (${linkedPayments.length})`
                        : `Linked Payments (${linkedPayments.length})`}
                    </span>
                    {isExpanded ? (
                      <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                    )}
                  </button>

                  {isExpanded && (
                    <div
                      data-testid={`loan-payments-list-${loan.id}`}
                      className="mt-2 space-y-1.5"
                    >
                      {!hasEntries ? (
                        <div className="p-2.5 rounded-lg bg-slate-900/50 border border-dashed border-border/70 text-[11px] text-slate-400">
                          {isLent
                            ? 'No repayment or disbursement transactions linked yet. Categorize inflows or outflows as Debt & Loans and link them to this receivable.'
                            : 'No bank statement payments linked yet. Link an outflow transaction or create a categorization rule targeting this loan.'}
                        </div>
                      ) : (
                        <>
                          {linkedPayments.map((payment) => {
                            const rawAmt = Math.abs(Number(payment.amount));
                            const appliedAmt =
                              payment.applied_amount != null
                                ? Number(payment.applied_amount)
                                : payment.loan_payment_amount != null
                                  ? Number(payment.loan_payment_amount)
                                  : rawAmt;
                            const isPartial =
                              payment.loan_payment_amount != null ||
                              (payment.applied_amount != null &&
                                Math.abs(appliedAmt - rawAmt) > 0.005);
                            return (
                              <div
                                key={payment.id}
                                data-testid={`loan-payment-row-${payment.id}`}
                                className="flex items-center justify-between gap-2 p-2 rounded-lg bg-slate-900/60 border border-border/60 text-[11px]"
                              >
                                <div className="min-w-0 flex-1 space-y-0.5">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="font-mono text-[10px] text-slate-400 whitespace-nowrap">
                                      {payment.transaction_date}
                                    </span>
                                    {Boolean(payment.account_name) && (
                                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 border border-slate-700 truncate max-w-[140px]">
                                        {payment.account_name}
                                      </span>
                                    )}
                                  </div>
                                  <div
                                    className="font-medium text-slate-200 truncate"
                                    title={payment.merchant}
                                  >
                                    {payment.merchant}
                                  </div>
                                </div>
                                <div className="text-right shrink-0">
                                  <div
                                    className={`font-mono font-semibold whitespace-nowrap ${
                                      isLent ? 'text-emerald-400' : 'text-rose-400'
                                    }`}
                                  >
                                    {formatMoney(appliedAmt, {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2,
                                    })}{' '}
                                    {payment.currency}
                                  </div>
                                  {isPartial && (
                                    <div className="text-[10px] font-mono text-slate-400 whitespace-nowrap">
                                      of{' '}
                                      {formatMoney(rawAmt, {
                                        minimumFractionDigits: 2,
                                        maximumFractionDigits: 2,
                                      })}
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                          {disbursements.map((disb) => (
                            <div
                              key={`disb-${disb.id}`}
                              data-testid={`loan-disbursement-row-${disb.id}`}
                              className="flex items-center justify-between gap-2 p-2 rounded-lg bg-amber-950/20 border border-amber-500/25 text-[11px]"
                            >
                              <div className="min-w-0 flex-1 space-y-0.5">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-mono text-[10px] text-slate-400 whitespace-nowrap">
                                    {disb.transaction_date}
                                  </span>
                                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 font-medium whitespace-nowrap">
                                    Disbursement
                                  </span>
                                  {Boolean(disb.account_name) && (
                                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 border border-slate-700 truncate max-w-[140px]">
                                      {disb.account_name}
                                    </span>
                                  )}
                                </div>
                                <div
                                  className="font-medium text-slate-200 truncate"
                                  title={disb.merchant}
                                >
                                  {disb.merchant}
                                </div>
                              </div>
                              <span className="font-mono font-semibold text-amber-300 whitespace-nowrap shrink-0">
                                {formatMoney(Math.abs(Number(disb.amount)), {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}{' '}
                                {disb.currency}
                              </span>
                            </div>
                          ))}
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </GlassCard>
    </div>
  );
};
