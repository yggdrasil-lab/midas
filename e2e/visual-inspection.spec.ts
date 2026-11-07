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
      const simTab = page.locator('button:has-text("Simulator"), button:has-text("Time Machine")').locator('visible=true').first();
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
        fullPage: true,
      });

      // 4. Statement Ingestion Hub
      const stmtTab = page.locator('button:has-text("Statement"), button:has-text("Statement Hub")').locator('visible=true').first();
      if (await stmtTab.isVisible()) {
        await stmtTab.click();
      }
      await expect(page.locator('text=Statement Ingestion Hub >> visible=true').first()).toBeVisible();
      await page.waitForTimeout(300);
      await page.screenshot({
        path: `screenshots/${platform}/04-statement-dropzone.png`,
        fullPage: true,
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

      // 6. Budgets & Spending Breakdown
      const budgetTab = page.locator('header nav button:has-text("Spending & Budgets"), nav[aria-label="Main Mobile Navigation"] button:has-text("Budgets")').locator('visible=true').first();
      if (await budgetTab.isVisible()) {
        await budgetTab.click();
        await expect(page.locator('text=Category Spending & Budgets >> visible=true').first()).toBeVisible();
        await page.waitForTimeout(300);
        await page.screenshot({
          path: `screenshots/${platform}/06-budgets-and-spending-breakdown.png`,
          fullPage: true,
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
      }
    });
  });
}
