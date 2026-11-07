import { test, expect, devices } from '@playwright/test';
import { setupMockApi } from './helpers/mock-data';

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
      // 1. Dashboard Overview
      await expect(page.locator('header h1')).toBeVisible();
      await expect(page.locator('text=Financial Freedom Clock >> visible=true')).toBeVisible();
      await page.waitForTimeout(400);
      await page.screenshot({
        path: `screenshots/${platform}/01-dashboard-overview.png`,
        fullPage: true,
      });

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

      // 3. Time Machine Simulator
      const simTab = page.locator('header nav button:has-text("Time Machine"), nav button:has-text("Simulator")').locator('visible=true').first();
      if (await simTab.isVisible()) {
        await simTab.click();
      }
      await expect(page.locator('text=Time Machine & Scenario Modeler >> visible=true').first()).toBeVisible();
      // Trigger simulation to display simulated horizon
      await page.locator('button:has-text("Recalculate Freedom Horizon") >> visible=true').first().click();
      await expect(page.locator('text=228 Weeks >> visible=true').first()).toBeVisible();
      await page.waitForTimeout(300);
      await page.screenshot({
        path: `screenshots/${platform}/03-time-machine-simulator.png`,
        fullPage: platform !== 'desktop',
      });

      // 4. Statement Ingestion Hub
      const stmtTab = page.locator('header nav button:has-text("Statement Hub"), nav button:has-text("Statement")').locator('visible=true').first();
      if (await stmtTab.isVisible()) {
        await stmtTab.click();
      }
      await expect(page.locator('text=Statement Ingestion Hub >> visible=true').first()).toBeVisible();
      await page.waitForTimeout(300);
      await page.screenshot({
        path: `screenshots/${platform}/04-statement-dropzone.png`,
        fullPage: platform !== 'desktop',
      });

      // 5. AI Freedom Advisor Modal
      if (await simTab.isVisible()) {
        await simTab.click();
      }
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
        await page.waitForTimeout(300);
        await page.screenshot({
          path: `screenshots/${platform}/05b-per-account-view.png`,
          fullPage: platform !== 'desktop',
        });

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
          fullPage: platform !== 'desktop',
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

        // 9. Outlook-Style Categorization Rules Manager Modal
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

        // 10. Receipts & Granular Product Hub Feed Modal
        const receiptsBtn = page.locator('[data-testid="spending-receipts-btn"], [data-testid="receipts-hub-btn"], [data-testid="header-receipts-btn"]').locator('visible=true').first();
        if (await receiptsBtn.isVisible()) {
          await receiptsBtn.click();
          await expect(page.getByRole('heading', { name: /Receipts &.*Hub/i })).toBeVisible();
          await expect(page.locator('text=Chemist Warehouse Albany >> visible=true').first()).toBeVisible();
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
  });
}
