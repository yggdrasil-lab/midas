import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchFlowTransactions, fetchLoans } from '../services/api';
import {
  CashflowDirection,
  CashflowTransactionsPage,
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

const CASHFLOW_PAGE_LIMIT = 200;

function mergeLoadedCashflowPage(
  prev: Transaction[],
  page: CashflowTransactionsPage,
  isLoadMore: boolean
): Transaction[] {
  if (!isLoadMore) return page.transactions;
  return [
    ...prev.filter((t) => Boolean(t.is_amortized_commitment)),
    ...mergeCashflowRegularRows(prev, page.transactions),
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

function useCashflowPageFetcher(params: {
  period: PeriodType;
  startDate?: string;
  endDate?: string;
  includeSubclasses: boolean;
}) {
  const { period, startDate, endDate, includeSubclasses } = params;
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [inflowCategories, setInflowCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestSeqRef = useRef(0);

  useEffect(() => { setInflowCategories([]); }, [period, startDate, endDate, includeSubclasses]);

  const fetchPage = useCallback(async (flow: CashflowDirection, category: string, offset: number) => {
    const seq = ++requestSeqRef.current;
    const isLoadMore = offset > 0;
    if (isLoadMore) setLoadingMore(true);
    else setLoading(true);
    setError(null);
    try {
      const req = buildFlowRequestParams({ flow, category, offset, period, startDate, endDate, includeSubclasses });
      const page = await fetchFlowTransactions(req);
      if (seq !== requestSeqRef.current) return;
      setTotalCount(page.totalCount);
      setTransactions((prev) => mergeLoadedCashflowPage(prev, page, isLoadMore));
      if (!isLoadMore && flow === 'inflow' && category === 'ALL') setInflowCategories(deriveInflowCategoryChips(page.transactions));
    } catch (err) {
      if (seq === requestSeqRef.current) setError(err instanceof Error ? err.message : `Failed to load ${flow} transactions`);
    } finally {
      if (seq === requestSeqRef.current) { setLoading(false); setLoadingMore(false); }
    }
  }, [period, startDate, endDate, includeSubclasses]);

  return { transactions, setTransactions, totalCount, inflowCategories, loading, loadingMore, error, setError, fetchPage };
}

function useCashflowSelectionState(initialFlow: CashflowDirection) {
  const [activeFlow, setActiveFlow] = useState<CashflowDirection>(initialFlow);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [loans, setLoans] = useState<LoanItem[]>([]);
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
  }, []);

  const switchFlow = useCallback((nextFlow: CashflowDirection) => {
    if (nextFlow !== activeFlow) resetForFlow(nextFlow);
  }, [activeFlow, resetForFlow]);

  const selectCategory = useCallback((category: string) => {
    if (category === 'ALL') { setSelectedCategory('ALL'); return; }
    setSelectedCategory((prev) => (prev.toLowerCase() === category.toLowerCase() ? 'ALL' : category));
  }, []);

  return { activeFlow, selectedCategory, searchQuery, setSearchQuery, loans, switchFlow, selectCategory };
}

/**
 * Manages server-side cashflow fetching, flow switching, category chip filtering,
 * offset pagination, and local optimistic row patching for CashflowTransactionInspectionModal.
 */
export function useCashflowInspection({
  initialFlow, period, startDate, endDate, includeSubclasses,
}: UseCashflowInspectionOptions) {
  const sel = useCashflowSelectionState(initialFlow);
  const page = useCashflowPageFetcher({ period, startDate, endDate, includeSubclasses });

  useEffect(() => {
    void page.fetchPage(sel.activeFlow, sel.selectedCategory, 0);
  }, [sel.activeFlow, sel.selectedCategory, page.fetchPage]);

  const loadedRegularCount = page.transactions.filter((t) => !t.is_amortized_commitment).length;
  const loadMore = useCallback(() => {
    if (page.loading || page.loadingMore || loadedRegularCount >= page.totalCount) return;
    void page.fetchPage(sel.activeFlow, sel.selectedCategory, loadedRegularCount);
  }, [page.loading, page.loadingMore, loadedRegularCount, page.totalCount, page.fetchPage, sel.activeFlow, sel.selectedCategory]);

  const reload = useCallback(() => {
    void page.fetchPage(sel.activeFlow, sel.selectedCategory, 0);
  }, [page.fetchPage, sel.activeFlow, sel.selectedCategory]);

  const patchTransactionLocal = useCallback((txId: number, patch: Partial<Transaction>) => {
    page.setTransactions((prev) => prev.map((t) => (t.id === txId ? { ...t, ...patch } : t)));
  }, [page.setTransactions]);

  return {
    state: {
      activeFlow: sel.activeFlow, selectedCategory: sel.selectedCategory, searchQuery: sel.searchQuery,
      transactions: page.transactions, totalCount: page.totalCount, loadedRegularCount,
      inflowCategories: page.inflowCategories, loans: sel.loans,
      loading: page.loading, loadingMore: page.loadingMore, error: page.error,
    },
    actions: {
      setSearchQuery: sel.setSearchQuery, setError: page.setError, switchFlow: sel.switchFlow,
      selectCategory: sel.selectCategory, loadMore, reload, patchTransactionLocal,
    },
  };
}
