import { test, expect, devices } from '@playwright/test';
import { setupMockApi } from './helpers/mock-data';
import {
  assertCardMetricsWithinBounds,
  assertLoanRowHasNoOverlap,
} from './helpers/layout-assertions';

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

      // 2. Accounts tab -> Unpaid transaction-driven LoansTracker initial state (both I Owe and Owed to Me)
      await page.getByRole('button', { name: 'Accounts' }).first().click();
      const loansHeading = page.locator('text=Financing & Loans');
      await expect(loansHeading).toBeVisible();
      await expect(page.getByTestId('loans-receivables-pill')).toContainText('Owed to Me: $10,000.00 NZD');

      const loanCard = page.getByTestId('loan-card-1');
      await expect(loanCard).toContainText('Toyota Corolla Cross (TFS)');
      await expect(loanCard).toContainText('0/36 posted');
      await expect(loanCard).toContainText('36/36 left');
      await expect(loanCard).toContainText('45,399.42 NZD');
      await expect(page.getByTestId('loan-due-badge-1')).toContainText('Due 2026-11-20');

      const lentCard = page.getByTestId('loan-card-2');
      await expect(lentCard).toContainText('Loan to Brother');
      await expect(lentCard).toContainText('Owed to Me');
      await expect(lentCard).toContainText('0% repaid');
      await expect(lentCard).toContainText('$10,000.00 NZD');
      await expect(lentCard).toContainText('2025-08-08');
      await expect(lentCard).not.toContainText('Net Worth Effect');
      await expect(page.getByTestId('loan-due-badge-2')).toHaveCount(0);

      const paymentsToggle = page.getByTestId('loan-payments-toggle-1');
      await expect(paymentsToggle).toContainText('Linked Payments (0)');
      await paymentsToggle.scrollIntoViewIfNeeded();
      await paymentsToggle.click();
      await expect(page.getByTestId('loan-payments-list-1')).toContainText(
        'No bank statement payments linked yet'
      );
      await paymentsToggle.click();

      // 3. Account modal -> Category-gated loan picker, partial loan_payment_amount, and two-way flow pills
      await page.getByTestId('account-card-all').click();
      const recSelect = page.locator('select[aria-label^="Recurrence for "]').first();
      await expect(recSelect).toBeVisible();
      await recSelect.selectOption('annual');

      // Non-Debt & Loans rows hide the loan picker
      await expect(page.getByTestId('modal-select-loan-101')).toHaveCount(0);
      await expect(page.getByTestId('modal-select-loan-142')).toHaveCount(0);

      // Outflow in Debt & Loans shows both borrowed and (Lent) options
      const loanSelect = page.getByTestId('modal-select-loan-140');
      await loanSelect.scrollIntoViewIfNeeded();
      await expect(loanSelect).toBeVisible();
      await expect(loanSelect.locator('option')).toContainText([
        'No loan',
        'Toyota Corolla Cross (TFS)',
        'Loan to Brother (Lent)',
      ]);
      await loanSelect.selectOption('1');

      const loanFlowPill = page.getByTestId('loan-flow-140');
      await expect(loanFlowPill).toBeVisible();
      await expect(loanFlowPill).toContainText('ASB Everyday Checking');
      await expect(loanFlowPill).toContainText('Toyota Corolla Cross (TFS)');
      await expect(loanFlowPill).toContainText('Loan');
      await expect(
        page.locator('text=Linked transaction to "Toyota Corolla Cross (TFS)"')
      ).toBeVisible();

      // Switching +5,020 inflow from Family -> Debt & Loans reveals loan picker (lent options only)
      const catSelect142 = page.getByTestId('modal-select-category-142');
      await catSelect142.scrollIntoViewIfNeeded();
      await catSelect142.selectOption('Debt & Loans');
      const loanSelect142 = page.getByTestId('modal-select-loan-142');
      await expect(loanSelect142).toBeVisible();
      await expect(loanSelect142.locator('option')).toHaveCount(2);
      await loanSelect142.selectOption('2');

      // Partial loan_payment_amount inline edit (5000 of 5020)
      await page.getByTestId('modal-loan-split-btn-142').click();
      await page.getByTestId('modal-loan-amount-input-142').fill('5000');
      await page.getByTestId('modal-loan-amount-save-142').click();

      const lentFlowPill142 = page.getByTestId('loan-flow-142');
      await expect(lentFlowPill142).toBeVisible();
      await expect(lentFlowPill142).toContainText('Loan to Brother');
      await expect(lentFlowPill142).toContainText('ASB Everyday Checking');
      await expect(lentFlowPill142).toContainText('Repayment');
      await expect(lentFlowPill142).toContainText('$5,000.00 of $5,020.00');
      await expect(page.getByTestId('modal-loan-split-btn-142')).toContainText('Applied: $5,000.00');

      // Link full +1,000 inflow to Loan to Brother
      const loanSelect143 = page.getByTestId('modal-select-loan-143');
      await loanSelect143.scrollIntoViewIfNeeded();
      await loanSelect143.selectOption('2');
      await expect(page.getByTestId('loan-flow-143')).toContainText('Repayment');

      await assertLoanRowHasNoOverlap(page, 140);
      await assertLoanRowHasNoOverlap(page, 142);

      await page.waitForTimeout(300);
      await page.screenshot({
        path: `screenshots/${name}/15-transactions-recurrence.png`,
      });

      await page.getByTestId('modal-close-done-btn').click();
      await expect(page.getByTestId('account-inspection-modal')).toBeHidden();

      // 4. LoansTracker reflects borrowed 1/36 posted AND lent 60% repaid ($4,000.00 remaining)
      await expect(page.getByTestId('loans-receivables-pill')).toContainText('Owed to Me: $4,000.00 NZD');
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

      await lentCard.scrollIntoViewIfNeeded();
      await expect(lentCard).toContainText('60% repaid');
      await expect(lentCard).toContainText('$4,000.00 NZD');
      await expect(lentCard).toContainText('$6,000.00 / $10,000.00 NZD');
      const lentToggle = page.getByTestId('loan-payments-toggle-2');
      await expect(lentToggle).toContainText('Linked Repayments (2)');
      await lentToggle.click();
      const lentPaymentsList = page.getByTestId('loan-payments-list-2');
      await expect(lentPaymentsList).toBeVisible();
      await expect(lentPaymentsList).toContainText('$5,000.00 NZD');
      await expect(lentPaymentsList).toContainText('of $5,020.00');
      await expect(lentPaymentsList).toContainText('$1,000.00 NZD');
      await expect(lentPaymentsList).toContainText('Disbursement');
      await expect(lentPaymentsList).toContainText('Transfer to Brother');

      await lentCard.scrollIntoViewIfNeeded();
      await assertCardMetricsWithinBounds(lentCard);

      await page.waitForTimeout(300);
      await page.screenshot({
        path: `screenshots/${name}/14-loans-overview.png`,
      });

      // 5. Tools -> Categorization rule with Category-Gated Financing / Loan Target
      await page.locator('nav button:has-text("Tools")').locator('visible=true').first().click();
      await page.getByTestId('rules-manager-btn').click();
      await expect(
        page.getByRole('heading', { name: /Outlook-Style Categorization Rules/i })
      ).toBeVisible();
      await page.getByRole('button', { name: /New Rule/i }).click();
      await page.getByTestId('rule-name-input').fill('Toyota Finance Auto-Link');
      await page.getByTestId('rule-pattern-input').fill('TOYOTA FINANCIAL');
      await page.getByTestId('rule-direction-select').selectOption('outflow');
      // Hidden until Debt & Loans is selected
      await expect(page.getByTestId('rule-loan-select')).toHaveCount(0);
      await page.getByTestId('rule-category-select').selectOption('Debt & Loans');
      const ruleLoanSelect = page.getByTestId('rule-loan-select');
      await ruleLoanSelect.scrollIntoViewIfNeeded();
      await expect(ruleLoanSelect).toBeVisible();
      await expect(ruleLoanSelect).toContainText('[I Owe]');
      await expect(ruleLoanSelect).toContainText('[Owed to Me]');
      await ruleLoanSelect.selectOption('1');
      await page.getByTestId('save-rule-btn').click();

      const loanBadge = page.getByTestId('rule-loan-badge-6');
      await loanBadge.scrollIntoViewIfNeeded();
      await expect(loanBadge).toBeVisible();
      await expect(loanBadge).toContainText('-> Toyota Corolla Cross (TFS)');

      // Create an Owed to Me rule for emerald badge check
      await page.getByRole('button', { name: /New Rule/i }).click();
      await page.getByTestId('rule-name-input').fill('Brother Loan Repayment');
      await page.getByTestId('rule-pattern-input').fill('TIENZO E M TI');
      await page.getByTestId('rule-direction-select').selectOption('inflow');
      await page.getByTestId('rule-category-select').selectOption('Debt & Loans');
      await page.getByTestId('rule-loan-select').selectOption('2');
      await page.getByTestId('save-rule-btn').click();

      const lentRuleBadge = page.getByTestId('rule-loan-badge-7');
      await lentRuleBadge.scrollIntoViewIfNeeded();
      await expect(lentRuleBadge).toBeVisible();
      await expect(lentRuleBadge).toContainText('<-> Loan to Brother');
    });
  });
}
