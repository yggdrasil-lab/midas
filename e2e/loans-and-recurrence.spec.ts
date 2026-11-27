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
      test.setTimeout(60000);
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

      const paymentsToggle = loanCard.getByRole('button', { name: /Linked Payments/i });
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

      // Split +5,020 inflow via TransactionSplitModal (5,000 Debt & Loans -> Loan to Brother, 20 Family)
      const splitBtn142 = page.getByTestId('split-tx-btn-142');
      await splitBtn142.scrollIntoViewIfNeeded();
      await splitBtn142.click();

      const splitModal = page.getByTestId('transaction-split-modal');
      await expect(splitModal).toBeVisible();
      await page.getByTestId('split-amount-0').fill('5000');
      await expect(page.getByTestId('split-amount-1')).toHaveValue('20.00');
      await expect(page.getByTestId('split-allocation-pill')).toContainText('Balanced');

      await page.getByTestId('split-category-0').selectOption('Debt & Loans');
      const splitLoan0 = page.getByTestId('split-loan-0');
      await expect(splitLoan0).toBeVisible();
      await expect(splitLoan0.locator('option')).toHaveCount(2);
      await splitLoan0.selectOption('2');

      await page.getByTestId('split-category-1').selectOption('Family');
      await page.getByTestId('split-notes-1').fill('Food split');
      await page.getByTestId('save-splits-btn').click();
      await expect(splitModal).toBeHidden();

      const splitBadge142 = page.getByTestId('open-split-badge-142');
      await expect(splitBadge142).toBeVisible();
      await expect(splitBadge142).toContainText('Split (2)');

      const splitSummary142 = page.getByTestId('split-summary-142');
      await expect(splitSummary142).toBeVisible();
      await expect(splitSummary142).toContainText('Debt & Loans');
      await expect(splitSummary142).toContainText('$5,000.00');
      await expect(splitSummary142).toContainText('Family');
      await expect(splitSummary142).toContainText('$20.00');

      const lentFlowPill142 = page.getByTestId('loan-flow-142');
      await expect(lentFlowPill142).toBeVisible();
      await expect(lentFlowPill142).toContainText('Loan to Brother');
      await expect(lentFlowPill142).toContainText('ASB Everyday Checking');
      await expect(lentFlowPill142).toContainText('Repayment');
      await expect(lentFlowPill142).toContainText('$5,000.00 of $5,020.00');
      await expect(page.getByTestId('modal-select-loan-142')).toHaveCount(0);
      await expect(page.getByTestId('modal-loan-split-btn-142')).toHaveCount(0);

      // Link full +1,000 inflow to Loan to Brother (lent options only)
      const loanSelect143 = page.getByTestId('modal-select-loan-143');
      await loanSelect143.scrollIntoViewIfNeeded();
      await expect(loanSelect143.locator('option')).toHaveCount(2);
      await loanSelect143.selectOption('2');
      await expect(page.getByTestId('loan-flow-143')).toContainText('Repayment');

      // Split netted +$137.17 inflow via TransactionSplitModal (+1,000 Debt & Loans -> Loan to Brother, -862.83 Travel)
      const splitBtn144 = page.getByTestId('split-tx-btn-144');
      await splitBtn144.scrollIntoViewIfNeeded();
      await splitBtn144.click();

      await expect(splitModal).toBeVisible();
      await expect(page.getByTestId('split-sign-0')).toHaveText('+');
      await page.getByTestId('split-amount-0').fill('+1000');
      await expect(page.getByTestId('split-sign-1')).toHaveText('-');
      await expect(page.getByTestId('split-amount-1')).toHaveValue('862.83');
      await expect(page.getByTestId('split-allocation-pill')).toContainText('Balanced');

      await page.getByTestId('split-category-0').selectOption('Debt & Loans');
      const splitLoan144Row0 = page.getByTestId('split-loan-0');
      await expect(splitLoan144Row0.locator('option')).toHaveCount(2);
      await splitLoan144Row0.selectOption('2');

      // Negative split row shows both borrowed and lent loans when Debt & Loans is selected
      await page.getByTestId('split-category-1').selectOption('Debt & Loans');
      await expect(page.getByTestId('split-loan-1').locator('option')).toHaveCount(3);
      await page.getByTestId('split-category-1').selectOption('Travel');
      await page.getByTestId('split-notes-1').fill('Christchurch trip');
      await page.getByTestId('save-splits-btn').click();
      await expect(splitModal).toBeHidden();

      const splitBadge144 = page.getByTestId('open-split-badge-144');
      await expect(splitBadge144).toBeVisible();
      await expect(splitBadge144).toContainText('Split (2)');

      const splitSummary144 = page.getByTestId('split-summary-144');
      await expect(splitSummary144).toBeVisible();
      await expect(splitSummary144).toContainText('Debt & Loans');
      await expect(splitSummary144).toContainText('+$1,000.00');
      await expect(splitSummary144).toContainText('Travel');
      await expect(splitSummary144).toContainText('-$862.83');
      await expect(splitSummary144).toContainText('Christchurch trip');

      const lentFlowPill144 = page.getByTestId('loan-flow-144');
      await expect(lentFlowPill144).toBeVisible();
      await expect(lentFlowPill144).toContainText('Loan to Brother');
      await expect(lentFlowPill144).toContainText('ASB Everyday Checking');
      await expect(lentFlowPill144).toContainText('Repayment');
      await expect(lentFlowPill144).toContainText('$1,000.00 (from +$137.17 net)');

      await assertLoanRowHasNoOverlap(page, 140);
      await assertLoanRowHasNoOverlap(page, 142);
      await assertLoanRowHasNoOverlap(page, 144);

      await page.waitForTimeout(300);
      await page.screenshot({
        path: `screenshots/${name}/15-transactions-recurrence.png`,
      });

      await page.getByTestId('modal-close-done-btn').click();
      await expect(page.getByTestId('account-inspection-modal')).toBeHidden();

      // 4. LoansTracker reflects borrowed 1/36 posted AND lent 70% repaid ($3,000.00 remaining)
      await expect(page.getByTestId('loans-receivables-pill')).toContainText('Owed to Me: $3,000.00 NZD');
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
      await expect(lentCard).toContainText('70% repaid');
      await expect(lentCard).toContainText('$3,000.00 NZD');
      await expect(lentCard).toContainText('$7,000.00 / $10,000.00 NZD');
      const lentToggle = lentCard.getByRole('button', { name: /Linked Repayments/i });
      await expect(lentToggle).toContainText('Linked Repayments (3)');
      await lentToggle.click();
      const lentPaymentsList = page.getByTestId('loan-payments-list-2');
      await expect(lentPaymentsList).toBeVisible();
      await expect(lentPaymentsList).toContainText('$5,000.00 NZD');
      await expect(lentPaymentsList).toContainText('of $5,020.00');
      await expect(lentPaymentsList).toContainText('$1,000.00 NZD');
      await expect(lentPaymentsList).toContainText('of $137.17');
      await expect(lentPaymentsList).toContainText('Disbursement');
      await expect(lentPaymentsList).toContainText('Transfer to Brother');

      await lentCard.scrollIntoViewIfNeeded();
      await assertCardMetricsWithinBounds(lentCard);

      await page.waitForTimeout(300);
      await page.screenshot({
        path: `screenshots/${name}/14-loans-overview.png`,
      });

      // 5. Budgets -> Travel category inspection modal (sliced tx.amount = -862.83, full splits)
      await page.locator('nav button:has-text("Budgets")').locator('visible=true').first().click();
      const travelCard = page.locator('[data-testid="category-row-travel"] >> visible=true').first();
      await travelCard.scrollIntoViewIfNeeded();
      await travelCard.click();

      const catModal = page.getByTestId('category-inspection-modal');
      await expect(catModal).toBeVisible();
      await expect(catModal.getByTestId('loan-flow-144')).toContainText('$1,000.00 (from +$137.17 net)');

      await catModal.getByTestId('open-split-badge-144').click();
      await expect(splitModal).toBeVisible();
      await expect(page.getByTestId('split-parent-amount')).toHaveText('+$137.17 NZD');
      await expect(page.getByTestId('split-allocation-pill')).toHaveText('Balanced');
      await expect(page.getByTestId('save-splits-btn')).toBeEnabled();

      await page.getByTestId('split-notes-1').fill('Christchurch trip updated');
      await page.getByTestId('save-splits-btn').click();
      await expect(splitModal).toBeHidden();

      await expect(catModal.getByTestId('split-summary-144')).toContainText('Christchurch trip updated');
      await expect(catModal.getByTestId('loan-flow-144')).toContainText('$1,000.00 (from +$137.17 net)');
      await catModal.getByRole('button', { name: 'Done' }).click();
      await expect(catModal).toBeHidden();

      // 6. Tools -> Categorization rule with Category-Gated Financing / Loan Target
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

    test(`supports direct negative sign typing and multi-disbursement lent summation on ${name}`, async ({ page }) => {
      await page.getByRole('button', { name: 'Accounts' }).first().click();
      await page.getByTestId('account-card-all').click();

      // Typing '-862.83' directly in Row 0 flips Row 0 sign to '-' and auto-fills Row 1 as '+1000.00'
      const splitBtn144 = page.getByTestId('split-tx-btn-144');
      await splitBtn144.scrollIntoViewIfNeeded();
      await splitBtn144.click();

      const splitModal = page.getByTestId('transaction-split-modal');
      await expect(splitModal).toBeVisible();
      await page.getByTestId('split-amount-0').fill('-862.83');
      await expect(page.getByTestId('split-sign-0')).toHaveText('-');
      await expect(page.getByTestId('split-amount-0')).toHaveValue('862.83');
      await expect(page.getByTestId('split-sign-1')).toHaveText('+');
      await expect(page.getByTestId('split-amount-1')).toHaveValue('1000.00');
      await expect(page.getByTestId('split-allocation-pill')).toContainText('Balanced');

      // Zero/blank line must warn 'Enter all line amounts' instead of misleading 'Balanced'
      await page.getByTestId('split-amount-0').fill('+137.17');
      await expect(page.getByTestId('split-amount-1')).toHaveValue('0.00');
      await expect(page.getByTestId('split-allocation-pill')).toHaveText('Enter all line amounts');
      await expect(page.getByTestId('save-splits-btn')).toBeDisabled();

      // Adding a 3rd split line pre-fills the remaining sign and amount
      await page.getByTestId('split-amount-0').fill('+100');
      await expect(page.getByTestId('split-amount-1')).toHaveValue('37.17');
      await page.getByTestId('split-amount-1').fill('20.00');
      await expect(page.getByTestId('split-allocation-pill')).toContainText('Remaining: +$17.17');
      await page.getByTestId('add-split-line-btn').click();
      await expect(page.getByTestId('split-sign-2')).toHaveText('+');
      await expect(page.getByTestId('split-amount-2')).toHaveValue('17.17');
      await expect(page.getByTestId('split-allocation-pill')).toHaveText('Balanced');

      await page.getByRole('button', { name: 'Cancel' }).click();
      await expect(splitModal).toBeHidden();

      // Multi-disbursement top-up: split -$1,452.42 outflow (140) into -$500.00 lent top-up + -$952.42 Fuel
      const splitBtn140 = page.getByTestId('split-tx-btn-140');
      await splitBtn140.scrollIntoViewIfNeeded();
      await splitBtn140.click();
      await expect(splitModal).toBeVisible();
      await expect(page.getByTestId('split-sign-0')).toHaveText('-');
      await page.getByTestId('split-amount-0').fill('500');
      await expect(page.getByTestId('split-sign-1')).toHaveText('-');
      await expect(page.getByTestId('split-amount-1')).toHaveValue('952.42');
      await page.getByTestId('split-loan-0').selectOption('2');
      await page.getByTestId('split-category-1').selectOption('Fuel');
      await page.getByTestId('save-splits-btn').click();
      await expect(splitModal).toBeHidden();

      await page.getByTestId('modal-close-done-btn').click();
      await expect(page.getByTestId('account-inspection-modal')).toBeHidden();

      const lentCard = page.getByTestId('loan-card-2');
      await lentCard.scrollIntoViewIfNeeded();
      await expect(page.getByTestId('loans-receivables-pill')).toContainText('Owed to Me: $10,500.00 NZD');
      await expect(lentCard).toContainText('$10,500.00 NZD');
      await expect(lentCard).toContainText('/ $10,500.00 NZD');
    });
  });
}
