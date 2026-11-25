import {
  CashflowDirection,
  CashflowTransactionsPage,
  PeriodType,
  RecurrenceType,
  StatementParseResult,
  Transaction,
  TransactionSplitInput,
} from '../types';
import { appendPeriodParams, HttpClient, jsonRequestInit } from './http';

export interface FetchFlowTransactionsParams {
  flow: CashflowDirection;
  period: PeriodType;
  startDate?: string;
  endDate?: string;
  category?: string;
  includeSubclasses?: boolean;
  includeAmortized?: boolean;
  limit?: number;
  offset?: number;
}

export interface TransactionUpdatePayload {
  category?: string;
  tags?: string[];
  recurrence?: RecurrenceType | null;
  loan_id?: number | null;
  loan_payment_amount?: number | null;
  counterpart_account_id?: number | null;
}

interface TransactionQueryParams {
  accountId?: number;
  period?: PeriodType;
  startDate?: string;
  endDate?: string;
  category?: string;
  tag?: string;
  flow?: CashflowDirection;
  includeSubclasses?: boolean;
  includeAmortized?: boolean;
  limit?: number;
  offset?: number;
}

function buildTransactionsQuery(params: TransactionQueryParams): URLSearchParams {
  const searchParams = new URLSearchParams();
  appendPeriodParams(searchParams, params.period, params.startDate, params.endDate);
  if (params.flow) searchParams.set('flow', params.flow);
  if (params.category) searchParams.set('category', params.category);
  if (params.tag) searchParams.set('tag', params.tag);
  if (params.accountId !== undefined) searchParams.set('account_id', String(params.accountId));
  if (params.includeSubclasses) searchParams.set('include_subclasses', 'true');
  if (params.includeAmortized) searchParams.set('include_amortized', 'true');
  if (params.limit !== undefined) searchParams.set('limit', String(params.limit));
  if (params.offset && params.offset > 0) searchParams.set('offset', String(params.offset));
  return searchParams;
}

function buildStatementQuery(params: {
  institution: string;
  commit: boolean;
  accountId?: number;
  closingBalance?: number;
  tier?: string;
  accountType?: string;
  accountName?: string;
  currency?: string;
}): URLSearchParams {
  const query = new URLSearchParams({
    institution: params.institution,
    commit: String(params.commit),
  });
  if (params.accountId) query.set('account_id', String(params.accountId));
  if (params.closingBalance !== undefined && !isNaN(params.closingBalance)) {
    query.set('closing_balance', String(params.closingBalance));
  }
  if (params.tier) query.set('tier', params.tier);
  if (params.accountType) query.set('account_type', params.accountType);
  if (params.accountName) query.set('account_name', params.accountName);
  if (params.currency) query.set('currency', params.currency);
  return query;
}

function resolveTotalCount(response: Response, transactions: Transaction[]): number {
  const rawTotal = response.headers.get('X-Total-Count');
  const parsedTotal = rawTotal !== null && rawTotal.trim() !== '' ? Number(rawTotal) : NaN;
  if (Number.isInteger(parsedTotal) && parsedTotal >= 0) {
    return parsedTotal;
  }
  return transactions.filter((t) => !t.is_amortized_commitment).length;
}

export function createTransactionsTransport(client: HttpClient) {
  const patchTransaction = (
    transactionId: number,
    payload: TransactionUpdatePayload,
    fallbackError: string
  ): Promise<Transaction> =>
    client.requestJson<Transaction>(
      `/transactions/${transactionId}`,
      jsonRequestInit('PATCH', payload, fallbackError)
    );

  return {
    quickLogExpense(payload: {
      amount: number;
      merchant: string;
      category?: string;
      notes?: string;
    }): Promise<Transaction> {
      return client.requestJson<Transaction>(
        '/integrations/quick-log',
        jsonRequestInit('POST', payload, 'Quick-log failed')
      );
    },

    uploadStatement(
      file: File,
      institution = 'auto',
      commit = false,
      accountId?: number,
      closingBalance?: number,
      tier?: string,
      accountType?: string,
      accountName?: string,
      currency?: string
    ): Promise<StatementParseResult> {
      const formData = new FormData();
      formData.append('file', file);
      const query = buildStatementQuery({
        institution,
        commit,
        accountId,
        closingBalance,
        tier,
        accountType,
        accountName,
        currency,
      });
      return client.requestFormData<StatementParseResult>(
        `/integrations/statement?${query.toString()}`,
        formData,
        { fallbackError: 'Statement upload failed' }
      );
    },

    fetchAccountTransactions(params?: {
      accountId?: number;
      period?: PeriodType;
      startDate?: string;
      endDate?: string;
      category?: string;
      tag?: string;
      limit?: number;
    }): Promise<Transaction[]> {
      const query = buildTransactionsQuery({ ...params, limit: params?.limit ?? 500 });
      return client.requestJson<Transaction[]>(`/transactions?${query.toString()}`, {
        fallbackError: 'Failed to fetch account transactions',
      });
    },

    fetchCategoryTransactions(
      category: string,
      period?: PeriodType,
      startDate?: string,
      endDate?: string,
      includeSubclasses = false,
      includeAmortized = false
    ): Promise<Transaction[]> {
      const query = buildTransactionsQuery({
        category: category || undefined,
        period,
        startDate,
        endDate,
        includeSubclasses,
        includeAmortized,
        limit: 200,
      });
      return client.requestJson<Transaction[]>(`/transactions?${query.toString()}`, {
        fallbackError: 'Failed to fetch transactions',
      });
    },

    async fetchFlowTransactions(
      params: FetchFlowTransactionsParams
    ): Promise<CashflowTransactionsPage> {
      const query = buildTransactionsQuery({ ...params, limit: params.limit ?? 200 });
      const { data, response } = await client.requestJsonWithResponse<Transaction[]>(
        `/transactions?${query.toString()}`,
        { fallbackError: `Failed to fetch ${params.flow} transactions` }
      );
      return {
        transactions: data,
        totalCount: resolveTotalCount(response, data),
      };
    },

    fetchTagTransactions(
      tag: string,
      period: PeriodType = 'all',
      startDate?: string,
      endDate?: string,
      category?: string
    ): Promise<Transaction[]> {
      const query = buildTransactionsQuery({
        tag: tag || undefined,
        category: category || undefined,
        period,
        startDate,
        endDate,
        limit: 500,
      });
      return client.requestJson<Transaction[]>(`/transactions?${query.toString()}`, {
        fallbackError: 'Failed to fetch tagged transactions',
      });
    },

    updateTransactionCategory(id: number, category: string): Promise<Transaction> {
      return patchTransaction(id, { category }, 'Failed to update transaction category');
    },

    updateTransactionTags(id: number, tags: string[]): Promise<Transaction> {
      return patchTransaction(id, { tags }, 'Failed to update transaction tags');
    },

    updateTransactionRecurrence(
      id: number,
      recurrence: RecurrenceType | null
    ): Promise<Transaction> {
      return patchTransaction(id, { recurrence }, 'Failed to update transaction recurrence');
    },

    updateTransactionLoan(
      transactionId: number,
      loanId: number | null,
      loanPaymentAmount?: number | null
    ): Promise<Transaction> {
      const payload: TransactionUpdatePayload = { loan_id: loanId };
      if (loanPaymentAmount !== undefined) {
        payload.loan_payment_amount = loanPaymentAmount;
      }
      return patchTransaction(transactionId, payload, 'Failed to update transaction loan');
    },

    updateTransactionCounterpart(
      transactionId: number,
      counterpartAccountId: number | null
    ): Promise<Transaction> {
      return patchTransaction(
        transactionId,
        { counterpart_account_id: counterpartAccountId },
        'Failed to update counterpart account'
      );
    },

    updateTransactionSplits(
      transactionId: number,
      splits: TransactionSplitInput[]
    ): Promise<Transaction> {
      return client.requestJson<Transaction>(
        `/transactions/${transactionId}/splits`,
        jsonRequestInit('PUT', { splits }, 'Failed to update transaction splits')
      );
    },

    triggerReconcileTransfers(): Promise<{ status: string; matched_transfers: number }> {
      return client.requestJson<{ status: string; matched_transfers: number }>(
        '/transactions/reconcile-transfers',
        { method: 'POST', fallbackError: 'Failed to reconcile transfers' }
      );
    },
  };
}
