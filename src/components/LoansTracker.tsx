import React, { useState } from 'react';
import { CalendarClock, Car, Landmark, Plus, Trash2 } from 'lucide-react';
import {
  AlertBanner,
  Button,
  CollapsibleSection,
  EmptyState,
  FormField,
  GlassCard,
  ProgressBar,
  SectionHeader,
  SegmentedControl,
  StatusBadge,
  TextInput,
} from '@yggdrasil-lab/ui';
import { createLoan, deleteLoan } from '../transport';
import { LoanCreatePayload, LoanItem, LoansSummaryResponse, LoanType } from '../types';
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

type LoanFormState = typeof DEFAULT_LOAN_FORM;

function buildLoanPayload(
  form: LoanFormState,
  setError: (msg: string | null) => void
): LoanCreatePayload | null {
  const isLentForm = form.loan_type === 'lent';
  const principal = parseFloat(form.principal_amount);
  const ratePct = form.annual_interest_pct.trim() ? parseFloat(form.annual_interest_pct) : 0;
  const term = form.term_months.trim() ? parseInt(form.term_months, 10) : 0;
  const monthly = form.monthly_payment.trim() ? parseFloat(form.monthly_payment) : 0;
  const assetVal = !isLentForm && form.asset_value.trim() ? parseFloat(form.asset_value) : null;

  if (isLentForm) {
    if (!form.name.trim() || !form.lender.trim() || isNaN(principal) || principal <= 0) {
      setError('Please fill in loan name, borrower, and principal amount.');
      return null;
    }
  } else if (!form.name.trim() || !form.lender.trim() || isNaN(principal) || isNaN(monthly) || isNaN(term)) {
    setError('Please fill in loan name, lender, principal, term, and monthly payment.');
    return null;
  }

  return {
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
}

function nextFormForLoanType(prev: LoanFormState, nextType: LoanType): LoanFormState {
  return {
    ...prev,
    loan_type: nextType,
    annual_interest_pct: nextType === 'lent' ? '0' : prev.annual_interest_pct === '0' ? '9.62' : prev.annual_interest_pct,
    term_months: nextType === 'lent' ? '0' : prev.term_months === '0' ? '36' : prev.term_months,
    monthly_payment: nextType === 'lent' ? '0' : prev.monthly_payment === '0' ? '' : prev.monthly_payment,
    asset_value: nextType === 'lent' ? '' : prev.asset_value,
  };
}

const LoanCreateFields: React.FC<{
  form: LoanFormState;
  isLent: boolean;
  onChange: React.Dispatch<React.SetStateAction<LoanFormState>>;
}> = ({ form, isLent, onChange }) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
    <FormField label="Loan Name" required>
      <TextInput type="text" placeholder={isLent ? 'Loan Name (e.g. Loan to Brother)' : 'Loan Name (e.g. Toyota Corolla Cross)'} value={form.name} onChange={(e) => onChange((p) => ({ ...p, name: e.target.value }))} variant="brand" required />
    </FormField>
    <FormField label={isLent ? 'Borrower' : 'Lender'} required>
      <TextInput type="text" placeholder={isLent ? 'Borrower (e.g. Brother)' : 'Lender (e.g. Toyota Financial Services)'} aria-label={isLent ? 'Borrower' : 'Lender'} value={form.lender} onChange={(e) => onChange((p) => ({ ...p, lender: e.target.value }))} variant="brand" required />
    </FormField>
    <FormField label="Principal (NZD)" required>
      <TextInput type="number" step="0.01" placeholder="Principal NZD (e.g. 45399.42)" value={form.principal_amount} onChange={(e) => onChange((p) => ({ ...p, principal_amount: e.target.value }))} variant="brand" className="font-mono" required />
    </FormField>
    <FormField label="Monthly Payment (NZD)" required={!isLent}>
      <TextInput type="number" step="0.01" placeholder={isLent ? 'Monthly Payment NZD (optional, default 0)' : 'Monthly Payment NZD (e.g. 1452.42)'} value={form.monthly_payment} onChange={(e) => onChange((p) => ({ ...p, monthly_payment: e.target.value }))} variant="brand" className="font-mono" required={!isLent} />
    </FormField>
    <FormField label="Interest (% p.a.)" required={!isLent}>
      <TextInput type="number" step="0.01" placeholder={isLent ? 'Interest % p.a. (optional, default 0)' : 'Interest % p.a. (e.g. 9.62)'} value={form.annual_interest_pct} onChange={(e) => onChange((p) => ({ ...p, annual_interest_pct: e.target.value }))} variant="brand" className="font-mono" required={!isLent} />
    </FormField>
    <FormField label="Term (Months)" required={!isLent}>
      <TextInput type="number" min={isLent ? '0' : '1'} placeholder={isLent ? 'Term Months (optional, default 0)' : 'Term Months (e.g. 36)'} value={form.term_months} onChange={(e) => onChange((p) => ({ ...p, term_months: e.target.value }))} variant="brand" className="font-mono" required={!isLent} />
    </FormField>
    <FormField label="Start Date" required>
      <TextInput type="date" value={form.start_date} onChange={(e) => onChange((p) => ({ ...p, start_date: e.target.value }))} variant="brand" className="font-mono" required />
    </FormField>
    {!isLent && (
      <FormField label="Asset Value (NZD, optional)">
        <TextInput type="number" step="0.01" placeholder="Asset Value NZD (optional, e.g. 55000)" value={form.asset_value} onChange={(e) => onChange((p) => ({ ...p, asset_value: e.target.value }))} variant="brand" className="font-mono" />
      </FormField>
    )}
  </div>
);

const LoanCreateForm: React.FC<{
  form: LoanFormState;
  saving: boolean;
  onChange: React.Dispatch<React.SetStateAction<LoanFormState>>;
  onSubmit: (e: React.FormEvent) => void;
}> = ({ form, saving, onChange, onSubmit }) => (
  <form onSubmit={onSubmit} className="p-3.5 rounded-xl bg-background/60 border border-amber-500/30 space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <span className="text-[11px] text-slate-300 font-medium">Loan Type</span>
      <SegmentedControl<LoanType>
        idPrefix="loan-type"
        variant="brand"
        size="xs"
        value={form.loan_type}
        onChange={(nextType) => onChange((prev) => nextFormForLoanType(prev, nextType))}
        options={[{ id: 'borrowed', label: 'I Owe' }, { id: 'lent', label: 'Owed to Me' }]}
      />
    </div>
    <LoanCreateFields form={form} isLent={form.loan_type === 'lent'} onChange={onChange} />
    <div className="flex justify-end">
      <Button variant="primary" size="xs" type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save Loan'}</Button>
    </div>
  </form>
);

const LoanPaymentRow: React.FC<{
  payment: NonNullable<LoanItem['linked_payments']>[number];
  isLent: boolean;
}> = ({ payment, isLent }) => {
  const rawAmt = Math.abs(Number(payment.amount));
  const appliedAmt =
    payment.applied_amount != null
      ? Number(payment.applied_amount)
      : payment.loan_payment_amount != null
        ? Number(payment.loan_payment_amount)
        : rawAmt;
  const isPartial =
    payment.loan_payment_amount != null ||
    (payment.applied_amount != null && Math.abs(appliedAmt - rawAmt) > 0.005);

  return (
    <div data-testid={`loan-payment-row-${payment.id}`} className="flex items-center justify-between gap-2 p-2 rounded-lg bg-slate-900/60 border border-border/60 text-[11px]">
      <div className="min-w-0 flex-1 space-y-0.5">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-mono text-[10px] text-slate-400 whitespace-nowrap">{payment.transaction_date}</span>
          {Boolean(payment.account_name) && (
            <StatusBadge variant="idle" size="xs" showDot={false} label={payment.account_name!} className="max-w-[140px]" />
          )}
        </div>
        <div className="font-medium text-slate-200 truncate" title={payment.merchant}>{payment.merchant}</div>
      </div>
      <div className="text-right shrink-0">
        <div className={`font-mono font-semibold whitespace-nowrap ${isLent ? 'text-emerald-400' : 'text-rose-400'}`}>
          {formatMoney(appliedAmt, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {payment.currency}
        </div>
        {isPartial && (
          <div className="text-[10px] font-mono text-slate-400 whitespace-nowrap">
            of {formatMoney(rawAmt, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        )}
      </div>
    </div>
  );
};

const LoanLinkedEntries: React.FC<{ loan: LoanItem; isLent: boolean }> = ({ loan, isLent }) => {
  const linkedPayments = loan.linked_payments || [];
  const disbursements = loan.disbursements || [];
  const hasEntries = linkedPayments.length > 0 || disbursements.length > 0;
  const title = isLent ? `Linked Repayments (${linkedPayments.length})` : `Linked Payments (${linkedPayments.length})`;

  return (
    <CollapsibleSection variant="inline" title={title} className="pt-1 border-border/50">
      <div data-testid={`loan-payments-list-${loan.id}`} className="space-y-1.5">
        {!hasEntries ? (
          <div className="p-2.5 rounded-lg bg-slate-900/50 border border-dashed border-border/70 text-[11px] text-slate-400">
            {isLent
              ? 'No repayment or disbursement transactions linked yet. Categorize inflows or outflows as Debt & Loans and link them to this receivable.'
              : 'No bank statement payments linked yet. Link an outflow transaction or create a categorization rule targeting this loan.'}
          </div>
        ) : (
          <>
            {linkedPayments.map((payment) => (
              <LoanPaymentRow key={`${payment.id}-${payment.split_id ?? 'tx'}`} payment={payment} isLent={isLent} />
            ))}
            {disbursements.map((disb) => (
              <div key={`disb-${disb.id}`} data-testid={`loan-disbursement-row-${disb.id}`} className="flex items-center justify-between gap-2 p-2 rounded-lg bg-amber-950/20 border border-amber-500/25 text-[11px]">
                <div className="min-w-0 flex-1 space-y-0.5">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-mono text-[10px] text-slate-400 whitespace-nowrap">{disb.transaction_date}</span>
                    <StatusBadge variant="warning" size="xs" showDot={false} label="Disbursement" />
                    {Boolean(disb.account_name) && <StatusBadge variant="idle" size="xs" showDot={false} label={disb.account_name!} className="max-w-[140px]" />}
                  </div>
                  <div className="font-medium text-slate-200 truncate" title={disb.merchant}>{disb.merchant}</div>
                </div>
                <span className="font-mono font-semibold text-amber-300 whitespace-nowrap shrink-0">
                  {formatMoney(Math.abs(Number(disb.amount)), { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {disb.currency}
                </span>
              </div>
            ))}
          </>
        )}
      </div>
    </CollapsibleSection>
  );
};

const LoanMetricsSummary: React.FC<{ loan: LoanItem; isLent: boolean }> = ({ loan, isLent }) => {
  if (isLent) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px]">
        <div>
          <div className="text-slate-400">Remaining Owed</div>
          <div className="font-mono font-semibold text-emerald-400 whitespace-nowrap">
            {formatMoney(loan.remaining_principal, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {loan.currency}
          </div>
        </div>
        <div>
          <div className="text-slate-400">Repaid</div>
          <div className="font-mono font-semibold text-slate-200 flex flex-wrap items-baseline gap-x-1">
            <span className="whitespace-nowrap">{formatMoney(loan.principal_paid, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>{' '}
            <span className="text-slate-400 font-normal whitespace-nowrap">
              / {formatMoney(loan.principal_amount, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {loan.currency}
            </span>
          </div>
        </div>
        <div>
          <div className="text-slate-400">Lent Date</div>
          <div className="font-mono font-semibold text-slate-300 whitespace-nowrap">{loan.start_date}</div>
        </div>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
      <div>
        <div className="text-slate-400">Remaining Debt</div>
        <div className="font-mono font-semibold text-rose-400 whitespace-nowrap">
          {formatMoney(loan.remaining_principal, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {loan.currency}
        </div>
      </div>
      <div>
        <div className="text-slate-400">Payment</div>
        <div className="font-mono font-semibold text-slate-200 whitespace-nowrap">
          {formatMoney(loan.monthly_payment, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {loan.currency}/mo
        </div>
      </div>
      <div>
        <div className="text-slate-400">Payoff Date</div>
        <div className="font-mono font-semibold text-emerald-300 whitespace-nowrap">{loan.payoff_date || 'N/A'}</div>
      </div>
      <div>
        <div className="text-slate-400">Net Worth Effect</div>
        <div className={`font-mono font-semibold whitespace-nowrap ${loan.net_worth_impact >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
          {formatMoney(loan.net_worth_impact, { minimumFractionDigits: 2, maximumFractionDigits: 2, showPlusSign: true })} {loan.currency}
        </div>
      </div>
    </div>
  );
};

const LoanCard: React.FC<{ loan: LoanItem; onDelete: (id: number) => void }> = ({ loan, onDelete }) => {
  const isLent = loan.loan_type === 'lent';
  const pctPaid = loan.principal_amount > 0 ? Math.min(100, Math.round((loan.principal_paid / loan.principal_amount) * 100)) : 0;

  return (
    <div
      data-testid={`loan-card-${loan.id}`}
      className={`p-3.5 rounded-xl bg-background/50 border space-y-2.5 ${isLent ? 'border-emerald-500/25' : 'border-border/70'}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            {isLent ? <Landmark className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> : <Car className="w-3.5 h-3.5 text-rose-400 shrink-0" />}
            <span className="text-xs font-semibold text-slate-100">{loan.name}</span>
          </div>
          <div className="text-[11px] text-slate-400">
            {isLent
              ? `Borrower: ${loan.lender}${loan.annual_interest_rate > 0 ? ` · ${(loan.annual_interest_rate * 100).toFixed(2)}% p.a.` : ''}`
              : `${loan.lender} · ${(loan.annual_interest_rate * 100).toFixed(2)}% p.a.`}
          </div>
        </div>
        <button type="button" onClick={() => onDelete(loan.id)} className="p-1 text-slate-500 hover:text-rose-400 transition-colors shrink-0" title="Delete loan">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {isLent ? (
          <>
            <StatusBadge variant="success" size="xs" showDot={false} label="Owed to Me" />
            <StatusBadge variant="idle" size="xs" showDot={false} label={`${pctPaid}% repaid`} className="font-mono" />
          </>
        ) : (
          <>
            <StatusBadge variant="success" size="xs" showDot={false} label={`${loan.payments_made}/${loan.term_months} posted`} className="font-mono" />
            <StatusBadge variant="warning" size="xs" icon={<CalendarClock className="w-3 h-3" />} label={`${loan.payments_remaining}/${loan.term_months} left`} className="font-mono" />
            {Boolean(loan.is_payment_due) && (
              <span data-testid={`loan-due-badge-${loan.id}`}>
                <StatusBadge variant="warning" size="xs" showDot={false} label={`Due ${loan.next_payment_date || 'now'}`} className="font-mono" />
              </span>
            )}
          </>
        )}
      </div>

      <ProgressBar value={pctPaid} tone="emerald" size="sm" label={`${loan.name} payoff progress`} />
      <LoanMetricsSummary loan={loan} isLent={isLent} />
      <LoanLinkedEntries loan={loan} isLent={isLent} />
    </div>
  );
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
    const payload = buildLoanPayload(form, setError);
    if (!payload) return;
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
        <SectionHeader
          title="Financing & Loans"
          subtitle="Payment countdown, remaining balance, and Net Worth impact"
          icon={<Car className="w-4 h-4" />}
          variant="rose"
          actions={
            <>
              {(summary?.total_receivables || 0) > 0 && (
                <span data-testid="loans-receivables-pill">
                  <StatusBadge
                    variant="success"
                    size="xs"
                    showDot={false}
                    className="font-mono font-medium"
                    label={`Owed to Me: ${formatMoney(Number(summary?.total_receivables || 0), { minimumFractionDigits: 2, maximumFractionDigits: 2 })} NZD`}
                  />
                </span>
              )}
              <Button variant="outline" size="xs" icon={<Plus className="w-3.5 h-3.5" />} onClick={() => setShowForm((v) => !v)} data-testid="add-loan-toggle-btn">
                {showForm ? 'Cancel' : 'Add Loan'}
              </Button>
            </>
          }
        />

        {error && <AlertBanner variant="error">{error}</AlertBanner>}
        {showForm && <LoanCreateForm form={form} saving={saving} onChange={setForm} onSubmit={(e) => void handleCreate(e)} />}

        {loans.length === 0 ? (
          <EmptyState title="No active financing or loans" description="Add a car loan or installment plan to track its payoff countdown and Net Worth impact." variant="dashed" />
        ) : (
          <div className="space-y-3">
            {loans.map((loan) => (
              <LoanCard key={loan.id} loan={loan} onDelete={(id) => void handleDelete(id)} />
            ))}
          </div>
        )}
      </GlassCard>
    </div>
  );
};
