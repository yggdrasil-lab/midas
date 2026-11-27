import { test, expect, devices, type Page } from '@playwright/test';
import { setupCashflowMockApi, setupMockApi } from './helpers/mock-data';
import {
  assertCardMetricsWithinBounds,
  assertLoanRowHasNoOverlap,
} from './helpers/layout-assertions';

async function captureCashflowModalScreenshots(page: Page, platform: string): Promise<void> {
  await setupCashflowMockApi(page);
  await page.goto('/');

  const inflowCard = page.locator('[data-testid="summary-card-inflow"] >> visible=true').first();
  await inflowCard.scrollIntoViewIfNeeded();
  await inflowCard.click();

  const modal = page.getByTestId('cashflow-inspection-modal');
  await expect(modal).toBeVisible();
  await expect(modal).toContainText('Northwind Salary');
  await expect(modal.getByTestId('cashflow-select-category-902')).toHaveValue('Dividends');
  await page.waitForTimeout(250);
  await page.screenshot({ path: `screenshots/${platform}/20-cashflow-inflow-modal.png` });

  await modal.getByTestId('cashflow-modal-flow-outflow').click();
  await expect(modal).toContainText('Fixed + 52w');
  await expect(modal).toContainText('Harbour Fresh Market');
  const excluded = modal.getByTestId('cashflow-excluded-section');
  await expect(excluded).toContainText('Excluded (1): $450.00 NZD');
  await excluded.locator('button').first().click();
  await expect(excluded.getByTestId('cashflow-excluded-list')).toContainText('Alex Tan Advance');
  await page.waitForTimeout(250);
  await page.screenshot({ path: `screenshots/${platform}/21-cashflow-outflow-modal.png` });
}

const PLATFORMS = [
  {
    name: 'ios',
    options: {
      viewport: devices['iPhone 14'].viewport,
      userAgent: devices['iPhone 14'].userAgent,
      deviceScaleFactor: devices['iPhone 14'].deviceScaleFactor,
      isMobile: devices['iPhone 14'].isMobile,
      hasTouch: devices['iPhone 14'].hasTouch,
    },
  },
  {
    name: 'android',
    options: {
      viewport: devices['Pixel 7'].viewport,
      userAgent: devices['Pixel 7'].userAgent,
      deviceScaleFactor: devices['Pixel 7'].deviceScaleFactor,
      isMobile: devices['Pixel 7'].isMobile,
      hasTouch: devices['Pixel 7'].hasTouch,
    },
  },
  {
    name: 'desktop',
    options: {
      viewport: { width: 1280, height: 800 },
      isMobile: false,
      hasTouch: false,
    },
  },
];

for (const { name: platform, options } of PLATFORMS) {
  test.describe(`Visual Inspection - ${platform.toUpperCase()}`, () => {
    test.use({
      ...options,
    });

    test.beforeEach(async ({ page }) => {
      await setupMockApi(page);
      await page.goto('/');
    });

    test(`captures full visual progression on ${platform}`, async ({ page }) => {
      test.setTimeout(60000);
      // 1. Dashboard Overview
      await expect(page.locator('header h1')).toBeVisible();
      await expect(page.locator('text=Financial Freedom Clock >> visible=true')).toBeVisible();
      const themeTokens = await page.evaluate(() => {
        const root = document.documentElement;
        const styles = getComputedStyle(root);
        return {
          theme: root.dataset.theme,
          accent: styles.getPropertyValue('--ui-accent').trim(),
          radiusCard: styles.getPropertyValue('--ui-radius-card').trim(),
        };
      });
      expect(themeTokens.theme).toBe('midas');
      expect(themeTokens.accent).toBe('212 160 56');
      expect(themeTokens.radiusCard).toBe('10px');
      await page.waitForTimeout(400);
      await page.screenshot({
        path: `screenshots/${platform}/01-dashboard-overview.png`,
        fullPage: platform === 'desktop',
      });

      if (platform !== 'desktop') {
        // Capture scrolled mobile view to inspect categories with bottom nav fixed
        await page.evaluate(() => window.scrollBy(0, 500));
        await page.waitForTimeout(300);
        await page.screenshot({
          path: `screenshots/${platform}/01b-dashboard-overview-scrolled.png`,
        });
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.waitForTimeout(200);
      }

      // 1c & 1d. Burn Breakdown Modal (Recurring Fixed Commitments & Variable Category %)
      const inspectRecurringBtn = page.locator('[data-testid="inspect-recurring-burn-btn"] >> visible=true').first();
      if (await inspectRecurringBtn.isVisible()) {
        await inspectRecurringBtn.scrollIntoViewIfNeeded();
        await inspectRecurringBtn.click();
        await expect(page.getByRole('heading', { name: 'Weekly Burn Anatomy' })).toBeVisible();
        await expect(page.getByTestId('recurring-commitment-row').first()).toBeVisible();
        await page.waitForTimeout(250);
        await page.screenshot({
          path: `screenshots/${platform}/01c-burn-breakdown-recurring.png`,
        });

        await page.getByTestId('burn-tab-variable').click();
        await expect(page.getByTestId('variable-category-row').first()).toBeVisible();
        await page.waitForTimeout(250);
        await page.screenshot({
          path: `screenshots/${platform}/01d-burn-breakdown-variable-pct.png`,
        });

        const burnModalClose = page.locator('button[aria-label="Close dialog"] >> visible=true').first();
        if (await burnModalClose.isVisible()) {
          await burnModalClose.click();
        } else {
          await page.keyboard.press('Escape');
        }
        await expect(page.getByRole('heading', { name: 'Weekly Burn Anatomy' })).toBeHidden();
        await page.waitForTimeout(200);
      }

      // 2. Quick Log Modal
      const quickLogBtn = page.locator('button:has-text("Quick Log"), button:has-text("Log Expense")').locator('visible=true').first();
      await expect(quickLogBtn).toBeVisible();
      await quickLogBtn.click();
      await expect(page.getByRole('heading', { name: 'Log Quick Expense' })).toBeVisible();

      // Enter a sample amount on keypad
      await page.getByRole('button', { name: '2', exact: true }).click();
      await page.getByRole('button', { name: '5', exact: true }).click();
      await page.getByPlaceholder(/Merchant \/ Note/i).fill('Matakana Coffee');
      await page.waitForTimeout(300);
      await page.screenshot({
        path: `screenshots/${platform}/02-quick-log-modal.png`,
      });

      // Close modal
      const closeBtn = page.locator('button:has(svg.lucide-x)');
      if (await closeBtn.isVisible()) {
        await closeBtn.click();
      } else {
        await page.keyboard.press('Escape');
      }
      await page.waitForTimeout(200);

      // 3. Tools Hub & Time Machine Simulator
      const toolsTab = page.locator('header nav button:has-text("Tools"), nav button:has-text("Tools")').locator('visible=true').first();
      await expect(toolsTab).toBeVisible();
      await toolsTab.click();
      await expect(page.locator('text=Tools & Power Utilities >> visible=true').first()).toBeVisible();
      await expect(page.locator('text=Time Machine & Scenario Modeler >> visible=true').first()).toBeVisible();
      // Trigger simulation to display simulated horizon
      await page.locator('button:has-text("Recalculate Freedom Horizon") >> visible=true').first().click();
      await expect(page.locator('text=228 Weeks >> visible=true').first()).toBeVisible();
      await page.waitForTimeout(300);
      await page.screenshot({
        path: `screenshots/${platform}/03-time-machine-simulator.png`,
      });

      // 4. Statement Ingestion Hub inside Tools
      await page.getByTestId('tools-workspace-statement').click();
      await expect(page.locator('text=Statement Ingestion Hub >> visible=true').first()).toBeVisible();
      await page.waitForTimeout(300);
      await page.screenshot({
        path: `screenshots/${platform}/04-statement-dropzone.png`,
      });

      // 5. AI Freedom Advisor Modal
      await page.getByTestId('tools-workspace-simulator').click();
      const aiAdvisorBtn = page.locator('button:has-text("AI Freedom Advisor") >> visible=true').first();
      if (await aiAdvisorBtn.isVisible()) {
        await aiAdvisorBtn.click();
        await expect(page.getByRole('heading', { name: 'AI Freedom Runway Advisor' })).toBeVisible();
        await page.waitForTimeout(300);
        await page.screenshot({
          path: `screenshots/${platform}/05-ai-freedom-advisor-modal.png`,
        });
        const modalClose = page.locator('button:has(svg.lucide-x)').locator('visible=true').first();
        if (await modalClose.isVisible()) {
          await modalClose.click();
        } else {
          await page.keyboard.press('Escape');
        }
      }

      // 5b. Dedicated Per-Account View & Ledger
      const accountsTab = page.locator('header nav button:has-text("Accounts"), nav button:has-text("Accounts")').locator('visible=true').first();
      if (await accountsTab.isVisible()) {
        await accountsTab.click();
        await expect(page.locator('text=Accounts & Per-Account Ledger >> visible=true').first()).toBeVisible();
        const syncNowBtn = page.locator('[data-testid="sync-now-btn"] >> visible=true').first();
        await expect(syncNowBtn).toBeVisible();
        await syncNowBtn.click();
        await expect(page.locator('[data-testid="account-success-banner"] >> visible=true').first()).toBeVisible();
        await expect(page.locator('text=Synced 3 accounts: 5 new transactions >> visible=true').first()).toBeVisible();
        await page.waitForTimeout(300);
        await page.screenshot({
          path: `screenshots/${platform}/05b-per-account-view.png`,
        });

        const backstopSection = page.getByTestId('credit-backstop-section');
        await backstopSection.scrollIntoViewIfNeeded();
        await expect(backstopSection).toBeVisible();
        await expect(backstopSection).toContainText('SG Synthetic Cashline');
        await expect(backstopSection).toContainText('No grace period');
        await page.waitForTimeout(250);
        await page.screenshot({
          path: `screenshots/${platform}/05c-credit-backstop-section.png`,
        });

        await page.getByTestId('edit-account-btn-8').click();
        await expect(page.getByTestId('edit-account-modal')).toBeVisible();
        await page.waitForTimeout(250);
        await page.screenshot({
          path: `screenshots/${platform}/05e-edit-account-modal.png`,
        });
        await page.getByTestId('edit-account-cancel-btn').click();
        await expect(page.getByTestId('edit-account-modal')).toBeHidden();

        // 5b-ii. Open Account Inspection Modal Popup by clicking an account card (consistent with Budgets UI)
        const asbCard = page.locator('[data-testid="account-card-1"] >> visible=true').first();
        if (await asbCard.isVisible()) {
          await asbCard.click();
          await expect(page.getByRole('heading', { name: /Inspect Account: ASB Everyday Checking/i })).toBeVisible();
          await expect(page.locator('text=Pak n Save Albany >> visible=true').first()).toBeVisible();
          await page.waitForTimeout(300);
          await page.screenshot({
            path: `screenshots/${platform}/05d-account-inspection-modal.png`,
          });

          // Change category selector in modal (then restore to Groceries for category inspection step)
          const catSelect = page.locator('[data-testid="modal-select-category-101"] >> visible=true').first();
          await expect(catSelect).toBeVisible();
          await catSelect.selectOption('Food');
          await expect(page.locator('text=Moved transaction to "Food" >> visible=true').first()).toBeVisible();
          await catSelect.selectOption('Groceries');
          await expect(page.locator('text=Moved transaction to "Groceries" >> visible=true').first()).toBeVisible();

          // Link debit transaction 140 to borrowed loan and inflow 142/143 to lent loan with partial amount
          const loanSelect = page.locator('[data-testid="modal-select-loan-140"] >> visible=true').first();
          await expect(loanSelect).toBeVisible();
          await loanSelect.scrollIntoViewIfNeeded();
          await loanSelect.selectOption('1');
          const loanFlowPill = page.locator('[data-testid="loan-flow-140"] >> visible=true').first();
          await expect(loanFlowPill).toBeVisible();
          await expect(loanFlowPill).toContainText('ASB Everyday Checking');
          await expect(loanFlowPill).toContainText('Toyota Corolla Cross (TFS)');

          const splitBtn142 = page.locator('[data-testid="split-tx-btn-142"] >> visible=true').first();
          await expect(splitBtn142).toBeVisible();
          await splitBtn142.scrollIntoViewIfNeeded();
          await splitBtn142.click();
          const splitModal142 = page.locator('[data-testid="transaction-split-modal"] >> visible=true').first();
          await expect(splitModal142).toBeVisible();
          await page.locator('[data-testid="split-amount-0"] >> visible=true').first().fill('5000');
          await expect(page.locator('[data-testid="split-amount-1"] >> visible=true').first()).toHaveValue('20.00');
          await page.locator('[data-testid="split-category-0"] >> visible=true').first().selectOption('Debt & Loans');
          await page.locator('[data-testid="split-loan-0"] >> visible=true').first().selectOption('2');
          await page.locator('[data-testid="split-category-1"] >> visible=true').first().selectOption('Family');
          await page.locator('[data-testid="split-notes-1"] >> visible=true').first().fill('Food split');
          await page.locator('[data-testid="save-splits-btn"] >> visible=true').first().click();
          await expect(splitModal142).toBeHidden();

          await expect(page.locator('[data-testid="open-split-badge-142"] >> visible=true').first()).toContainText('Split (2)');
          await expect(page.locator('[data-testid="split-summary-142"] >> visible=true').first()).toContainText('Debt & Loans');
          const lentFlowPill = page.locator('[data-testid="loan-flow-142"] >> visible=true').first();
          await expect(lentFlowPill).toBeVisible();
          await expect(lentFlowPill).toContainText('$5,000.00 of $5,020.00');

          const loanSelect143 = page.locator('[data-testid="modal-select-loan-143"] >> visible=true').first();
          await expect(loanSelect143).toBeVisible();
          await loanSelect143.selectOption('2');

          const splitBtn144 = page.locator('[data-testid="split-tx-btn-144"] >> visible=true').first();
          await expect(splitBtn144).toBeVisible();
          await splitBtn144.scrollIntoViewIfNeeded();
          await splitBtn144.click();
          const splitModal144 = page.locator('[data-testid="transaction-split-modal"] >> visible=true').first();
          await expect(splitModal144).toBeVisible();
          await expect(page.locator('[data-testid="split-sign-0"] >> visible=true').first()).toHaveText('+');
          await page.locator('[data-testid="split-amount-0"] >> visible=true').first().fill('+1000');
          await expect(page.locator('[data-testid="split-sign-1"] >> visible=true').first()).toHaveText('-');
          await expect(page.locator('[data-testid="split-amount-1"] >> visible=true').first()).toHaveValue('862.83');
          await expect(page.locator('[data-testid="split-allocation-pill"] >> visible=true').first()).toContainText('Balanced');
          await page.locator('[data-testid="split-category-0"] >> visible=true').first().selectOption('Debt & Loans');
          await page.locator('[data-testid="split-loan-0"] >> visible=true').first().selectOption('2');
          await page.locator('[data-testid="split-category-1"] >> visible=true').first().selectOption('Travel');
          await page.locator('[data-testid="split-notes-1"] >> visible=true').first().fill('Christchurch trip');
          await page.waitForTimeout(250);
          await page.screenshot({
            path: `screenshots/${platform}/14c-transaction-split-modal.png`,
          });
          await page.locator('[data-testid="save-splits-btn"] >> visible=true').first().click();
          await expect(splitModal144).toBeHidden();

          await expect(page.locator('[data-testid="open-split-badge-144"] >> visible=true').first()).toContainText('Split (2)');
          const splitSummary144 = page.locator('[data-testid="split-summary-144"] >> visible=true').first();
          await expect(splitSummary144).toContainText('+$1,000.00');
          await expect(splitSummary144).toContainText('-$862.83');
          const lentFlowPill144 = page.locator('[data-testid="loan-flow-144"] >> visible=true').first();
          await expect(lentFlowPill144).toBeVisible();
          await expect(lentFlowPill144).toContainText('$1,000.00 (from +$137.17 net)');
          await lentFlowPill144.scrollIntoViewIfNeeded();

          await assertLoanRowHasNoOverlap(page, 140);
          await assertLoanRowHasNoOverlap(page, 142);
          await assertLoanRowHasNoOverlap(page, 144);

          await page.waitForTimeout(250);
          await page.screenshot({
            path: `screenshots/${platform}/14b-loan-flow-pill.png`,
          });

          const doneBtn = page.locator('[data-testid="modal-close-done-btn"] >> visible=true').first();
          if (await doneBtn.isVisible()) {
            await doneBtn.click();
          } else {
            await page.keyboard.press('Escape');
          }
          await page.waitForTimeout(200);

          // Capture updated two-way LoansTracker cards (I Owe + Owed to Me) + expanded Linked Repayments
          const loanCard = page.locator('[data-testid="loan-card-1"] >> visible=true').first();
          if (await loanCard.isVisible()) {
            await expect(loanCard).toContainText('1/36 posted');
            await expect(loanCard).toContainText('35/36 left');
            const paymentsToggle = loanCard.getByRole('button', { name: /Linked Payments/i });
            await paymentsToggle.scrollIntoViewIfNeeded();
            await paymentsToggle.click();
            await expect(page.locator('[data-testid="loan-payments-list-1"] >> visible=true').first()).toContainText('Toyota Financial Services');

            const lentCard = page.locator('[data-testid="loan-card-2"] >> visible=true').first();
            if (await lentCard.isVisible()) {
              await expect(lentCard).toContainText('70% repaid');
              const lentToggle = lentCard.getByRole('button', { name: /Linked Repayments/i });
              await lentToggle.scrollIntoViewIfNeeded();
              await lentToggle.click();
              await expect(page.locator('[data-testid="loan-payments-list-2"] >> visible=true').first()).toContainText('$5,000.00 NZD');
              await lentCard.scrollIntoViewIfNeeded();
              await assertCardMetricsWithinBounds(lentCard);
            } else {
              await loanCard.scrollIntoViewIfNeeded();
            }

            await page.waitForTimeout(300);
            await page.screenshot({
              path: `screenshots/${platform}/14-loans-overview.png`,
            });
          }
        }

        // 5b-iii. Inspect Manulife (SGD) Counterpart Flow Modal
        const manulifeCard = page.locator('[data-testid="account-card-5"] >> visible=true').first();
        if (await manulifeCard.isVisible()) {
          await manulifeCard.click();
          await expect(page.getByRole('heading', { name: /Inspect Account: Manulife/i })).toBeVisible();
          const manulifeModal = page.locator('[data-testid="account-inspection-modal"] >> visible=true').first();
          await expect(manulifeModal).toContainText('14,527.89 SGD');
          const row131 = page.locator('[data-testid="account-modal-tx-row-131"] >> visible=true').first();
          const row132 = page.locator('[data-testid="account-modal-tx-row-132"] >> visible=true').first();
          await expect(row131).toBeVisible();
          await expect(row132).toBeVisible();
          await expect(page.locator('[data-testid="counterpart-flow-132"] >> visible=true').first()).toBeVisible();
          await row132.scrollIntoViewIfNeeded();
          await page.waitForTimeout(300);
          await page.screenshot({
            path: `screenshots/${platform}/18-manulife-counterpart-modal.png`,
          });

          const doneBtn = page.locator('[data-testid="modal-close-done-btn"] >> visible=true').first();
          if (await doneBtn.isVisible()) {
            await doneBtn.click();
          } else {
            await page.keyboard.press('Escape');
          }
          await page.waitForTimeout(200);
        }

        // Open Record Balance Valuation Snapshot Modal
        const recordSnapshotBtn = page.locator('button:has-text("Record Valuation Snapshot"), button:has-text("Record Snapshot")').locator('visible=true').first();
        if (await recordSnapshotBtn.isVisible()) {
          await recordSnapshotBtn.click();
          await expect(page.getByRole('heading', { name: /Record Balance Valuation Snapshot/i })).toBeVisible();
          await page.waitForTimeout(300);
          await page.screenshot({
            path: `screenshots/${platform}/05c-record-snapshot-modal.png`,
          });
          const modalClose = page.locator('button:has(svg.lucide-x)').locator('visible=true').first();
          if (await modalClose.isVisible()) {
            await modalClose.click();
          } else {
            await page.keyboard.press('Escape');
          }
        }
      }

      // 6. Budgets & Spending Breakdown
      const budgetTab = page.locator('header nav button:has-text("Spending & Budgets"), nav button:has-text("Budgets")').locator('visible=true').first();
      if (await budgetTab.isVisible()) {
        await budgetTab.click();
      }

      const categorySection = page.locator('text=Category Spending & Budgets >> visible=true').first();
      if (await categorySection.isVisible()) {
        await page.waitForTimeout(300);
        await page.screenshot({
          path: `screenshots/${platform}/06-budgets-and-spending-breakdown.png`,
        });

        // 7. Budget Config Modal
        const editBudgetsBtn = page.locator('button:has-text("Manage Limits") >> visible=true').first();
        if (await editBudgetsBtn.isVisible()) {
          await editBudgetsBtn.click();
          await expect(page.getByRole('heading', { name: 'Category Budget Guardrails' })).toBeVisible();
          await page.waitForTimeout(300);
          await page.screenshot({
            path: `screenshots/${platform}/07-budget-config-modal.png`,
          });
          const modalClose = page.locator('button:has(svg.lucide-x)').locator('visible=true').first();
          if (await modalClose.isVisible()) {
            await modalClose.click();
          } else {
            await page.keyboard.press('Escape');
          }
        }

        // 8. Category Transaction Inspection & Re-categorization Modal
        const groceriesCategoryCard = page.locator('[data-testid="category-row-groceries"] >> visible=true').first();
        if (await groceriesCategoryCard.isVisible()) {
          await groceriesCategoryCard.click();
          await expect(page.getByRole('heading', { name: /Inspect Category: Groceries/i })).toBeVisible();
          await expect(page.locator('text=Pak n Save Albany >> visible=true').first()).toBeVisible();
          await page.waitForTimeout(300);
          await page.screenshot({
            path: `screenshots/${platform}/08-category-inspection-modal.png`,
          });

          // Click the Receipt badge on Pak n Save Albany to inspect photo & edit item category
          const openReceiptBtn = page.locator('[data-testid="open-receipt-101"] >> visible=true').first();
          if (await openReceiptBtn.isVisible()) {
            await openReceiptBtn.click();
            const receiptModal = page.locator('[data-testid="receipt-detail-modal"] >> visible=true').first();
            await expect(receiptModal).toBeVisible();
            await expect(receiptModal.locator('text=Chemist Warehouse Albany')).toBeVisible();
            await expect(receiptModal.locator('text=Vitamin C 1000mg 150 Tablets')).toBeVisible();
            await expect(receiptModal.locator('[data-testid="inherited-item-tag-1-weekly-shop"]')).toBeVisible();
            await page.waitForTimeout(300);
            await page.screenshot({
              path: `screenshots/${platform}/08c-receipt-detail-modal.png`,
            });

            const itemCategorySelect = receiptModal.locator('[data-testid="receipt-item-category-1"]');
            await expect(itemCategorySelect).toBeVisible();
            await itemCategorySelect.selectOption('Personal Care');
            await expect(itemCategorySelect).toHaveValue('Personal Care');

            await receiptModal.getByRole('button', { name: 'Done' }).click();
            await expect(receiptModal).toBeHidden();
          }

          // Change category selector to Food
          const categorySelect = page.locator('select[aria-label="Category for Pak n Save Albany"] >> visible=true').first();
          if (await categorySelect.isVisible()) {
            await categorySelect.selectOption('Food');
            await expect(page.locator('text=Moved transaction to "Food" >> visible=true')).toBeVisible();
          }

          const modalClose = page.locator('button:has(svg.lucide-x)').locator('visible=true').first();
          if (await modalClose.isVisible()) {
            await modalClose.click();
          } else {
            await page.keyboard.press('Escape');
          }
        }

        // 8b. Transfers Inspection & Reconcile Now Modal
        const transfersCategoryCard = page.locator('[data-testid="category-row-transfers"] >> visible=true').first();
        if (await transfersCategoryCard.isVisible()) {
          await transfersCategoryCard.click();
          await expect(page.getByRole('heading', { name: /Inspect Category: Transfers/i })).toBeVisible();
          await expect(page.locator('text=Wise Transfer to USD >> visible=true').first()).toBeVisible();
          await expect(page.locator('text=FX (0.6061) >> visible=true').first()).toBeVisible();
          await page.waitForTimeout(300);
          await page.screenshot({
            path: `screenshots/${platform}/08b-transfers-inspection-modal.png`,
          });

          // Test Reconcile Transfers button
          const reconcileTransfersBtn = page.locator('button:has-text("Reconcile Transfers Now") >> visible=true').first();
          if (await reconcileTransfersBtn.isVisible()) {
            await reconcileTransfersBtn.click();
            await expect(page.locator('text=reconciled and paired >> visible=true')).toBeVisible();
          }

          const modalClose = page.locator('button:has(svg.lucide-x)').locator('visible=true').first();
          if (await modalClose.isVisible()) {
            await modalClose.click();
          } else {
            await page.keyboard.press('Escape');
          }
        }

        // 8d. Utilities Category Inspection with Amortized Recurring Commitments
        const utilitiesCategoryCard = page.locator('[data-testid="category-row-utilities"] >> visible=true').first();
        if (await utilitiesCategoryCard.isVisible()) {
          await utilitiesCategoryCard.scrollIntoViewIfNeeded();
          await expect(utilitiesCategoryCard).toContainText('2 + 2 fixed');
          await page.waitForTimeout(200);
          await page.screenshot({
            path: `screenshots/${platform}/06b-budgets-amortized-row.png`,
          });
          await utilitiesCategoryCard.click();
          await expect(page.getByRole('heading', { name: /Inspect Category: Utilities/i })).toBeVisible();
          const amortizedSection = page.getByTestId('amortized-commitments-section');
          await expect(amortizedSection).toBeVisible();
          await page.getByTestId('category-inspection-scroll-container').evaluate((container) => {
            const target = container.querySelector('[data-testid="amortized-commitments-section"]') as HTMLElement | null;
            if (target) {
              container.scrollTop = Math.max(0, target.offsetTop - container.offsetTop);
            } else {
              container.scrollTop = container.scrollHeight;
            }
          });
          await page.waitForTimeout(300);
          await page.screenshot({
            path: `screenshots/${platform}/08d-category-amortized-inspection.png`,
          });

          const modalClose = page.locator('button:has(svg.lucide-x)').locator('visible=true').first();
          if (await modalClose.isVisible()) {
            await modalClose.click();
          } else {
            await page.keyboard.press('Escape');
          }
        }

        // 9. Outlook-Style Categorization Rules Manager Modal (inside Tools Hub)
        await toolsTab.click();
        await expect(page.locator('text=Tools & Power Utilities >> visible=true').first()).toBeVisible();
        const rulesBtn = page.locator('[data-testid="rules-manager-btn"] >> visible=true').first();
        if (await rulesBtn.isVisible()) {
          await rulesBtn.click();
          await expect(page.getByRole('heading', { name: /Outlook-Style Categorization Rules/i })).toBeVisible();
          await expect(page.locator('text=Utilities Regular >> visible=true').first()).toBeVisible();
          await page.waitForTimeout(300);
          await page.screenshot({
            path: `screenshots/${platform}/09-rules-manager-modal.png`,
          });

          // Open Create Rule Form
          const newRuleBtn = page.getByRole('button', { name: /New Rule/i }).locator('visible=true').first();
          if (await newRuleBtn.isVisible()) {
            await newRuleBtn.click();
            await expect(page.locator('text=Create Outlook-Style Rule >> visible=true')).toBeVisible();
            const saveBtn = page.locator('button:has-text("Save Rule") >> visible=true').first();
            if (await saveBtn.isVisible()) {
              await saveBtn.scrollIntoViewIfNeeded();
            }
            await page.waitForTimeout(300);
            await page.screenshot({
              path: `screenshots/${platform}/10-rules-create-form.png`,
            });

            // Cancel the create form
            const cancelBtn = page.getByRole('button', { name: /Cancel/i }).locator('visible=true').first();
            if (await cancelBtn.isVisible()) {
              await cancelBtn.click();
            }
          }

          // Close the Rules Manager modal cleanly
          const doneBtn = page.getByRole('button', { name: /Done/i }).locator('visible=true').first();
          if (await doneBtn.isVisible()) {
            await doneBtn.click();
          } else {
            await page.keyboard.press('Escape');
          }
          await expect(page.getByRole('heading', { name: /Outlook-Style Categorization Rules/i })).toBeHidden();
        }

        // 9B. Dynamic Categories & Hierarchy Manager Modal + Create Form
        const categoriesBtn = page.locator('[data-testid="categories-manager-btn"] >> visible=true').first();
        if (await categoriesBtn.isVisible()) {
          await categoriesBtn.click();
          await expect(page.getByRole('heading', { name: /Categories & Hierarchy/i })).toBeVisible();
          await expect(page.getByTestId('category-row-alcohol')).toBeVisible();
          await expect(page.getByTestId('category-row-finance')).toBeVisible();
          await page.waitForTimeout(300);
          await page.screenshot({
            path: `screenshots/${platform}/18-categories-manager-modal.png`,
          });

          const newCatBtn = page.getByTestId('new-category-btn').locator('visible=true').first();
          if (await newCatBtn.isVisible()) {
            await newCatBtn.click();
            await expect(page.getByTestId('category-editor-form')).toBeVisible();
            await page.waitForTimeout(300);
            await page.screenshot({
              path: `screenshots/${platform}/19-categories-create-form.png`,
            });

            const cancelCatBtn = page.getByRole('button', { name: /Cancel/i }).locator('visible=true').first();
            if (await cancelCatBtn.isVisible()) {
              await cancelCatBtn.click();
            }
          }

          const catDoneBtn = page.getByRole('button', { name: /Done/i }).locator('visible=true').first();
          if (await catDoneBtn.isVisible()) {
            await catDoneBtn.click();
          } else {
            await page.keyboard.press('Escape');
          }
          await expect(page.getByRole('heading', { name: /Categories & Hierarchy/i })).toBeHidden();
        }

        // 10. Receipts & Granular Product Hub Feed Modal
        const needsReviewToolBadge = page.locator('[data-testid="receipts-needs-review-badge"] >> visible=true').first();
        await expect(needsReviewToolBadge).toContainText('1 Needs Review');

        const receiptsBtn = page.locator('[data-testid="spending-receipts-btn"], [data-testid="receipts-hub-btn"], [data-testid="header-receipts-btn"]').locator('visible=true').first();
        if (await receiptsBtn.isVisible()) {
          await receiptsBtn.click();
          await expect(page.getByRole('heading', { name: /Receipts &.*Hub/i })).toBeVisible();
          await expect(page.locator('text=Chemist Warehouse Albany >> visible=true').first()).toBeVisible();
          await expect(page.locator('text=Sydney Roasters Online >> visible=true').first()).toBeVisible();
          await expect(page.locator('text=AUD 179.74 >> visible=true').first()).toBeVisible();
          await expect(page.locator('[data-testid="receipt-row-3"] >> visible=true').first()).toContainText('Needs Review');
          await expect(page.locator('[data-testid="receipt-row-4"] >> visible=true').first()).toContainText('Payslip');
          await expect(page.locator('[data-testid="receipt-row-4"] >> visible=true').first()).toContainText('Acme Corp');
          // Expand first receipt item
          const expandBtn = page.locator('[data-testid="receipt-row-1"] >> visible=true').first();
          if (await expandBtn.isVisible()) {
            await expandBtn.click();
            await expect(page.locator('text=Itemized Breakdown >> visible=true').first()).toBeVisible();
          }
          await page.waitForTimeout(300);
          await page.screenshot({
            path: `screenshots/${platform}/11-receipts-hub-feed.png`,
          });

          // Expand cross-currency needs_review receipt to inspect suggested candidates & 1-tap Link
          const needsReviewRow = page.locator('[data-testid="receipt-row-3"] >> visible=true').first();
          await expect(needsReviewRow).toBeVisible();
          await needsReviewRow.scrollIntoViewIfNeeded();
          await needsReviewRow.click();
          await expect(page.locator('[data-testid="receipt-order-3"] >> visible=true').first()).toContainText('ORD-48219');
          const candidatesPanel = page.locator('[data-testid="receipt-candidates-panel-3"] >> visible=true').first();
          await expect(candidatesPanel).toBeVisible();
          await expect(candidatesPanel).toContainText('Suggested Matches');
          await expect(candidatesPanel).toContainText('Orig. AUD 179.74');
          await expect(candidatesPanel).toContainText('94% match');
          const linkCandidateBtn = page.locator('[data-testid="link-receipt-candidate-3-201"] >> visible=true').first();
          await expect(linkCandidateBtn).toBeVisible();
          const linkBtnBox = await linkCandidateBtn.boundingBox();
          expect(linkBtnBox).not.toBeNull();
          expect(linkBtnBox!.height).toBeGreaterThanOrEqual(44);
          await linkCandidateBtn.scrollIntoViewIfNeeded();
          await page.waitForTimeout(300);
          await page.screenshot({
            path: `screenshots/${platform}/11b-receipts-needs-review-candidates.png`,
          });

          await linkCandidateBtn.click();
          await expect(page.locator('[data-testid="receipts-hub-status-banner"] >> visible=true').first()).toContainText('Linked "Sydney Roasters Online"');
          await expect(page.locator('[data-testid="receipt-row-3"] >> visible=true').first()).toContainText('Matched to Ledger');
          await expect(page.locator('[data-testid="receipt-candidates-panel-3"]')).toHaveCount(0);

          // Verify deleting an unlinked receipt from the UI removes it
          const deleteBtn = page.locator('[data-testid="delete-receipt-2"] >> visible=true').first();
          if (await deleteBtn.isVisible()) {
            await deleteBtn.click();
            await expect(page.locator('text=Bunnings Warehouse >> visible=true')).toHaveCount(0);
          }

          // 11. Product Inventory, Tags & Historical Price Telemetry Tab
          const productsTab = page.locator('button:has-text("Products & Price History"), button:has-text("Product Longevity")').locator('visible=true').first();
          if (await productsTab.isVisible()) {
            await productsTab.click();
            await expect(page.locator('text=La Roche-Posay Pure Vitamin C10 Serum >> visible=true').first()).toBeVisible();

            // Expand Price History Timeline for visual inspection
            const historyBtn = page.locator('button:has-text("View Price History") >> visible=true').first();
            if (await historyBtn.isVisible()) {
              await historyBtn.click();
              await expect(page.locator('text=Hide Price Timeline >> visible=true').first()).toBeVisible();
            }

            await page.waitForTimeout(300);
            await page.screenshot({
              path: `screenshots/${platform}/12-product-longevity.png`,
            });
          }

          const modalClose = page.locator('button:has(svg.lucide-x)').locator('visible=true').first();
          if (await modalClose.isVisible()) {
            await modalClose.click();
          } else {
            await page.keyboard.press('Escape');
          }
        }
      }
    });

    test(`renders clickable PDF document card for PDF receipts on ${platform}`, async ({ page }) => {
      await page.route(/\/api\/receipts\/1$/, async (route) => {
        if (route.request().method() !== 'GET') {
          await route.fallback();
          return;
        }
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 1,
            transaction_id: 101,
            receipt_date: '2026-11-03',
            merchant: 'Chemist Warehouse Albany',
            total_amount: 74.98,
            currency: 'NZD',
            status: 'matched',
            has_image: true,
            is_processed: true,
            image_mime_type: 'application/pdf',
            image_filename: 'TaxInvoice.pdf',
            created_at: '2026-11-03T10:00:00Z',
            updated_at: '2026-11-03T10:00:00Z',
            items: [
              {
                id: 1,
                receipt_id: 1,
                item_name: 'Vitamin C 1000mg 150 Tablets',
                brand: 'Blackmores',
                category: 'Health',
                domain: '01-health',
                product_type: 'supplement',
                volume_ml: null,
                quantity: 1.0,
                unit_price: 34.99,
                discount_amount: 5.0,
                total_price: 29.99,
                inherited_tags: ['weekly-shop', 'pantry'],
                created_at: '2026-11-03T10:00:00Z',
              },
            ],
          }),
        });
      });

      const budgetTab = page
        .locator('header nav button:has-text("Spending & Budgets"), nav button:has-text("Budgets")')
        .locator('visible=true')
        .first();
      await expect(budgetTab).toBeVisible();
      await budgetTab.click();

      const groceriesCard = page.locator('[data-testid="category-row-groceries"] >> visible=true').first();
      await expect(groceriesCard).toBeVisible();
      await groceriesCard.click();

      const openReceiptBtn = page.locator('[data-testid="open-receipt-101"] >> visible=true').first();
      await expect(openReceiptBtn).toBeVisible();
      await openReceiptBtn.click();

      const receiptModal = page.locator('[data-testid="receipt-detail-modal"] >> visible=true').first();
      await expect(receiptModal).toBeVisible();

      const previewContainer = receiptModal.getByTestId('receipt-attachment-preview-1');
      await expect(previewContainer).toBeVisible();
      await expect(previewContainer).toContainText('Stored Receipt Document');
      await expect(previewContainer).toContainText('Open PDF');

      const pdfCard = previewContainer.getByTestId('receipt-pdf-card');
      await expect(pdfCard).toBeVisible();
      await expect(pdfCard).toContainText('TaxInvoice.pdf');
      await expect(pdfCard).toContainText('PDF Document');
      await expect(pdfCard).toHaveAttribute('href', '/api/receipts/1/image');
      await expect(pdfCard).toHaveAttribute('target', '_blank');
      await expect(pdfCard).toHaveAttribute('rel', 'noopener noreferrer');
      await expect(previewContainer.locator('img')).toHaveCount(0);

      const [previewBox, cardBox] = await Promise.all([
        previewContainer.boundingBox(),
        pdfCard.boundingBox(),
      ]);
      expect(previewBox).not.toBeNull();
      expect(cardBox).not.toBeNull();
      expect(cardBox!.height).toBeGreaterThanOrEqual(44);
      expect(cardBox!.x + cardBox!.width).toBeLessThanOrEqual(previewBox!.x + previewBox!.width + 1);

      await page.waitForTimeout(250);
      await page.screenshot({
        path: `screenshots/${platform}/08e-receipt-pdf-document-card.png`,
      });
    });

    test(`renders payslip badge, modal details, and PDF preview on ${platform}`, async ({ page }) => {
      const accountsTab = page
        .locator('header nav button:has-text("Accounts"), nav button:has-text("Accounts")')
        .locator('visible=true')
        .first();
      await expect(accountsTab).toBeVisible();
      await accountsTab.click();

      const asbCard = page.locator('[data-testid="account-card-1"] >> visible=true').first();
      await expect(asbCard).toBeVisible();
      await asbCard.click();

      const payslipTxRow = page.locator('[data-testid="account-modal-tx-row-150"] >> visible=true').first();
      await payslipTxRow.scrollIntoViewIfNeeded();
      await expect(payslipTxRow).toBeVisible();
      await expect(payslipTxRow).toContainText('Acme Corp Salary');
      await expect(payslipTxRow).toContainText('+$4,250.50 NZD');

      const openPayslipBtn = page.locator('[data-testid="open-receipt-150"] >> visible=true').first();
      await expect(openPayslipBtn).toBeVisible();
      await expect(openPayslipBtn).toHaveText('Payslip');
      await expect(openPayslipBtn).toHaveAttribute('title', 'Inspect attached payslip PDF');
      await page.waitForTimeout(250);
      await page.screenshot({
        path: `screenshots/${platform}/08e-income-payslip-row.png`,
      });
      await openPayslipBtn.click();

      const receiptModal = page.locator('[data-testid="receipt-detail-modal"] >> visible=true').first();
      await expect(receiptModal).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Payslip: Acme Corp' })).toBeVisible();
      await expect(receiptModal.getByTestId('receipt-detail-order-number')).toContainText(
        'Pay Period: 2026-11-01 to 2026-11-30'
      );
      const summarySubtext = receiptModal.getByTestId('receipt-detail-summary-subtext');
      await expect(summarySubtext).toContainText('PAYE Tax: $1,180.25');
      await expect(receiptModal).not.toContainText('0 items');

      if (platform !== 'desktop') {
        const netPayAmount = receiptModal.getByText('$4,250.50').first();
        const [amountBox, subtextBox] = await Promise.all([
          netPayAmount.boundingBox(),
          summarySubtext.boundingBox(),
        ]);
        expect(amountBox).not.toBeNull();
        expect(subtextBox).not.toBeNull();
        expect(Math.abs(amountBox!.y - subtextBox!.y)).toBeLessThan(12);
        expect(amountBox!.x).toBeLessThan(subtextBox!.x);
      }

      const previewContainer = receiptModal.getByTestId('receipt-attachment-preview-4');
      await expect(previewContainer).toBeVisible();
      await expect(previewContainer).toContainText('Stored Payslip Document');
      await expect(previewContainer).toContainText('Open PDF');

      const pdfCard = previewContainer.getByTestId('receipt-pdf-card');
      await expect(pdfCard).toBeVisible();
      await expect(pdfCard).toContainText('payslip.pdf');
      await expect(pdfCard).toHaveAttribute('href', '/api/receipts/4/image');

      const [previewBox, cardBox] = await Promise.all([
        previewContainer.boundingBox(),
        pdfCard.boundingBox(),
      ]);
      expect(previewBox).not.toBeNull();
      expect(cardBox).not.toBeNull();
      expect(cardBox!.height).toBeGreaterThanOrEqual(44);
      expect(cardBox!.x + cardBox!.width).toBeLessThanOrEqual(previewBox!.x + previewBox!.width + 1);

      const pdfResponse = await page.evaluate(async () => {
        const res = await fetch('/api/receipts/4/image');
        const text = await res.text();
        return {
          status: res.status,
          contentType: res.headers.get('content-type') || '',
          prefix: text.slice(0, 8),
        };
      });
      expect(pdfResponse.status).toBe(200);
      expect(pdfResponse.contentType).toContain('application/pdf');
      expect(pdfResponse.prefix).toBe('%PDF-1.4');

      await page.waitForTimeout(250);
      await page.screenshot({
        path: `screenshots/${platform}/08f-payslip-detail-modal.png`,
      });

      await receiptModal.getByRole('button', { name: 'Done' }).click();
      await expect(receiptModal).toBeHidden();
      await page.locator('[data-testid="modal-close-done-btn"] >> visible=true').first().click();

      const toolsTab = page
        .locator('header nav button:has-text("Tools"), nav button:has-text("Tools")')
        .locator('visible=true')
        .first();
      await toolsTab.click();
      await page.locator('[data-testid="receipts-hub-btn"] >> visible=true').first().click();

      const payslipFeedRow = page.locator('[data-testid="receipt-row-4"] >> visible=true').first();
      await payslipFeedRow.scrollIntoViewIfNeeded();
      await expect(payslipFeedRow).toBeVisible();
      await expect(payslipFeedRow).toContainText('Payslip');
      await expect(payslipFeedRow).toContainText('Matched to Ledger');
      await expect(payslipFeedRow).toContainText('Acme Corp');
      await payslipFeedRow.click();

      const payPeriodRow = page.locator('[data-testid="receipt-order-4"] >> visible=true').first();
      await expect(payPeriodRow).toBeVisible();
      await expect(payPeriodRow).toContainText('Pay Period');
      await expect(payPeriodRow).toContainText('2026-11-01 to 2026-11-30');
      await expect(payPeriodRow).not.toContainText('Order Ref');
      await expect(page.locator('[data-testid="receipt-paye-4"] >> visible=true').first()).toContainText(
        '$1,180.25'
      );
      const feedPreview = page.locator('[data-testid="receipt-attachment-preview-4"] >> visible=true').first();
      await expect(feedPreview).toContainText('Stored Payslip Document');
      const feedPdfCard = feedPreview.getByTestId('receipt-pdf-card');
      await expect(feedPdfCard).toBeVisible();
      await payslipFeedRow.evaluate((el) => {
        const card = el.parentElement;
        if (card) {
          card.scrollIntoView({ block: 'start' });
        }
      });
      await feedPdfCard.scrollIntoViewIfNeeded();
      await page.waitForTimeout(250);
      await page.screenshot({
        path: `screenshots/${platform}/11b-receipts-hub-payslip.png`,
      });
    });

    test(`captures cashflow inflow and outflow inspection modals on ${platform}`, async ({
      page,
    }) => {
      await captureCashflowModalScreenshots(page, platform);
    });
  });
}
