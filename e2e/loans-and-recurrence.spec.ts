import { test, expect, devices } from '@playwright/test';
import { setupMockApi } from './helpers/mock-data';

const MOBILE_PLATFORMS = [
  { name: 'ios', device: devices['iPhone 14'] },
  { name: 'android', device: devices['Pixel 7'] },
];

for (const { name, device } of MOBILE_PLATFORMS) {
  test.describe(`Loans, Recurrence & Time Machine - ${name.toUpperCase()}`, () => {
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

    test(`renders loans countdown, recurrence selector, and time machine loan toggle on ${name}`, async ({ page }) => {
      // 1. Time Machine loan payoff toggle + relief readout
      await page.locator('nav button:has-text("Simulator")').locator('visible=true').first().click();
      const loanToggle = page.getByTestId('time-machine-payoff-loans');
      await loanToggle.scrollIntoViewIfNeeded();
      await expect(loanToggle).toBeVisible();
      await loanToggle.check();
      await page.getByRole('button', { name: 'Recalculate Freedom Horizon' }).click();
      await expect(page.locator('text=Loan relief:')).toBeVisible();
      await page.waitForTimeout(300);
      await page.screenshot({
        path: `screenshots/time-machine-loans-${name}.png`,
      });

      // 2. Accounts tab -> Net Worth with Loans & Financing & Loans countdown card
      await page.getByRole('button', { name: 'Accounts' }).first().click();
      const loansHeading = page.locator('text=Financing & Loans');
      await expect(loansHeading).toBeVisible();
      await expect(page.locator('text=Toyota Corolla Cross (TFS)')).toBeVisible();
      await expect(page.locator('text=36/36 left')).toBeVisible();
      await loansHeading.scrollIntoViewIfNeeded();
      await page.waitForTimeout(300);
      await page.screenshot({
        path: `screenshots/loans-${name}.png`,
      });

      // 3. Account modal -> TransactionRow inline recurrence selector
      await page.getByTestId('account-card-all').click();
      const recSelect = page.locator('select[aria-label^="Recurrence for "]').first();
      await expect(recSelect).toBeVisible();
      await recSelect.selectOption('annual');
      await page.waitForTimeout(300);
      await page.screenshot({
        path: `screenshots/transactions-recurrence-${name}.png`,
      });
    });
  });
}
