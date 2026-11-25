import { useCallback, useEffect, useRef, useState } from 'react';
import { plutusTransport } from '../transport';
import { Account, LoanItem } from '../types';
import { InspectionContextState, InspectionTransport } from './types';

type ContextTransport = Pick<InspectionTransport, 'fetchLoans' | 'fetchAccounts'>;

export interface LoadInspectionContextOptions {
  transport?: ContextTransport;
  providedAccounts?: Account[];
}

export interface LoadInspectionContextResult {
  loans: LoanItem[];
  accounts: Account[];
  contextError: string | null;
}

function formatContextError(prefix: string, reason: unknown): string {
  const detail = reason instanceof Error ? reason.message : String(reason || 'Unknown error');
  return `${prefix}: ${detail}`;
}

/**
 * Loads loans and accounts context for inspection modals with fail-loud error
 * reporting instead of silent `.catch(() => [])` swallowing.
 */
export async function loadInspectionContext(
  options: LoadInspectionContextOptions = {}
): Promise<LoadInspectionContextResult> {
  const transport = options.transport ?? plutusTransport;
  const shouldFetchAccounts = options.providedAccounts === undefined;
  const [loansRes, accountsRes] = await Promise.allSettled([
    transport.fetchLoans(),
    shouldFetchAccounts
      ? transport.fetchAccounts()
      : Promise.resolve(options.providedAccounts as Account[]),
  ]);

  const errors: string[] = [];
  let loans: LoanItem[] = [];
  let accounts: Account[] = options.providedAccounts ?? [];

  if (loansRes.status === 'fulfilled') {
    loans = loansRes.value.loans || [];
  } else {
    errors.push(formatContextError('Failed to load loans context', loansRes.reason));
  }

  if (accountsRes.status === 'fulfilled') {
    accounts = accountsRes.value || [];
  } else if (shouldFetchAccounts) {
    errors.push(formatContextError('Failed to load accounts context', accountsRes.reason));
  }

  return {
    loans,
    accounts,
    contextError: errors.length > 0 ? errors.join('; ') : null,
  };
}

export interface UseInspectionContextOptions {
  enabled: boolean;
  providedAccounts?: Account[];
  transport?: ContextTransport;
}

export interface UseInspectionContextResult extends InspectionContextState {
  retryContext: () => Promise<void>;
}

/**
 * Shared React hook for loading loans and accounts context in inspection modals
 * with explicit `contextError` surfacing and `retryContext` recovery.
 */
export function useInspectionContext({
  enabled,
  providedAccounts,
  transport = plutusTransport,
}: UseInspectionContextOptions): UseInspectionContextResult {
  const [loans, setLoans] = useState<LoanItem[]>([]);
  const [fetchedAccounts, setFetchedAccounts] = useState<Account[]>([]);
  const [contextLoading, setContextLoading] = useState(false);
  const [contextError, setContextError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const loadContext = useCallback(async () => {
    const reqId = ++requestIdRef.current;
    setContextLoading(true);
    setContextError(null);
    const result = await loadInspectionContext({ transport, providedAccounts });
    if (requestIdRef.current !== reqId) return;
    setLoans(result.loans);
    if (providedAccounts === undefined) {
      setFetchedAccounts(result.accounts);
    }
    setContextError(result.contextError);
    setContextLoading(false);
  }, [transport, providedAccounts]);

  useEffect(() => {
    if (!enabled) return;
    void loadContext();
  }, [enabled, loadContext]);

  return {
    loans,
    accounts: providedAccounts ?? fetchedAccounts,
    contextLoading,
    contextError,
    retryContext: loadContext,
  };
}
