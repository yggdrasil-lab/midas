import { INITIAL_ACCOUNTS } from './fixtures/accounts-fixtures';
import { INITIAL_BUDGET_RULES } from './fixtures/budgets-fixtures';
import { buildInitialMockCategories } from './fixtures/categories-fixtures';
import { INITIAL_RECEIPTS, MOCK_RECEIPT_CANDIDATES } from './fixtures/receipts-fixtures';
import { INITIAL_RULES } from './fixtures/rules-fixtures';
import { INITIAL_TRANSACTIONS, MOCK_AMORTIZED_UTILITIES } from './fixtures/transactions-fixtures';
import { MOCK_LOANS_DATA } from './mock-fixtures';
import type { MockApiState, MockLoanRecord } from './mock-types';

export function createMockApiState(): MockApiState {
  return {
    accounts: INITIAL_ACCOUNTS.map((a) => ({ ...a })),
    budgetRules: INITIAL_BUDGET_RULES.map((r) => ({ ...r })),
    transactions: INITIAL_TRANSACTIONS.map((tx) => ({
      ...tx,
      ...(tx.tags ? { tags: [...tx.tags] } : {}),
      ...(tx.splits ? { splits: tx.splits.map((s) => ({ ...s, tags: [...s.tags] })) } : {}),
    })),
    amortizedUtilities: MOCK_AMORTIZED_UTILITIES.map((tx) => ({
      ...tx,
      ...(tx.tags ? { tags: [...tx.tags] } : {}),
    })),
    loans: MOCK_LOANS_DATA.loans.map((l) => ({
      ...l,
      loan_type: l.loan_type ?? 'borrowed',
      linked_payments: [...(l.linked_payments || [])],
      disbursements: [...(l.disbursements || [])],
    })),
    rules: INITIAL_RULES.map((r) => ({ ...r, target_tags: [...r.target_tags] })),
    receipts: INITIAL_RECEIPTS.map((r) => ({
      ...r,
      items: r.items.map((it) => ({
        ...it,
        ...(it.inherited_tags ? { inherited_tags: [...it.inherited_tags] } : {}),
      })),
    })),
    receiptCandidates: MOCK_RECEIPT_CANDIDATES,
    categories: buildInitialMockCategories(),
    nextLoanId: 3,
    nextSplitId: 500,
    nextRuleId: 6,
    nextCategoryId: 100,
  };
}

export function resolveAccountName(
  state: MockApiState,
  accountId: number | null | undefined
): string | null {
  if (accountId === null || accountId === undefined) return null;
  const found = state.accounts.find((a) => a.id === Number(accountId));
  return found ? found.name : null;
}

export function resolveLoan(
  state: MockApiState,
  loanId: number | null | undefined
): MockLoanRecord | null {
  if (loanId === null || loanId === undefined) return null;
  return state.loans.find((l) => l.id === Number(loanId)) ?? null;
}

export function resolveLoanName(
  state: MockApiState,
  loanId: number | null | undefined
): string | null {
  return resolveLoan(state, loanId)?.name ?? null;
}

export function resolveLoanType(
  state: MockApiState,
  loanId: number | null | undefined
): 'borrowed' | 'lent' | null {
  return resolveLoan(state, loanId)?.loan_type ?? null;
}
