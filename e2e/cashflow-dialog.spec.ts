import { test, expect, devices, type Page } from '@playwright/test';
import { setupCashflowMockApi } from './helpers/mock-data';

async function assertSummaryCardContract(page: Page): Promise<void> {
  const outflowCard = page.locator('[data-testid="summary-card-outflow"] >> visible=true').first();
  const inflowCard = page.locator('[data-testid="summary-card-inflow"] >> visible=true').first();
  const netCard = page.locator('[data-testid="summary-card-net"] >> visible=true').first();

  await expect(outflowCard).toBeVisible();
  await expect(inflowCard).toBeVisible();
  await expect(netCard).toBeVisible();

  expect(await outflowCard.evaluate((el) => el.tagName)).toBe('BUTTON');
  expect(await inflowCard.evaluate((el) => el.tagName)).toBe('BUTTON');
  expect(await netCard.evaluate((el) => el.tagName)).toBe('DIV');

  const [outflowBox, inflowBox] = await Promise.all([
    outflowCard.boundingBox(),
    inflowCard.boundingBox(),
  ]);
  expect(outflowBox).not.toBeNull();
  expect(inflowBox).not.toBeNull();
  expect(outflowBox!.height).toBeGreaterThanOrEqual(44);
  expect(inflowBox!.height).toBeGreaterThanOrEqual(44);

  await netCard.click();
  await expect(page.getByTestId('cashflow-inspection-modal')).toHaveCount(0);
}

async function verifyInflowAndPayslipModal(page: Page): Promise<void> {
  const inflowCard = page.locator('[data-testid="summary-card-inflow"] >> visible=true').first();
  await inflowCard.click();

  const modal = page.getByTestId('cashflow-inspection-modal');
  await expect(modal).toBeVisible();
  await expect(modal.getByTestId('cashflow-modal-flow-inflow')).toHaveAttribute(
    'aria-selected',
    'true'
  );
  await expect(modal).toContainText('$3,200.00');
  await expect(modal).toContainText('Avg / Item');
  await expect(modal).toContainText('$1,600.00');
  await expect(modal).toContainText('Northwind Salary');
  await expect(modal).toContainText('Vanguard ETF Dividend');
  await expect(modal.getByTestId('cashflow-chip-income')).toBeVisible();
  await expect(modal.getByTestId('cashflow-chip-dividends')).toBeVisible();

  const payslipBtn = modal.getByTestId('open-receipt-901');
  await expect(payslipBtn).toHaveText('Payslip');
  await payslipBtn.click();

  const receiptModal = page.getByTestId('receipt-detail-modal');
  await expect(receiptModal).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Payslip: Northwind Software Ltd' })
  ).toBeVisible();
  await expect(receiptModal.getByTestId('receipt-pdf-card')).toContainText('northwind-payslip.pdf');
  await receiptModal.getByRole('button', { name: 'Done' }).click();
  await expect(receiptModal).toBeHidden();
}

async function verifyOutflowReconciliationAndAnnualInspect(page: Page): Promise<void> {
  const modal = page.getByTestId('cashflow-inspection-modal');
  await modal.getByTestId('cashflow-modal-flow-outflow').click();

  await expect(modal).toContainText('$750.00');
  await expect(modal).toContainText('Fixed & Annual');
  await expect(modal).toContainText('$136.99');
  await expect(modal.getByTestId('cashflow-actual-section')).toContainText('Harbour Fresh Market');
  await expect(modal.getByTestId('cashflow-actual-section')).toContainText('Spark Broadband');

  const amortized = modal.getByTestId('cashflow-amortized-section');
  await expect(amortized).toBeVisible();
  await expect(amortized).toContainText('City Cloud Storage');
  await expect(amortized).toContainText('-$36.99 NZD/mo');

  const annualized = modal.getByTestId('cashflow-annualized-section');
  await expect(annualized).toBeVisible();
  await expect(annualized).toContainText('Travel');
  await expect(annualized).toContainText('-$100.00 NZD/mo | From $1,200.00 NZD/52w');

  const excluded = modal.getByTestId('cashflow-excluded-section');
  await expect(excluded).toBeVisible();
  await expect(excluded.getByTestId('cashflow-excluded-list')).toHaveCount(0);
  await excluded.locator('button').first().click();
  await expect(excluded.getByTestId('cashflow-excluded-list')).toContainText('Alex Tan Advance');

  const searchInput = modal.getByTestId('cashflow-search-input');
  await searchInput.fill('Cloud');
  await expect(amortized).toContainText('City Cloud Storage');
  await expect(modal.getByTestId('cashflow-actual-section')).toHaveCount(0);
  await searchInput.fill('');
  await expect(modal.getByTestId('cashflow-actual-section')).toContainText('Harbour Fresh Market');

  await annualized.getByTestId('cashflow-annual-inspect-travel').click();
  await expect(modal).toBeHidden();
  const catModal = page.getByTestId('category-inspection-modal');
  await expect(catModal).toBeVisible();
  await expect(page.getByRole('heading', { name: /Inspect Category: Travel/i })).toBeVisible();
  await expect(catModal.getByTestId('annual-override-badge')).toBeVisible();
  await catModal.getByRole('button', { name: 'Done' }).click();
  await expect(catModal).toBeHidden();
}

test.describe('Cashflow Summary Cards & Inspection Dialog', () => {
  test('opens clickable Inflow & Outflow dialogs on desktop overview, keeps Net static, and reconciles sections', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await setupCashflowMockApi(page);
    await page.goto('/');

    await assertSummaryCardContract(page);
    await verifyInflowAndPayslipModal(page);
    await verifyOutflowReconciliationAndAnnualInspect(page);
  });

  test('opens clickable cards on mobile compact overview (iPhone 14 & Pixel 7) and Budgets tab', async ({
    page,
  }) => {
    for (const device of [devices['iPhone 14'], devices['Pixel 7']]) {
      await page.setViewportSize(device.viewport);
      await setupCashflowMockApi(page);
      await page.goto('/');

      await assertSummaryCardContract(page);
      const mobileInflow = page.locator('[data-testid="summary-card-inflow"] >> visible=true').first();
      await mobileInflow.scrollIntoViewIfNeeded();
      await mobileInflow.click();

      const modal = page.getByTestId('cashflow-inspection-modal');
      await expect(modal).toBeVisible();
      await expect(modal).toContainText('Northwind Salary');
      await modal.getByRole('button', { name: 'Done' }).click();
      await expect(modal).toBeHidden();
    }

    const budgetsTab = page
      .locator('header nav button:has-text("Spending & Budgets"), nav button:has-text("Budgets")')
      .locator('visible=true')
      .first();
    await budgetsTab.click();

    await assertSummaryCardContract(page);
    await page.locator('[data-testid="summary-card-outflow"] >> visible=true').first().click();
    await expect(page.getByTestId('cashflow-inspection-modal')).toContainText('Harbour Fresh Market');
  });

  test('triggers server-side category filter requests and loads additional pages without duplicating amortized rows', async ({
    page,
  }) => {
    const flowRequests: Array<{ flow: string; category: string | null; offset: string | null }> = [];
    await page.setViewportSize({ width: 1280, height: 800 });
    await setupCashflowMockApi(page, { cashflowPageSize: 3 });

    page.on('request', (req) => {
      if (!req.url().includes('/api/transactions')) return;
      const url = new URL(req.url());
      const flow = url.searchParams.get('flow');
      if (flow) {
        flowRequests.push({
          flow,
          category: url.searchParams.get('category'),
          offset: url.searchParams.get('offset'),
        });
      }
    });

    await page.goto('/');
    await page.locator('[data-testid="summary-card-inflow"] >> visible=true').first().click();

    const modal = page.getByTestId('cashflow-inspection-modal');
    await expect(modal).toBeVisible();
    await modal.getByTestId('cashflow-chip-dividends').click();
    await expect(modal).toContainText('Vanguard ETF Dividend');
    await expect(modal).not.toContainText('Northwind Salary');
    await expect(modal.getByTestId('cashflow-chip-income')).toBeVisible();

    await modal.getByTestId('cashflow-modal-flow-outflow').click();
    const loadMoreBtn = modal.getByTestId('cashflow-load-more-btn');
    await expect(loadMoreBtn).toContainText('Load more (Showing 3 of 5)');
    await loadMoreBtn.click();

    await expect(loadMoreBtn).toHaveCount(0);
    await expect(modal.getByTestId('cashflow-actual-list')).toContainText('Spark Broadband');
    await expect(modal.getByTestId('cashflow-amortized-row-915')).toHaveCount(1);

    await modal.getByTestId('cashflow-chip-groceries').click();
    await expect(modal.getByTestId('cashflow-actual-list')).toContainText('Harbour Fresh Market');
    await expect(modal.getByTestId('cashflow-actual-list')).not.toContainText('Spark Broadband');

    expect(flowRequests).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ flow: 'inflow', category: 'Dividends', offset: null }),
        expect.objectContaining({ flow: 'outflow', category: null, offset: '3' }),
        expect.objectContaining({ flow: 'outflow', category: 'Groceries', offset: null }),
      ])
    );
  });

  test('inline recategorization inside cashflow dialog refreshes breakdown totals', async ({
    page,
  }) => {
    let breakdownFetches = 0;
    await page.setViewportSize({ width: 1280, height: 800 });
    await setupCashflowMockApi(page);

    page.on('request', (req) => {
      if (req.url().includes('/api/budgets/breakdown')) {
        breakdownFetches += 1;
      }
    });

    await page.goto('/');
    await expect(
      page.locator('[data-testid="summary-card-outflow"] >> visible=true').first()
    ).toContainText('$750.00');
    const fetchesBefore = breakdownFetches;

    await page.locator('[data-testid="summary-card-outflow"] >> visible=true').first().click();
    const modal = page.getByTestId('cashflow-inspection-modal');
    await expect(modal).toBeVisible();

    const categorySelect = modal.getByTestId('cashflow-select-category-912');
    await expect(categorySelect).toBeVisible();
    await categorySelect.selectOption('Transfers');

    await expect(modal.locator('text=Moved transaction to "Transfers"')).toBeVisible();
    await expect.poll(() => breakdownFetches).toBeGreaterThan(fetchesBefore);
    await expect(modal).toContainText('$665.00');

    await modal.getByRole('button', { name: 'Done' }).click();
    await expect(
      page.locator('[data-testid="summary-card-outflow"] >> visible=true').first()
    ).toContainText('$665.00');
  });
});
