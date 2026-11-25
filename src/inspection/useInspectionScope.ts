import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useOffsetPagination } from '@yggdrasil-lab/ui';
import { plutusTransport } from '../transport';
import { CashflowDirection, PeriodType, Transaction } from '../types';
import { filterCounterpartAccountTransactions } from '../utils/transfers';
import { deriveInflowCategoryChips, mergeCashflowRegularRows } from './cashflow';
import { collapseInspectionTransfers } from './filter';
import { InspectionTransport } from './types';

export type ScopeTransport = Pick<
  InspectionTransport,
  'fetchAccountTransactions' | 'fetchCategoryTransactions' | 'fetchTagTransactions' | 'fetchFlowTransactions'
>;

export type InspectionScopeRequest =
  | { kind: 'account'; accountId?: number; period: PeriodType; startDate?: string; endDate?: string }
  | {
      kind: 'category';
      category: string;
      period: PeriodType;
      startDate?: string;
      endDate?: string;
      includeSubclasses: boolean;
      includeAmortized: boolean;
    }
  | { kind: 'tag'; tag: string; period: PeriodType };

export interface ScopeLoadContext {
  request: InspectionScopeRequest;
  transport: ScopeTransport;
  requestIdRef: { current: number };
  loadedScopeKeyRef: { current: string | null };
  setTransactions: (items: Transaction[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

async function fetchScopeTransactions(
  request: InspectionScopeRequest,
  transport: ScopeTransport
): Promise<Transaction[]> {
  if (request.kind === 'account') {
    const raw = await transport.fetchAccountTransactions({
      accountId: request.accountId,
      period: request.period,
      startDate: request.period === 'custom' ? request.startDate : undefined,
      endDate: request.period === 'custom' ? request.endDate : undefined,
      limit: 500,
    });
    return filterCounterpartAccountTransactions(raw, request.accountId);
  }
  if (request.kind === 'category') {
    if (!request.category) return [];
    return transport.fetchCategoryTransactions(
      request.category,
      request.period,
      request.period === 'custom' ? request.startDate : undefined,
      request.period === 'custom' ? request.endDate : undefined,
      request.includeSubclasses,
      request.includeAmortized
    );
  }
  if (!request.tag) return [];
  return transport.fetchTagTransactions(request.tag, request.period);
}

function getScopeFallbackError(kind: InspectionScopeRequest['kind']): string {
  if (kind === 'account') return 'Failed to load account transactions';
  if (kind === 'category') return 'Failed to load category transactions';
  return 'Failed to load tagged transactions';
}

export function buildScopeKey(request: InspectionScopeRequest): string {
  if (request.kind === 'account') {
    return `account:${request.accountId ?? 'all'}:${request.period}:${request.startDate ?? ''}:${request.endDate ?? ''}`;
  }
  if (request.kind === 'category') {
    return `category:${request.category}:${request.period}:${request.startDate ?? ''}:${request.endDate ?? ''}:${request.includeSubclasses}:${request.includeAmortized}`;
  }
  return `tag:${request.tag}:${request.period}`;
}

function isRunnableScopeRequest(request: InspectionScopeRequest): boolean {
  if (request.kind === 'category') return Boolean(request.category);
  if (request.kind === 'tag') return Boolean(request.tag);
  return true;
}

/**
 * Executes a scope load or post-mutation reload. Only enters `loading = true`
 * on initial load or when switching to a different scope key so post-mutation
 * reloads keep existing rows mounted in the DOM.
 */
export async function runScopeLoad(ctx: ScopeLoadContext): Promise<void> {
  if (!isRunnableScopeRequest(ctx.request)) return;
  const scopeKey = buildScopeKey(ctx.request);
  const reqId = ++ctx.requestIdRef.current;
  const isInitialOrScopeSwitch = ctx.loadedScopeKeyRef.current !== scopeKey;
  if (isInitialOrScopeSwitch) ctx.setLoading(true);
  ctx.setError(null);
  try {
    const items = await fetchScopeTransactions(ctx.request, ctx.transport);
    if (ctx.requestIdRef.current === reqId) {
      ctx.loadedScopeKeyRef.current = scopeKey;
      ctx.setTransactions(items);
    }
  } catch (err) {
    if (ctx.requestIdRef.current === reqId) {
      console.error(err);
      ctx.setError(err instanceof Error ? err.message : getScopeFallbackError(ctx.request.kind));
    }
  } finally {
    if (ctx.requestIdRef.current === reqId && isInitialOrScopeSwitch) {
      ctx.setLoading(false);
    }
  }
}

/**
 * Shared scope loader for `account`, `category`, and `tag` inspection modals.
 * Collapses paired transfers once and exposes an awaitable `reload()` promise.
 */
export function useInspectionScope(params: {
  enabled: boolean;
  request: InspectionScopeRequest;
  transport?: ScopeTransport;
}) {
  const { enabled, request, transport = plutusTransport } = params;
  const [rawTransactions, setRawTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);
  const loadedScopeKeyRef = useRef<string | null>(null);
  const requestRef = useRef(request);
  requestRef.current = request;
  const scopeKey = buildScopeKey(request);

  const reload = useCallback(
    () =>
      runScopeLoad({
        request: requestRef.current,
        transport,
        requestIdRef,
        loadedScopeKeyRef,
        setTransactions: setRawTransactions,
        setLoading,
        setError,
      }),
    [scopeKey, transport]
  );

  useEffect(() => {
    if (!enabled) {
      loadedScopeKeyRef.current = null;
      return;
    }
    void reload();
  }, [enabled, reload]);

  const transactions = useMemo(() => collapseInspectionTransfers(rawTransactions), [rawTransactions]);
  const patchTransactionLocal = useCallback((txId: number, patch: Partial<Transaction>) => {
    setRawTransactions((prev) => prev.map((t) => (t.id === txId ? { ...t, ...patch } : t)));
  }, []);

  return { transactions, loading, error, setError, reload, patchTransactionLocal };
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

function useCashflowSelectionState(initialFlow: CashflowDirection) {
  const [activeFlow, setActiveFlow] = useState<CashflowDirection>(initialFlow);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
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

  const switchFlow = useCallback(
    (nextFlow: CashflowDirection) => {
      if (nextFlow !== activeFlow) resetForFlow(nextFlow);
    },
    [activeFlow, resetForFlow]
  );

  const selectCategory = useCallback((category: string) => {
    if (category === 'ALL') {
      setSelectedCategory('ALL');
      return;
    }
    setSelectedCategory((prev) => (prev.toLowerCase() === category.toLowerCase() ? 'ALL' : category));
  }, []);

  return { activeFlow, selectedCategory, searchQuery, setSearchQuery, switchFlow, selectCategory };
}

function useCashflowPagination(opts: {
  period: PeriodType;
  startDate?: string;
  endDate?: string;
  includeSubclasses: boolean;
  transport: Pick<InspectionTransport, 'fetchFlowTransactions'>;
  onInflowCategories: (categories: string[]) => void;
  onFirstPageLoaded: () => void;
}) {
  const { period, startDate, endDate, includeSubclasses, transport, onInflowCategories, onFirstPageLoaded } = opts;
  return useOffsetPagination<Transaction, CashflowPageQuery>({
    initialLoading: true,
    fetcher: async (query, offset) => {
      const page = await transport.fetchFlowTransactions({
        flow: query.flow,
        period,
        startDate: period === 'custom' ? startDate : undefined,
        endDate: period === 'custom' ? endDate : undefined,
        category: query.category === 'ALL' ? undefined : query.category,
        includeSubclasses,
        includeAmortized: query.flow === 'outflow',
        limit: CASHFLOW_PAGE_LIMIT,
        offset,
      });
      return { items: page.transactions, totalCount: page.totalCount };
    },
    mergeItems: mergeLoadedCashflowItems,
    onPageLoaded: (res, query, offset) => {
      if (offset === 0) {
        onFirstPageLoaded();
        if (query.flow === 'inflow' && query.category === 'ALL') {
          onInflowCategories(deriveInflowCategoryChips(res.items));
        }
      }
    },
    formatError: (err, query) =>
      err instanceof Error ? err.message : `Failed to load ${query.flow} transactions`,
  });
}

/**
 * Paginated cashflow inspection scope hook with single-pass paired transfer
 * collapse and an awaitable `reload()` promise for atomic mutations.
 */
export function useCashflowInspectionScope(options: {
  initialFlow: CashflowDirection;
  period: PeriodType;
  startDate?: string;
  endDate?: string;
  includeSubclasses: boolean;
  transport?: Pick<InspectionTransport, 'fetchFlowTransactions'>;
}) {
  const { initialFlow, period, startDate, endDate, includeSubclasses, transport = plutusTransport } = options;
  const sel = useCashflowSelectionState(initialFlow);
  const [inflowCategories, setInflowCategories] = useState<string[]>([]);
  const cashflowKey = `${sel.activeFlow}:${sel.selectedCategory}:${period}:${startDate ?? ''}:${endDate ?? ''}:${includeSubclasses}`;
  const cashflowKeyRef = useRef(cashflowKey);
  cashflowKeyRef.current = cashflowKey;
  const loadedCashflowKeyRef = useRef<string | null>(null);

  useEffect(() => { setInflowCategories([]); }, [period, startDate, endDate, includeSubclasses]);

  const pagination = useCashflowPagination({
    period, startDate, endDate, includeSubclasses, transport,
    onInflowCategories: setInflowCategories,
    onFirstPageLoaded: () => { loadedCashflowKeyRef.current = cashflowKeyRef.current; },
  });

  useEffect(() => {
    void pagination.fetchPage({ flow: sel.activeFlow, category: sel.selectedCategory }, 0);
  }, [sel.activeFlow, sel.selectedCategory, period, startDate, endDate, includeSubclasses, pagination.fetchPage]);

  const loadedRegularCount = pagination.items.filter((t) => !t.is_amortized_commitment).length;
  const collapsedTransactions = useMemo(() => collapseInspectionTransfers(pagination.items), [pagination.items]);
  const loadMore = useCallback(() => {
    void pagination.loadMore({ flow: sel.activeFlow, category: sel.selectedCategory }, loadedRegularCount);
  }, [pagination.loadMore, sel.activeFlow, sel.selectedCategory, loadedRegularCount]);
  const reload = useCallback(
    () => pagination.fetchPage({ flow: sel.activeFlow, category: sel.selectedCategory }, 0),
    [pagination.fetchPage, sel.activeFlow, sel.selectedCategory]
  );
  const patchTransactionLocal = useCallback((txId: number, patch: Partial<Transaction>) => {
    pagination.patchItem((t) => t.id === txId, patch);
  }, [pagination.patchItem]);

  return {
    state: {
      activeFlow: sel.activeFlow, selectedCategory: sel.selectedCategory, searchQuery: sel.searchQuery,
      transactions: collapsedTransactions, totalCount: pagination.totalCount, loadedRegularCount,
      inflowCategories,
      loading: pagination.loading && loadedCashflowKeyRef.current !== cashflowKey,
      loadingMore: pagination.loadingMore, error: pagination.error,
    },
    actions: {
      setSearchQuery: sel.setSearchQuery, setError: pagination.setError, switchFlow: sel.switchFlow,
      selectCategory: sel.selectCategory, loadMore, reload, patchTransactionLocal,
    },
  };
}
