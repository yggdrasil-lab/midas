import { test, expect } from '@playwright/test';
import { setupMockApi } from './helpers/mock-data';

test.describe('Midas App Shell & Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await setupMockApi(page);
    await page.goto('/');
  });

  test('renders header, brand, and freedom clock hero', async ({ page }) => {
    await expect(page.locator('header h1')).toBeVisible();
    await expect(page.locator('text=Financial Freedom Clock >> visible=true')).toBeVisible();

    // Check main counter display
    const counter = page.locator('text=184 >> visible=true').first();
    await expect(counter).toBeVisible();
    await expect(page.locator('text=Weeks >> visible=true').first()).toBeVisible();

    // Check toggle to years
    await counter.click();
    await expect(page.locator('text=3.5 >> visible=true').first()).toBeVisible();
    await expect(page.locator('text=Years >> visible=true').first()).toBeVisible();
  });

  test('renders tier breakdown cards and weekly burn tracker', async ({ page }) => {
    await expect(page.locator('text=Cash Floor >> visible=true').first()).toBeVisible();
    await expect(page.locator('text=24 w >> visible=true').first()).toBeVisible();

    await expect(page.locator('text=Growth >> visible=true').first()).toBeVisible();
    await expect(page.locator('text=184 w >> visible=true').first()).toBeVisible();

    await expect(page.locator('text=/KiwiSaver|Locked Reserve/ >> visible=true').first()).toBeVisible();

    // Check weekly burn
    await expect(page.locator('text=Weekly Burn & Budget >> visible=true').first()).toBeVisible();
    await expect(page.locator('text=/Spent \\$750 of \\$1,?000/ >> visible=true').first()).toBeVisible();
    await expect(page.locator('text=+0.25 weeks banked >> visible=true').first()).toBeVisible();
  });

  test('opens quick log modal, enters amount via tactile keypad, and submits', async ({ page }) => {
    // Open Quick Log
    const quickLogBtn = page.locator('button:has-text("Quick Log"), button:has-text("Log Expense")').locator('visible=true').first();
    await expect(quickLogBtn).toBeVisible();
    await quickLogBtn.click();

    // Modal should be visible
    await expect(page.getByRole('heading', { name: 'Log Quick Expense' })).toBeVisible();

    // Enter merchant
    const merchantInput = page.getByPlaceholder(/Merchant \/ Note/i);
    await merchantInput.fill('Matakana Coffee');

    // Click category chip
    await page.getByRole('button', { name: 'Coffee' }).click();

    // Enter amount using keypad: 6 . 5 0
    await page.getByRole('button', { name: '6', exact: true }).click();
    await page.getByRole('button', { name: '.', exact: true }).click();
    await page.getByRole('button', { name: '5', exact: true }).click();
    await page.getByRole('button', { name: '0', exact: true }).click();

    await expect(page.getByText('$6.50')).toBeVisible();

    // Submit
    const submitBtn = page.getByRole('button', { name: /Confirm & Log Expense/i });
    await submitBtn.click();

    // Modal closes
    await expect(page.getByRole('heading', { name: 'Log Quick Expense' })).not.toBeVisible();
  });

  test('runs scenario simulation in Time Machine', async ({ page }) => {
    // Switch to simulator tab if on mobile or find it on desktop
    const simTab = page.locator('button:has-text("Simulator"), button:has-text("Time Machine")').locator('visible=true').first();
    if (await simTab.isVisible()) {
      await simTab.click();
    }

    await expect(page.locator('text=Time Machine & Scenario Modeler >> visible=true').first()).toBeVisible();

    // Click recalculate button
    const recalcBtn = page.locator('button:has-text("Recalculate Freedom Horizon") >> visible=true').first();
    await recalcBtn.click();

    // Simulation result appears
    await expect(page.locator('text=228 Weeks >> visible=true').first()).toBeVisible();
    await expect(page.locator('text=+44 weeks >> visible=true').first()).toBeVisible();
  });

  test('navigates to Accounts tab, inspects per-account ledger popup, changes category and records snapshot', async ({ page }) => {
    const accountsTab = page.locator('header nav button:has-text("Accounts" ), nav button:has-text("Accounts")').locator('visible=true').first();
    await expect(accountsTab).toBeVisible();
    await accountsTab.click();

    // Verify Accounts & Per-Account Ledger header
    await expect(page.locator('text=Accounts & Per-Account Ledger >> visible=true').first()).toBeVisible();

    // Verify accounts exist
    await expect(page.locator('text=ASB Everyday Checking >> visible=true').first()).toBeVisible();
    await expect(page.locator('text=Sharesies Growth Portfolio >> visible=true').first()).toBeVisible();
    await expect(page.locator('text=Simplicity KiwiSaver >> visible=true').first()).toBeVisible();

    // Click ASB Everyday Checking account card to open popup (consistent with Budgets UI)
    const asbCard = page.locator('[data-testid="account-card-1"] >> visible=true').first();
    await expect(asbCard).toBeVisible();
    await asbCard.click();

    // Verify Account Inspection Modal popup appears
    await expect(page.getByRole('heading', { name: /Inspect Account: ASB Everyday Checking/i })).toBeVisible();
    await expect(page.locator('[data-testid="account-inspection-modal"] >> visible=true').first()).toBeVisible();
    await expect(page.locator('text=Pak n Save Albany >> visible=true').first()).toBeVisible();

    // Change category in the popup modal to Food
    const catSelect = page.locator('[data-testid="modal-select-category-101"] >> visible=true').first();
    await expect(catSelect).toBeVisible();
    await catSelect.selectOption('Food');
    await expect(page.locator('text=Moved transaction to "Food" >> visible=true').first()).toBeVisible();

    // Close the Account Inspection Modal
    const doneBtn = page.locator('[data-testid="modal-close-done-btn"] >> visible=true').first();
    await expect(doneBtn).toBeVisible();
    await doneBtn.click();
    await expect(page.getByRole('heading', { name: /Inspect Account: ASB Everyday Checking/i })).toBeHidden();

    // Verify per-account transactions list for selected account on main page
    await expect(page.locator('[data-testid="account-transactions-list"] >> visible=true').first()).toBeVisible();
    await expect(page.locator('text=Pak n Save Albany >> visible=true').first()).toBeVisible();

    // Open Record Snapshot modal
    const recordSnapshotBtn = page.locator('button:has-text("Record Valuation Snapshot"), button:has-text("Record Snapshot")').locator('visible=true').first();
    await expect(recordSnapshotBtn).toBeVisible();
    await recordSnapshotBtn.click();

    await expect(page.getByRole('heading', { name: /Record Balance Valuation Snapshot/i })).toBeVisible();

    // Fill snapshot balance
    const balanceInput = page.getByPlaceholder('0.00');
    await balanceInput.fill('25000');

    // Submit snapshot
    const confirmBtn = page.getByRole('button', { name: /Confirm & Save Valuation/i });
    await confirmBtn.click();

    // Modal closes
    await expect(page.getByRole('heading', { name: /Record Balance Valuation Snapshot/i })).toBeHidden();
  });

  test('displays SessionExpiredBanner when Authentik session expires without falling back to mock data', async ({ page }) => {
    // Intercept /api/runway with 401 Authentik redirect
    await page.route(/\/api\/runway(\?.*)?$/, async (route) => {
      await route.fulfill({
        status: 401,
        contentType: 'text/html',
        body: '<html><title>Authentik Login</title></html>',
      });
    });

    await page.goto('/');

    // SessionExpiredBanner must be visible
    const banner = page.locator('[data-testid="session-expired-banner"]');
    await expect(banner).toBeVisible();
    await expect(page.locator('text=Authentik session expired - tap to re-authenticate')).toBeVisible();

    // Mock data should NOT be displayed
    await expect(page.locator('text=Financial Freedom Clock')).not.toBeVisible();
  });
});
