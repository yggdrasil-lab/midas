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
      // 1. Time Machine loan payoff toggle + relief readout inside Tools tab
      await page.locator('nav button:has-text("Tools")').locator('visible=true').first().click();
      const loanToggle = page.getByTestId('time-machine-payoff-loans');
      await loanToggle.scrollIntoViewIfNeeded();
      await expect(loanToggle).toBeVisible();
      await loanToggle.check();
      await page.getByRole('button', { name: 'Recalculate Freedom Horizon' }).click();
      await expect(page.locator('text=Loan relief:')).toBeVisible();
      await page.waitForTimeout(300);
      await page.screenshot({
        path: `screenshots/${name}/13-time-machine-loans.png`,
      });

      // 2. Accounts tab -> Unpaid transaction-driven LoansTracker initial state
      await page.getByRole('button', { name: 'Accounts' }).first().click();
      const loansHeading = page.locator('text=Financing & Loans');
      await expect(loansHeading).toBeVisible();
      const loanCard = page.getByTestId('loan-card-1');
      await expect(loanCard).toContainText('Toyota Corolla Cross (TFS)');
      await expect(loanCard).toContainText('0/36 posted');
      await expect(loanCard).toContainText('36/36 left');
      await expect(loanCard).toContainText('45,399.42 NZD');
      await expect(page.getByTestId('loan-due-badge-1')).toContainText('Due 2026-11-20');

      const paymentsToggle = page.getByTestId('loan-payments-toggle-1');
      await expect(paymentsToggle).toContainText('Linked Payments (0)');
      await paymentsToggle.scrollIntoViewIfNeeded();
      await paymentsToggle.click();
      await expect(page.getByTestId('loan-payments-list-1')).toContainText(
        'No bank statement payments linked yet'
      );
      await paymentsToggle.click();

      // 3. Account modal -> Recurrence selector + manual financing loan link
      await page.getByTestId('account-card-all').click();
      const recSelect = page.locator('select[aria-label^="Recurrence for "]').first();
      await expect(recSelect).toBeVisible();
      await recSelect.selectOption('annual');

      const loanSelect = page.getByTestId('modal-select-loan-140');
      await loanSelect.scrollIntoViewIfNeeded();
      await expect(loanSelect).toBeVisible();
      await loanSelect.selectOption('1');

      const loanFlowPill = page.getByTestId('loan-flow-140');
      await expect(loanFlowPill).toBeVisible();
      await expect(loanFlowPill).toContainText('ASB Everyday Checking');
      await expect(loanFlowPill).toContainText('Toyota Corolla Cross (TFS)');
      await expect(loanFlowPill).toContainText('Loan');
      await expect(
        page.locator('text=Linked transaction to "Toyota Corolla Cross (TFS)"')
      ).toBeVisible();
      await page.waitForTimeout(300);
      await page.screenshot({
        path: `screenshots/${name}/15-transactions-recurrence.png`,
      });

      await page.getByTestId('modal-close-done-btn').click();
      await expect(page.getByTestId('account-inspection-modal')).toBeHidden();

      // 4. LoansTracker reflects 1/36 posted, reduced balance, and expanded Linked Payments (1)
      await expect(loanCard).toContainText('1/36 posted');
      await expect(loanCard).toContainText('35/36 left');
      await expect(loanCard).toContainText('44,310.95 NZD');
      await expect(page.getByTestId('loan-due-badge-1')).toHaveCount(0);
      await expect(paymentsToggle).toContainText('Linked Payments (1)');
      await paymentsToggle.scrollIntoViewIfNeeded();
      await paymentsToggle.click();
      const paymentsList = page.getByTestId('loan-payments-list-1');
      await expect(paymentsList).toBeVisible();
      await expect(paymentsList).toContainText('Toyota Financial Services');
      await expect(paymentsList).toContainText('ASB Everyday Checking');
      await expect(paymentsList).toContainText('1,452.42 NZD');
      await loanCard.scrollIntoViewIfNeeded();
      await page.waitForTimeout(300);
      await page.screenshot({
        path: `screenshots/${name}/14-loans-overview.png`,
      });

      // 5. Tools -> Categorization rule with Financing / Loan Target
      await page.locator('nav button:has-text("Tools")').locator('visible=true').first().click();
      await page.getByTestId('rules-manager-btn').click();
      await expect(
        page.getByRole('heading', { name: /Outlook-Style Categorization Rules/i })
      ).toBeVisible();
      await page.getByRole('button', { name: /New Rule/i }).click();
      await page.getByTestId('rule-name-input').fill('Toyota Finance Auto-Link');
      await page.getByTestId('rule-pattern-input').fill('TOYOTA FINANCIAL');
      await page.getByTestId('rule-direction-select').selectOption('outflow');
      await page.getByTestId('rule-category-select').selectOption('Debt & Loans');
      const ruleLoanSelect = page.getByTestId('rule-loan-select');
      await ruleLoanSelect.scrollIntoViewIfNeeded();
      await expect(ruleLoanSelect).toBeVisible();
      await ruleLoanSelect.selectOption('1');
      await page.getByTestId('save-rule-btn').click();

      const loanBadge = page.getByTestId('rule-loan-badge-6');
      await loanBadge.scrollIntoViewIfNeeded();
      await expect(loanBadge).toBeVisible();
      await expect(loanBadge).toContainText('-> Toyota Corolla Cross (TFS)');
    });
  });
}
