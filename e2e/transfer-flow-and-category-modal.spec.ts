import { test, expect, devices } from '@playwright/test';
import { setupMockApi } from './helpers/mock-data';

const MOBILE_PLATFORMS = [
  { name: 'ios', device: devices['iPhone 14'] },
  { name: 'android', device: devices['Pixel 7'] },
];

for (const { name, device } of MOBILE_PLATFORMS) {
  test.describe(`Transfer Flow & Inspect Category Modal - ${name.toUpperCase()}`, () => {
    test.use({
      viewport: device.viewport,
      userAgent: device.userAgent,
      deviceScaleFactor: device.deviceScaleFactor,
      isMobile: device.isMobile,
      hasTouch: device.hasTouch,
    });

    test.beforeEach(async ({ page }) => {
      await setupMockApi(page);
      await page.goto('/');
    });

    test(`renders reconciled transfer flow and category inspection modal on ${name}`, async ({ page }) => {
      // 1. Inspect Category Modal from Spending & Budgets tab
      await page.locator('nav button:has-text("Budgets")').locator('visible=true').first().click();
      const groceriesCard = page.locator('[data-testid="category-row-groceries"] >> visible=true').first();
      await groceriesCard.scrollIntoViewIfNeeded();
      await groceriesCard.click();
      const catModal = page.getByTestId('category-inspection-modal');
      await expect(catModal).toBeVisible();
      await page.waitForTimeout(300);
      await page.screenshot({
        path: `screenshots/${name}/16-inspect-category.png`,
      });
      await catModal.getByRole('button', { name: 'Done' }).click();

      // 2. Accounts tab -> Inspect All Accounts -> Reconciled Transfer Flow + Collapsed Paired Legs
      await page.getByRole('button', { name: 'Accounts' }).first().click();
      await page.getByTestId('account-card-all').click();
      await expect(page.getByTestId('account-modal-tx-row-103')).toBeVisible();
      await expect(page.getByTestId('account-modal-tx-row-104')).toHaveCount(0);
      const flowPill = page.getByTestId('transfer-flow-103');
      await flowPill.scrollIntoViewIfNeeded();
      await expect(flowPill).toBeVisible();
      await expect(flowPill).toContainText('ASB Checking');
      await expect(flowPill).toContainText('Wise USD (Personal)');
      const btcFlowPill = page.getByTestId('transfer-flow-107');
      await btcFlowPill.scrollIntoViewIfNeeded();
      await expect(btcFlowPill).toBeVisible();
      await expect(btcFlowPill).toContainText('0.04884012 BTC');
      await expect(page.getByTestId('account-modal-tx-row-107')).toContainText('FX (122,849.82)');
      await expect(page.getByTestId('tx-fee-107')).toHaveText('Fee: $100.81 NZD');
      const btcSpendRow = page.getByTestId('account-modal-tx-row-109');
      await btcSpendRow.scrollIntoViewIfNeeded();
      await expect(btcSpendRow).toContainText('-0.005005 BTC');
      await expect(page.getByTestId('tx-fee-109')).toHaveText('Fee: 0.000005 BTC');

      await expect(page.getByTestId('account-modal-tx-row-130')).toBeVisible();
      await expect(page.getByTestId('account-modal-tx-row-131')).toHaveCount(0);
      const manulifeTransferPill = page.getByTestId('transfer-flow-130');
      await manulifeTransferPill.scrollIntoViewIfNeeded();
      await expect(manulifeTransferPill).toBeVisible();
      await expect(manulifeTransferPill).toContainText('DBS Multiplier');
      await expect(manulifeTransferPill).toContainText('Manulife');

      const manulifeDividendPill = page.getByTestId('counterpart-flow-132');
      await manulifeDividendPill.scrollIntoViewIfNeeded();
      await expect(manulifeDividendPill).toBeVisible();
      await expect(manulifeDividendPill).toContainText('Manulife');
      await expect(manulifeDividendPill).toContainText('DBS Multiplier');

      await page.waitForTimeout(300);
      await page.screenshot({
        path: `screenshots/${name}/17-transfer-flow.png`,
      });

      await page.getByTestId('modal-close-done-btn').click();

      // 3. Inspect Manulife single-account ledger: contribution transfer + counterpart dividend pill
      await page.getByTestId('account-card-5').click();
      const manulifeModal = page.getByTestId('account-inspection-modal');
      await expect(manulifeModal).toBeVisible();
      await expect(page.getByRole('heading', { name: /Inspect Account: Manulife/i })).toBeVisible();
      await expect(manulifeModal).toContainText('14,527.89 SGD');
      await expect(manulifeModal).toContainText('0.00 SGD');
      await expect(manulifeModal).toContainText('300.00 SGD');
      await expect(page.getByTestId('account-modal-tx-row-131')).toBeVisible();
      await expect(page.getByTestId('transfer-flow-131')).toContainText('DBS Multiplier');
      await expect(page.getByTestId('transfer-flow-131')).toContainText('Manulife');
      await expect(page.getByTestId('account-modal-tx-row-132')).toBeVisible();
      await expect(page.getByTestId('counterpart-flow-132')).toContainText('Manulife');
      await expect(page.getByTestId('counterpart-flow-132')).toContainText('DBS Multiplier');
    });
  });
}
