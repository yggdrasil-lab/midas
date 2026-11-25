import { useCallback, useEffect, useRef, useState } from 'react';
import { useOffsetPagination } from '@yggdrasil-lab/ui';
import { fetchAccounts, fetchFlowTransactions, fetchLoans } from '../services/api';
import {
  Account,
  CashflowDirection,
  LoanItem,
  PeriodType,
  Transaction,
} from '../types';
import { deriveInflowCategoryChips, mergeCashflowRegularRows } from '../utils/cashflow';

interface UseCashflowInspectionOptions {
  initialFlow: CashflowDirection;
  period: PeriodType;
  startDate?: string;
  endDate?: string;
  includeSubclasses: boolean;
}

interface CashflowPageQuery {
  flow: CashflowDirection;
  category: string;
}

const CASHFLOW_PAGE_LIMIT = 200;

function mergeLoadedCashflowItems(
  prev: Transaction[],
  next: Transaction[],
  isLoadMore: boolean
): Transaction[] {
  if (!isLoadMore) return next;
  return [
    ...prev.filter((t) => Boolean(t.is_amortized_commitment)),
    ...mergeCashflowRegularRows(prev, next),
  ];
}

function buildFlowRequestParams(opts: {
  flow: CashflowDirection;
  category: string;
  offset: number;
  period: PeriodType;
  startDate?: string;
  endDate?: string;
  includeSubclasses: boolean;
}) {
  return {
    flow: opts.flow,
    period: opts.period,
    startDate: opts.period === 'custom' ? opts.startDate : undefined,
    endDate: opts.period === 'custom' ? opts.endDate : undefined,
    category: opts.category === 'ALL' ? undefined : opts.category,
    includeSubclasses: opts.includeSubclasses,
    includeAmortized: opts.flow === 'outflow',
    limit: CASHFLOW_PAGE_LIMIT,
    offset: opts.offset,
  };
}

function useCashflowSelectionState(initialFlow: CashflowDirection) {
  const [activeFlow, setActiveFlow] = useState<CashflowDirection>(initialFlow);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [loans, setLoans] = useState<LoanItem[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const prevInitialFlowRef = useRef(initialFlow);

  const resetForFlow = useCallback((flow: CashflowDirection) => {
    setActiveFlow(flow);
    setSelectedCategory('ALL');
    setSearchQuery('');
  }, []);

  useEffect(() => {
    if (prevInitialFlowRef.current === initialFlow) return;
    prevInitialFlowRef.current = initialFlow;
    resetForFlow(initialFlow);
  }, [initialFlow, resetForFlow]);

  useEffect(() => {
    fetchLoans().then((res) => setLoans(res.loans || [])).catch(() => setLoans([]));
    fetchAccounts().then(setAccounts).catch(() => setAccounts([]));
  }, []);

  const switchFlow = useCallback((nextFlow: CashflowDirection) => {
    if (nextFlow !== activeFlow) resetForFlow(nextFlow);
  }, [activeFlow, resetForFlow]);

  const selectCategory = useCallback((category: string) => {
    if (category === 'ALL') { setSelectedCategory('ALL'); return; }
    setSelectedCategory((prev) => (prev.toLowerCase() === category.toLowerCase() ? 'ALL' : category));
  }, []);

  return { activeFlow, selectedCategory, searchQuery, setSearchQuery, loans, accounts, switchFlow, selectCategory };
}

export function useCashflowInspection({
  initialFlow, period, startDate, endDate, includeSubclasses,
}: UseCashflowInspectionOptions) {
  const sel = useCashflowSelectionState(initialFlow);
  const [inflowCategories, setInflowCategories] = useState<string[]>([]);

  useEffect(() => { setInflowCategories([]); }, [period, startDate, endDate, includeSubclasses]);

  const pagination = useOffsetPagination<Transaction, CashflowPageQuery>({
    initialLoading: true,
    fetcher: async (query, offset) => {
      const req = buildFlowRequestParams({ ...query, offset, period, startDate, endDate, includeSubclasses });
      const page = await fetchFlowTransactions(req);
      return { items: page.transactions, totalCount: page.totalCount };
    },
    mergeItems: mergeLoadedCashflowItems,
    onPageLoaded: (res, query, offset) => {
      if (offset === 0 && query.flow === 'inflow' && query.category === 'ALL') {
        setInflowCategories(deriveInflowCategoryChips(res.items));
      }
    },
    formatError: (err, query) =>
      err instanceof Error ? err.message : `Failed to load ${query.flow} transactions`,
  });

  useEffect(() => {
    void pagination.fetchPage({ flow: sel.activeFlow, category: sel.selectedCategory }, 0);
  }, [sel.activeFlow, sel.selectedCategory, period, startDate, endDate, includeSubclasses, pagination.fetchPage]);

  const loadedRegularCount = pagination.items.filter((t) => !t.is_amortized_commitment).length;
  const loadMore = useCallback(() => {
    void pagination.loadMore({ flow: sel.activeFlow, category: sel.selectedCategory }, loadedRegularCount);
  }, [pagination.loadMore, sel.activeFlow, sel.selectedCategory, loadedRegularCount]);

  const reload = useCallback(() => {
    void pagination.fetchPage({ flow: sel.activeFlow, category: sel.selectedCategory }, 0);
  }, [pagination.fetchPage, sel.activeFlow, sel.selectedCategory]);

  const patchTransactionLocal = useCallback((txId: number, patch: Partial<Transaction>) => {
    pagination.patchItem((t) => t.id === txId, patch);
  }, [pagination.patchItem]);

  return {
    state: {
      activeFlow: sel.activeFlow, selectedCategory: sel.selectedCategory, searchQuery: sel.searchQuery,
      transactions: pagination.items, totalCount: pagination.totalCount, loadedRegularCount,
      inflowCategories, loans: sel.loans, accounts: sel.accounts,
      loading: pagination.loading, loadingMore: pagination.loadingMore, error: pagination.error,
    },
    actions: {
      setSearchQuery: sel.setSearchQuery, setError: pagination.setError, switchFlow: sel.switchFlow,
      selectCategory: sel.selectCategory, loadMore, reload, patchTransactionLocal,
    },
  };
}
