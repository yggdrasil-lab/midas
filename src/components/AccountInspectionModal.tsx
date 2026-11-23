import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Building2, Check, Landmark, Lock, PlusCircle, TrendingUp, Wallet } from 'lucide-react';
import {
  AlertBanner,
  Button,
  Modal,
  SearchInput,
  StatusBadge,
  SummaryMetricGrid,
  SummaryMetricItem,
} from '@yggdrasil-lab/ui';
import { isTransferCategory } from '../constants/categories';
import { useCategories } from '../hooks/useCategories';
import { useTransactionCategoryMutation } from '../hooks/useTransactionCategoryMutation';
import { fetchAccounts, fetchAccountTransactions, fetchLoans } from '../services/api';
import { Account, LoanItem, PeriodType, Transaction } from '../types';
import {
  formatAccountSubtitle,
  formatMoney,
  formatNzdEquivalent,
  formatPrincipalRecoveredPct,
  formatSignedTransactionAmount,
} from '../utils/format';
import { collapsePairedTransfers } from '../utils/transfers';
import { getDefaultCustomRange, PeriodFilterBar } from './PeriodFilterBar';
import { RulesManagerModal } from './RulesManagerModal';
import { TransactionList } from './TransactionList';

interface AccountInspectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  account: Account | null;
  accounts?: Account[];
  period: PeriodType;
  onPeriodChange?: (period: PeriodType) => void;
  startDate?: string;
  endDate?: string;
  onStartDateChange?: (date: string) => void;
  onEndDateChange?: (date: string) => void;
  onTransactionCategoryChanged: () => void;
  onRecordSnapshotClick?: () => void;
  latestBalance?: number;
  latestBalanceNzd?: number;
}

const TIER_BADGE_MAP: Record<
  Account['tier'],
  { label: string; variant: 'success' | 'warning' | 'info'; icon: React.ReactNode }
> = {
  cash: { label: 'Cash Floor', variant: 'success', icon: <Wallet className="w-3 h-3" /> },
  growth: { label: 'Growth', variant: 'warning', icon: <TrendingUp className="w-3 h-3" /> },
  locked: { label: 'Locked', variant: 'info', icon: <Lock className="w-3 h-3" /> },
};

function computeAccountCashflow(collapsed: Transaction[], account: Account | null) {
  let totalSpend = 0;
  let totalIncome = 0;
  let totalTransfers = 0;
  for (const tx of collapsed) {
    if (account && tx.account_id !== account.id) continue;
    if (isTransferCategory(tx.category, tx)) totalTransfers += Math.abs(tx.amount);
    else if (tx.amount < 0) totalSpend += Math.abs(tx.amount);
    else if (tx.amount > 0) totalIncome += tx.amount;
  }
  return { totalSpend, totalIncome, totalTransfers };
}

function matchesAccountSearch(tx: Transaction, query: string): boolean {
  const q = query.trim().toLowerCase().replace(/^#+/, '');
  if (!q) return true;
  return (
    tx.merchant.toLowerCase().includes(q) ||
    tx.category.toLowerCase().includes(q) ||
    (tx.account_name || '').toLowerCase().includes(q) ||
    (tx.linked_account_name || '').toLowerCase().includes(q) ||
    (tx.counterpart_account_name || '').toLowerCase().includes(q) ||
    (tx.loan_name || '').toLowerCase().includes(q) ||
    (tx.raw_description || '').toLowerCase().includes(q) ||
    (tx.tags || []).some((tag) => tag.toLowerCase().includes(q)) ||
    (tx.splits || []).some(
      (s) =>
        s.category.toLowerCase().includes(q) ||
        (s.loan_name || '').toLowerCase().includes(q) ||
        (s.notes || '').toLowerCase().includes(q) ||
        (s.tags || []).some((tag) => tag.toLowerCase().includes(q))
    )
  );
}

function filterAccountTransactions(
  collapsed: Transaction[],
  categoryFilter: string | null,
  searchQuery: string
): Transaction[] {
  const catLower = categoryFilter ? categoryFilter.toLowerCase() : null;
  return collapsed.filter((tx) => {
    if (catLower) {
      const parentMatch = tx.category.toLowerCase() === catLower;
      const splitMatch = (tx.splits || []).some((s) => s.category.toLowerCase() === catLower);
      if (!parentMatch && !splitMatch) return false;
    }
    return matchesAccountSearch(tx, searchQuery);
  });
}

function buildAccountSummaryItems(params: {
  currentBalance?: number;
  displayCurrency: string;
  amountFormatOpts: { minimumFractionDigits: number; maximumFractionDigits: number };
  analytics: { totalSpend: number; totalIncome: number; totalTransfers: number };
}): SummaryMetricItem[] {
  const { currentBalance, displayCurrency, amountFormatOpts, analytics } = params;
  const fmt = (val: number) => `${formatMoney(val, amountFormatOpts)} ${displayCurrency}`;
  return [
    ...(currentBalance !== undefined
      ? [
          {
            id: 'balance',
            label: 'Balance',
            value: <span className="text-xs tracking-tight whitespace-nowrap">{fmt(currentBalance)}</span>,
            valueClassName: 'text-slate-100 font-mono text-xs',
          },
        ]
      : []),
    {
      id: 'outflow',
      label: 'Outflow',
      value: <span className="text-xs tracking-tight whitespace-nowrap">{fmt(analytics.totalSpend)}</span>,
      valueClassName: 'text-slate-200 font-mono text-xs',
    },
    {
      id: 'inflow',
      label: 'Inflow',
      value: <span className="text-xs tracking-tight whitespace-nowrap">{fmt(analytics.totalIncome)}</span>,
      valueClassName: 'text-emerald-400 font-mono text-xs',
    },
    {
      id: 'transfers',
      label: 'Transfers',
      value: <span className="text-xs tracking-tight whitespace-nowrap">{fmt(analytics.totalTransfers)}</span>,
      valueClassName: 'text-sky-300 font-mono text-xs',
    },
  ];
}

interface AccountModalHeaderProps {
  account: Account | null;
  period: PeriodType;
  startDate: string;
  endDate: string;
  onPeriodChange?: (period: PeriodType) => void;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
  onRecordSnapshotClick?: () => void;
}

const AccountModalHeader: React.FC<AccountModalHeaderProps> = ({
  account, period, startDate, endDate, onPeriodChange, onStartDateChange, onEndDateChange, onRecordSnapshotClick,
}) => {
  const tierInfo = account ? TIER_BADGE_MAP[account.tier] : null;
  const subtitleText = account
    ? formatAccountSubtitle(account)
    : 'Aggregated view across all connected institutions';
  return (
    <div className="p-3 rounded-xl bg-card/60 border border-border flex flex-col gap-3">
      <div className="flex items-center space-x-2.5">
        <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 shrink-0">
          {account ? <Landmark className="w-4 h-4" /> : <Building2 className="w-4 h-4" />}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold text-slate-100">
              {account ? account.name : 'All Portfolio Accounts'}
            </span>
            {tierInfo && <StatusBadge label={tierInfo.label} variant={tierInfo.variant} icon={tierInfo.icon} />}
          </div>
          <p className="text-xs text-slate-400">{subtitleText}</p>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        {onPeriodChange && (
          <PeriodFilterBar
            period={period}
            onPeriodChange={onPeriodChange}
            startDate={startDate}
            endDate={endDate}
            onStartDateChange={onStartDateChange}
            onEndDateChange={onEndDateChange}
            idPrefix="modal-period"
          />
        )}
        {account && onRecordSnapshotClick && (
          <Button
            variant="amber"
            size="xs"
            icon={<PlusCircle className="w-3 h-3" />}
            onClick={onRecordSnapshotClick}
            data-testid="modal-record-snapshot-btn"
          >
            Record Valuation
          </Button>
        )}
      </div>
    </div>
  );
};

const AccountTotalEarnedTile: React.FC<{ account: Account; nativeBalance?: number }> = ({
  account,
  nativeBalance,
}) => {
  const payoutCount = account.payout_count ?? 0;
  const payoutNative = Number(account.payout_total_native ?? 0);
  const payoutNzd = Number(account.payout_total_nzd ?? 0);
  const currency = account.currency || 'NZD';
  const isForeign = currency.toUpperCase() !== 'NZD';
  const principalPct =
    nativeBalance !== undefined ? formatPrincipalRecoveredPct(payoutNative, nativeBalance) : null;
  const payoutLabel = `${payoutCount} ${payoutCount === 1 ? 'payout' : 'payouts'}`;

  return (
    <div
      data-testid="account-total-earned-tile"
      className="px-3 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5"
    >
      <div className="flex items-center flex-wrap gap-x-2 gap-y-0.5 min-w-0">
        <span className="text-[10px] uppercase tracking-wider text-emerald-300/90 font-semibold shrink-0">
          Total Earned
        </span>
        <span className="text-sm font-bold font-mono text-emerald-400 whitespace-nowrap">
          {formatSignedTransactionAmount(payoutNative, currency)}
        </span>
        {isForeign && (
          <span className="text-[11px] font-mono text-emerald-200/80 whitespace-nowrap">
            ({formatNzdEquivalent(payoutNzd)})
          </span>
        )}
      </div>
      <div className="flex items-center gap-2 flex-wrap text-[11px] font-mono text-emerald-200/80">
        {principalPct !== null && (
          <span className="whitespace-nowrap">{`${principalPct}% of principal`}</span>
        )}
        {principalPct !== null && <span className="text-emerald-500/50">•</span>}
        <span className="whitespace-nowrap">{payoutLabel}</span>
      </div>
    </div>
  );
};

function useAccountModalData(opts: {
  isOpen: boolean;
  account: Account | null;
  accountsProp?: Account[];
  period: PeriodType;
  startDate: string;
  endDate: string;
  onChanged: () => void;
}) {
  const { isOpen, account, accountsProp, period, startDate, endDate, onChanged } = opts;
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loans, setLoans] = useState<LoanItem[]>([]);
  const [fetchedAccounts, setFetchedAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mutationSucceededRef = useRef(false);

  const patchLocal = useCallback((txId: number, patch: Partial<Transaction>) => {
    mutationSucceededRef.current = true;
    setTransactions((prev) => prev.map((t) => (t.id === txId ? { ...t, ...patch } : t)));
  }, []);

  const mutation = useTransactionCategoryMutation({
    onTransactionUpdated: patchLocal,
    onChanged,
    onError: (msg) => setError(msg || null),
  });

  const accountId = account?.id;

  const loadTransactions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchAccountTransactions({
        accountId,
        period,
        startDate: period === 'custom' ? startDate : undefined,
        endDate: period === 'custom' ? endDate : undefined,
        limit: 500,
      });
      setTransactions(res);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to load account transactions');
    } finally {
      setLoading(false);
    }
  }, [accountId, period, startDate, endDate]);

  useEffect(() => {
    if (!isOpen) return;
    mutation.setSuccessNote(null);
    void loadTransactions();
    fetchLoans().then((r) => setLoans(r.loans || [])).catch(() => setLoans([]));
  }, [isOpen, accountId, period, startDate, endDate, loadTransactions]);

  useEffect(() => {
    if (isOpen && !accountsProp) {
      fetchAccounts().then(setFetchedAccounts).catch(() => setFetchedAccounts([]));
    }
  }, [isOpen, accountsProp]);

  const accounts = accountsProp ?? fetchedAccounts;
  return { transactions, loans, accounts, loading, error, setError, mutation, mutationSucceededRef, loadTransactions };
}

function buildAccountListHandlers(opts: {
  loans: LoanItem[];
  accounts: Account[];
  mutation: ReturnType<typeof useTransactionCategoryMutation>;
  mutationSucceededRef: React.MutableRefObject<boolean>;
  setError: (msg: string | null) => void;
  loadTransactions: () => Promise<void>;
  onTransactionCategoryChanged: () => void;
}) {
  const { loans, accounts, mutation, mutationSucceededRef, setError, loadTransactions, onTransactionCategoryChanged } = opts;
  return {
    onCategoryChange: (txId: number, cat: string) => {
      setError(null);
      void mutation.handleCategoryChange(txId, cat);
    },
    onTagsChange: (txId: number, tags: string[]) => void mutation.handleTagsChange(txId, tags),
    onRecurrenceChange: (txId: number, rec: Transaction['recurrence']) =>
      void mutation.handleRecurrenceChange(txId, rec ?? null),
    onLoanChange: (txId: number, loanId: number | null, amt?: number | null) => {
      setError(null);
      const matched = loans.find((l) => l.id === loanId);
      void mutation.handleLoanChange(txId, loanId, amt, matched?.name ?? null, matched?.loan_type ?? null);
    },
    onCounterpartChange: async (txId: number, counterpartId: number | null) => {
      setError(null);
      mutationSucceededRef.current = false;
      const matched = accounts.find((a) => a.id === counterpartId) ?? null;
      await mutation.handleCounterpartChange(txId, counterpartId, matched);
      if (mutationSucceededRef.current) void loadTransactions();
    },
    onReceiptUpdated: () => {
      void loadTransactions();
      onTransactionCategoryChanged();
    },
  };
}

interface AccountInspectionBodyProps extends AccountInspectionModalProps {
  startDate: string;
  endDate: string;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
}

const AccountInspectionBody: React.FC<AccountInspectionBodyProps> = (props) => {
  const { isOpen, onClose, account, accounts: accountsProp, period, onPeriodChange, startDate, endDate, onStartDateChange, onEndDateChange, onTransactionCategoryChanged, onRecordSnapshotClick, latestBalance, latestBalanceNzd } = props;
  const { categoryNames } = useCategories();
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const data = useAccountModalData({
    isOpen, account, accountsProp, period, startDate, endDate, onChanged: onTransactionCategoryChanged,
  });

  const currentBalance = latestBalance !== undefined ? latestBalance : latestBalanceNzd;
  const displayCurrency = account?.currency || 'NZD';
  const isCrypto = account?.account_type === 'crypto' || displayCurrency.toUpperCase() === 'BTC';
  const amountFormatOpts = isCrypto
    ? { minimumFractionDigits: 2, maximumFractionDigits: 8 }
    : { minimumFractionDigits: 2, maximumFractionDigits: 2 };

  const collapsed = useMemo(() => collapsePairedTransfers(data.transactions), [data.transactions]);
  const analytics = useMemo(() => computeAccountCashflow(collapsed, account), [collapsed, account]);
  const availableCategories = useMemo(() => {
    const set = new Set<string>(categoryNames);
    collapsed.forEach((tx) => { if (tx.category) set.add(tx.category); });
    return Array.from(set).sort();
  }, [collapsed, categoryNames]);
  const filteredTransactions = useMemo(
    () => filterAccountTransactions(collapsed, categoryFilter, searchQuery),
    [collapsed, categoryFilter, searchQuery]
  );
  const summaryItems = buildAccountSummaryItems({ currentBalance, displayCurrency, amountFormatOpts, analytics });
  const showTotalEarned = Boolean(account && ((account.payout_count ?? 0) > 0 || account.account_type === 'private_note'));
  const handlers = buildAccountListHandlers({
    loans: data.loans, accounts: data.accounts, mutation: data.mutation,
    mutationSucceededRef: data.mutationSucceededRef, setError: data.setError,
    loadTransactions: data.loadTransactions, onTransactionCategoryChanged,
  });

  return (
    <>
      <div className="space-y-4" data-testid="account-inspection-modal">
        <AccountModalHeader account={account} period={period} startDate={startDate} endDate={endDate} onPeriodChange={onPeriodChange} onStartDateChange={onStartDateChange} onEndDateChange={onEndDateChange} onRecordSnapshotClick={onRecordSnapshotClick} />
        <SummaryMetricGrid items={summaryItems} columns={currentBalance !== undefined ? 4 : 3} />
        {showTotalEarned && <AccountTotalEarnedTile account={account!} nativeBalance={currentBalance} />}
        {Boolean(data.error) && <AlertBanner variant="error">{data.error}</AlertBanner>}
        {Boolean(data.mutation.successNote) && (
          <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-xs text-emerald-300 flex items-center space-x-2 animate-in fade-in">
            <Check className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
            <span>{data.mutation.successNote}</span>
          </div>
        )}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1">
          <SearchInput value={searchQuery} onChange={setSearchQuery} placeholder="Search merchant or category..." variant="amber" className="flex-1" data-testid="modal-tx-search" />
          <div className="flex items-center gap-2">
            <select value={categoryFilter || ''} onChange={(e) => setCategoryFilter(e.target.value || null)} className="bg-background border border-border rounded-xl px-2.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500" aria-label="Filter transactions by category" data-testid="modal-tx-category-filter">
              <option value="">All Categories</option>
              {availableCategories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <div className="text-[11px] text-slate-400 shrink-0">{filteredTransactions.length} of {collapsed.length}</div>
          </div>
        </div>
        <TransactionList
          transactions={filteredTransactions} categories={availableCategories} loading={data.loading} loadingLabel="Loading account transactions..." emptyTitle="No transactions found for this account and period." updatingId={data.mutation.updatingId}
          loans={data.loans} accounts={data.accounts} onCreateRule={data.mutation.handleCreateRuleFromTx}
          onSplitsUpdated={(updatedTx) => { data.mutation.setSuccessNote(updatedTx.is_split ? 'Saved transaction splits' : 'Cleared transaction splits'); }}
          showAccountBadge={account === null} fallbackCurrency={account?.currency} listTestId="modal-tx-list"
          getRowTestId={(tx) => `account-modal-tx-row-${tx.id}`} getSelectTestId={(tx) => `modal-select-category-${tx.id}`} getRuleBtnTestId={(tx) => `modal-rule-btn-${tx.id}`}
          {...handlers}
        />
        <div className="pt-2 flex justify-end">
          <Button variant="outline" size="sm" onClick={onClose} data-testid="modal-close-done-btn">Done</Button>
        </div>
      </div>
      <RulesManagerModal
        isOpen={data.mutation.isRulesModalOpen} onClose={data.mutation.closeRulesModal} prefillRule={data.mutation.rulePrefill}
        onRulesApplied={() => { void data.loadTransactions(); onTransactionCategoryChanged(); }}
      />
    </>
  );
};

/**
 * Modal for inspecting transactions, cashflow summary, and recategorization rules
 * for either a single account or the aggregated portfolio ledger.
 */
export const AccountInspectionModal: React.FC<AccountInspectionModalProps> = (props) => {
  const defaultRange = useMemo(() => getDefaultCustomRange(), []);
  const [localStartDate, setLocalStartDate] = useState(defaultRange.startDate);
  const [localEndDate, setLocalEndDate] = useState(defaultRange.endDate);
  const startDate = props.startDate ?? localStartDate;
  const endDate = props.endDate ?? localEndDate;
  const titleText = props.account ? `Inspect Account: ${props.account.name}` : 'Inspect: All Accounts';

  return (
    <Modal isOpen={props.isOpen} onClose={props.onClose} title={titleText} className="sm:max-w-2xl">
      <AccountInspectionBody
        {...props}
        startDate={startDate}
        endDate={endDate}
        onStartDateChange={props.onStartDateChange ?? setLocalStartDate}
        onEndDateChange={props.onEndDateChange ?? setLocalEndDate}
      />
    </Modal>
  );
};
