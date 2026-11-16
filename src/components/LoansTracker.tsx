import React, { useState } from 'react';
import { CalendarClock, Car, Plus, Trash2 } from 'lucide-react';
import { Button, EmptyState, GlassCard } from '@yggdrasil-lab/ui';
import { createLoan, deleteLoan } from '../services/api';
import { LoanCreatePayload, LoansSummaryResponse } from '../types';
import { formatMoney } from '../utils/format';

interface LoansTrackerProps {
  summary: LoansSummaryResponse | null;
  onChanged: () => void;
}

const DEFAULT_LOAN_FORM = {
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

  const loans = summary?.loans || [];

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const principal = parseFloat(form.principal_amount);
    const ratePct = parseFloat(form.annual_interest_pct);
    const term = parseInt(form.term_months, 10);
    const monthly = parseFloat(form.monthly_payment);
    const assetVal = form.asset_value.trim() ? parseFloat(form.asset_value) : null;

    if (!form.name.trim() || !form.lender.trim() || isNaN(principal) || isNaN(monthly) || isNaN(term)) {
      setError('Please fill in loan name, lender, principal, term, and monthly payment.');
      return;
    }

    const payload: LoanCreatePayload = {
      name: form.name.trim(),
      lender: form.lender.trim(),
      principal_amount: principal,
      annual_interest_rate: (isNaN(ratePct) ? 0 : ratePct) / 100,
      term_months: term,
      monthly_payment: monthly,
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
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center space-x-2">
          <div className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <Car className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-200">Financing & Loans</h3>
            <p className="text-xs text-slate-400">
              Payment countdown, remaining balance, and Net Worth impact
            </p>
          </div>
        </div>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <input
              type="text"
              placeholder="Loan Name (e.g. Toyota Corolla Cross)"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              className="text-base sm:text-xs px-2.5 py-1.5 bg-background border border-border rounded-lg text-slate-200"
              required
            />
            <input
              type="text"
              placeholder="Lender (e.g. Toyota Financial Services)"
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
              placeholder="Monthly Payment NZD (e.g. 1452.42)"
              value={form.monthly_payment}
              onChange={(e) => setForm((p) => ({ ...p, monthly_payment: e.target.value }))}
              className="text-base sm:text-xs px-2.5 py-1.5 bg-background border border-border rounded-lg text-slate-200 font-mono"
              required
            />
            <input
              type="number"
              step="0.01"
              placeholder="Interest % p.a. (e.g. 9.62)"
              value={form.annual_interest_pct}
              onChange={(e) => setForm((p) => ({ ...p, annual_interest_pct: e.target.value }))}
              className="text-base sm:text-xs px-2.5 py-1.5 bg-background border border-border rounded-lg text-slate-200 font-mono"
              required
            />
            <input
              type="number"
              min="1"
              placeholder="Term Months (e.g. 36)"
              value={form.term_months}
              onChange={(e) => setForm((p) => ({ ...p, term_months: e.target.value }))}
              className="text-base sm:text-xs px-2.5 py-1.5 bg-background border border-border rounded-lg text-slate-200 font-mono"
              required
            />
            <input
              type="date"
              value={form.start_date}
              onChange={(e) => setForm((p) => ({ ...p, start_date: e.target.value }))}
              className="text-base sm:text-xs px-2.5 py-1.5 bg-background border border-border rounded-lg text-slate-200 font-mono"
              required
            />
            <input
              type="number"
              step="0.01"
              placeholder="Asset Value NZD (optional, e.g. 55000)"
              value={form.asset_value}
              onChange={(e) => setForm((p) => ({ ...p, asset_value: e.target.value }))}
              className="text-base sm:text-xs px-2.5 py-1.5 bg-background border border-border rounded-lg text-slate-200 font-mono"
            />
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
            const pctPaid =
              loan.principal_amount > 0
                ? Math.min(100, Math.round((loan.principal_paid / loan.principal_amount) * 100))
                : 0;
            return (
              <div
                key={loan.id}
                data-testid={`loan-card-${loan.id}`}
                className="p-3.5 rounded-xl bg-background/50 border border-border/70 space-y-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-xs font-semibold text-slate-100">{loan.name}</div>
                    <div className="text-[11px] text-slate-400">
                      {loan.lender} · {(loan.annual_interest_rate * 100).toFixed(2)}% p.a.
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-300 border border-amber-500/20 text-[10px] font-mono">
                      <CalendarClock className="w-3 h-3" />
                      {loan.payments_remaining}/{loan.term_months} left
                    </span>
                    <button
                      type="button"
                      onClick={() => void handleDelete(loan.id)}
                      className="p-1 text-slate-500 hover:text-rose-400 transition-colors"
                      title="Delete loan"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 transition-all"
                    style={{ width: `${pctPaid}%` }}
                  />
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                  <div>
                    <div className="text-slate-400">Remaining Debt</div>
                    <div className="font-mono font-semibold text-rose-400">
                      {formatMoney(loan.remaining_principal, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}{' '}
                      {loan.currency}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-400">Payment</div>
                    <div className="font-mono font-semibold text-slate-200">
                      {formatMoney(loan.monthly_payment, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}{' '}
                      {loan.currency}/mo
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-400">Payoff Date</div>
                    <div className="font-mono font-semibold text-emerald-300">
                      {loan.payoff_date}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-400">Net Worth Effect</div>
                    <div
                      className={`font-mono font-semibold ${
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
              </div>
            );
          })}
        </div>
      )}
    </GlassCard>
    </div>
  );
};
