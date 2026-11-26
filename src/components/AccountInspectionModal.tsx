import React, { useEffect, useMemo, useState } from 'react';
import { Building2, Landmark, Lock, PlusCircle, TrendingUp, Wallet } from 'lucide-react';
import {
  AlertBanner,
  Button,
  Modal,
  PeriodFilterBar,
  SearchInput,
  SelectInput,
  StatusBadge,
  SummaryMetricGrid,
  SummaryMetricItem,
  getDefaultCustomRange,
} from '@yggdrasil-lab/ui';
import {
  buildInspectionListProps,
  computeAccountCashflow,
  filterAccountTransactions,
  InspectionContextErrorBanner,
  useInspectionContext,
  useInspectionScope,
  useTransactionMutation,
} from '../inspection';
import { ACCOUNT_TIER_META, PERIOD_OPTIONS, useCategories } from '../taxonomy';
import { Account, PeriodType } from '../types';
import {
  formatAccountSubtitle,
  formatMoney,
  formatNzdEquivalent,
  formatPrincipalRecoveredPct,
  formatSignedTransactionAmount,
} from '../utils/format';
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
  onTransactionCategoryChanged: () => Promise<void> | void;
  onRecordSnapshotClick?: () => void;
  latestBalance?: number;
  latestBalanceNzd?: number;
}

const TIER_ICONS: Record<Account['tier'], React.ReactNode> = {
  cash: <Wallet className="w-3 h-3" />,
  growth: <TrendingUp className="w-3 h-3" />,
  locked: <Lock className="w-3 h-3" />,
};

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
  const tierMeta = account ? ACCOUNT_TIER_META[account.tier] : null;
  const tierIcon = account ? TIER_ICONS[account.tier] : null;
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
            {Boolean(tierMeta) && (
              <StatusBadge label={tierMeta!.shortLabel} variant={tierMeta!.badgeVariant} icon={tierIcon} />
            )}
          </div>
          <p className="text-xs text-slate-400">{subtitleText}</p>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        {Boolean(onPeriodChange) && (
          <PeriodFilterBar
            period={period}
            onPeriodChange={onPeriodChange!}
            startDate={startDate}
            endDate={endDate}
            onStartDateChange={onStartDateChange}
            onEndDateChange={onEndDateChange}
            options={PERIOD_OPTIONS}
            variant="brand"
            idPrefix="modal-period"
          />
        )}
        {Boolean(account && onRecordSnapshotClick) && (
          <Button
            variant="brand"
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

interface AccountFilterToolbarProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  categoryFilter: string | null;
  onCategoryFilterChange: (value: string | null) => void;
  availableCategories: string[];
  filteredCount: number;
  totalCount: number;
}

const AccountFilterToolbar: React.FC<AccountFilterToolbarProps> = ({
  searchQuery,
  onSearchChange,
  categoryFilter,
  onCategoryFilterChange,
  availableCategories,
  filteredCount,
  totalCount,
}) => (
  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1">
    <SearchInput
      value={searchQuery}
      onChange={onSearchChange}
      placeholder="Search merchant or category..."
      variant="brand"
      className="flex-1"
      data-testid="modal-tx-search"
    />
    <div className="flex items-center gap-2">
      <SelectInput
        value={categoryFilter || ''}
        onChange={(e) => onCategoryFilterChange(e.target.value || null)}
        containerClassName="w-auto"
        className="min-h-[40px] py-1.5 text-xs"
        aria-label="Filter transactions by category"
        data-testid="modal-tx-category-filter"
      >
        <option value="">All Categories</option>
        {availableCategories.map((c) => (
          <option key={c} value={c}>{c}</option>
        ))}
      </SelectInput>
      <div className="text-[11px] text-slate-400 shrink-0">
        {filteredCount} of {totalCount}
      </div>
    </div>
  </div>
);

interface AccountInspectionBodyProps extends AccountInspectionModalProps {
  startDate: string;
  endDate: string;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
}

function useAccountModalViewState(props: AccountInspectionBodyProps) {
  const { isOpen, account, accounts: accountsProp, period, startDate, endDate, onTransactionCategoryChanged, latestBalance, latestBalanceNzd } = props;
  const { categoryNames } = useCategories();
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const accountId = account?.id;

  const ctx = useInspectionContext({ enabled: isOpen, providedAccounts: accountsProp });
  const scope = useInspectionScope({
    enabled: isOpen,
    request: { kind: 'account', accountId, period, startDate, endDate },
  });
  const mutation = useTransactionMutation({
    onTransactionUpdated: scope.patchTransactionLocal,
    reloadScope: scope.reload,
    onRefreshParent: onTransactionCategoryChanged,
    onError: scope.setError,
  });

  useEffect(() => {
    if (isOpen) mutation.setSuccessNote(null);
  }, [isOpen, accountId, period, startDate, endDate, mutation.setSuccessNote]);

  const currentBalance = latestBalance !== undefined ? latestBalance : latestBalanceNzd;
  const displayCurrency = account?.currency || 'NZD';
  const isCrypto = account?.account_type === 'crypto' || displayCurrency.toUpperCase() === 'BTC';
  const amountFormatOpts = isCrypto
    ? { minimumFractionDigits: 2, maximumFractionDigits: 8 }
    : { minimumFractionDigits: 2, maximumFractionDigits: 2 };
  const analytics = useMemo(() => computeAccountCashflow(scope.transactions, account), [scope.transactions, account]);
  const availableCategories = useMemo(() => {
    const set = new Set<string>(categoryNames);
    scope.transactions.forEach((tx) => { if (tx.category) set.add(tx.category); });
    return Array.from(set).sort();
  }, [scope.transactions, categoryNames]);
  const filteredTransactions = useMemo(
    () => filterAccountTransactions(scope.transactions, categoryFilter, searchQuery),
    [scope.transactions, categoryFilter, searchQuery]
  );
  const summaryItems = buildAccountSummaryItems({ currentBalance, displayCurrency, amountFormatOpts, analytics });
  const listProps = buildInspectionListProps({
    categories: availableCategories, loans: ctx.loans, accounts: ctx.accounts, mutation,
    showAccountBadge: account === null, fallbackCurrency: account?.currency,
  });

  return {
    ctx, scope, mutation, searchQuery, setSearchQuery, categoryFilter, setCategoryFilter,
    currentBalance, availableCategories, filteredTransactions, summaryItems, listProps,
    showTotalEarned: Boolean(account && ((account.payout_count ?? 0) > 0 || account.account_type === 'private_note')),
  };
}

const AccountInspectionBody: React.FC<AccountInspectionBodyProps> = (props) => {
  const { account, period, onPeriodChange, startDate, endDate, onStartDateChange, onEndDateChange, onRecordSnapshotClick } = props;
  const v = useAccountModalViewState(props);

  return (
    <>
      <div className="space-y-4" data-testid="account-inspection-modal">
        <AccountModalHeader
          account={account} period={period} startDate={startDate} endDate={endDate}
          onPeriodChange={onPeriodChange} onStartDateChange={onStartDateChange}
          onEndDateChange={onEndDateChange} onRecordSnapshotClick={onRecordSnapshotClick}
        />
        <SummaryMetricGrid items={v.summaryItems} columns={v.currentBalance !== undefined ? 4 : 3} />
        {v.showTotalEarned && (
          <AccountTotalEarnedTile account={account!} nativeBalance={v.currentBalance} />
        )}
        <InspectionContextErrorBanner
          contextError={v.ctx.contextError}
          retrying={v.ctx.contextLoading}
          onRetry={() => void v.ctx.retryContext()}
        />
        {Boolean(v.scope.error) && <AlertBanner variant="error">{v.scope.error}</AlertBanner>}
        {Boolean(v.mutation.successNote) && (
          <AlertBanner variant="success">{v.mutation.successNote}</AlertBanner>
        )}
        <AccountFilterToolbar
          searchQuery={v.searchQuery}
          onSearchChange={v.setSearchQuery}
          categoryFilter={v.categoryFilter}
          onCategoryFilterChange={v.setCategoryFilter}
          availableCategories={v.availableCategories}
          filteredCount={v.filteredTransactions.length}
          totalCount={v.scope.transactions.length}
        />
        <TransactionList
          transactions={v.filteredTransactions}
          loading={v.scope.loading}
          loadingLabel="Loading account transactions..."
          emptyTitle="No transactions found for this account and period."
          listTestId="modal-tx-list"
          getRowTestId={(tx) => `account-modal-tx-row-${tx.id}`}
          getSelectTestId={(tx) => `modal-select-category-${tx.id}`}
          getRuleBtnTestId={(tx) => `modal-rule-btn-${tx.id}`}
          {...v.listProps}
        />
      </div>
      <RulesManagerModal
        isOpen={v.mutation.isRulesModalOpen}
        onClose={v.mutation.closeRulesModal}
        prefillRule={v.mutation.rulePrefill}
        onRulesApplied={() => void v.mutation.handleRulesApplied()}
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
    <Modal
      isOpen={props.isOpen}
      onClose={props.onClose}
      title={titleText}
      className="sm:max-w-2xl"
      footer={
        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={props.onClose} data-testid="modal-close-done-btn">Done</Button>
        </div>
      }
    >
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
