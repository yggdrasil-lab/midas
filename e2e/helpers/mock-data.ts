import type { Page } from '@playwright/test';
import { registerCashflowMockRoutes } from './cashflow-mock';
import { createMockApiState } from './mock-state';
import { registerAccountRoutes, registerIntegrationSyncRoute } from './routes/accounts';
import { registerBudgetRoutes } from './routes/budgets';
import { registerCategoryRoutes } from './routes/categories';
import { registerLoanRoutes } from './routes/loans';
import { registerReceiptRoutes } from './routes/receipts';
import { registerTransactionRoutes } from './routes/transactions';

export {
  MOCK_LOANS_DATA,
  MOCK_PRODUCTS_DATA,
  MOCK_RUNWAY_DATA,
  MOCK_SIMULATED_DATA,
} from './mock-fixtures';

/**
 * Registers all domain mock API routes in exact Playwright LIFO evaluation order.
 */
export async function setupMockApi(page: Page): Promise<void> {
  const state = createMockApiState();
  await registerAccountRoutes(page, state);
  await registerBudgetRoutes(page, state);
  await registerTransactionRoutes(page, state);
  await registerReceiptRoutes(page, state);
  await registerLoanRoutes(page, state);
  await registerCategoryRoutes(page, state);
  await registerIntegrationSyncRoute(page);
}

/**
 * Sets up the shared mock API routes plus cashflow projection (`flow=inflow|outflow`),
 * dynamic breakdown updates, and synthetic payslip 901 fixture routes.
 */
export async function setupCashflowMockApi(
  page: Page,
  options?: { cashflowPageSize?: number }
): Promise<void> {
  await setupMockApi(page);
  await registerCashflowMockRoutes(page, options?.cashflowPageSize);
}
