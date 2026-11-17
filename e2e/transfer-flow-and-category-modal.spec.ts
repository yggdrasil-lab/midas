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
      const groceriesCard = page.locator('span:text-is("Groceries")').last();
      await groceriesCard.scrollIntoViewIfNeeded();
      await groceriesCard.click();
      const catModal = page.getByTestId('category-inspection-modal');
      await expect(catModal).toBeVisible();
      await page.waitForTimeout(300);
      await page.screenshot({
        path: `screenshots/inspect-category-${name}.png`,
      });
      await catModal.getByRole('button', { name: 'Done' }).click();

      // 2. Accounts tab -> Inspect All Accounts -> Reconciled Transfer Flow + Custom Range
      await page.getByRole('button', { name: 'Accounts' }).first().click();
      await page.getByTestId('account-card-all').click();
      const flowPill = page.getByTestId('transfer-flow-103');
      await flowPill.scrollIntoViewIfNeeded();
      await expect(flowPill).toBeVisible();
      await expect(flowPill).toContainText('ASB Checking');
      await expect(flowPill).toContainText('Wise USD (Personal)');
      await page.waitForTimeout(300);
      await page.screenshot({
        path: `screenshots/transfer-flow-${name}.png`,
      });
    });
  });
}
