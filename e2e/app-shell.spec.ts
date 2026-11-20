import { test, expect } from '@playwright/test';
import { MOCK_RUNWAY_DATA, setupMockApi } from './helpers/mock-data';

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
    await expect(page.locator('text=/Cash Floor|Cash/ >> visible=true').first()).toBeVisible();
    await expect(page.locator('text=24 w >> visible=true').first()).toBeVisible();

    await expect(page.locator('text=Growth >> visible=true').first()).toBeVisible();
    await expect(page.locator('text=184 w >> visible=true').first()).toBeVisible();

    await expect(page.locator('text=/KiwiSaver|Locked Reserve|Locked/ >> visible=true').first()).toBeVisible();

    // Check weekly burn & average burn breakdown
    await expect(page.locator('text=Weekly Burn & Budget >> visible=true').first()).toBeVisible();
    await expect(page.locator('text=/Spent \\$750 of \\$1,?000/ >> visible=true').first()).toBeVisible();
    await expect(page.locator('text=+0.25 weeks banked >> visible=true').first()).toBeVisible();
    await expect(page.locator('text=Avg Burn/wk >> visible=true').first()).toBeVisible();
    await expect(page.locator('text=Recurring >> visible=true').first()).toBeVisible();
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
    await page.getByRole('button', { name: 'Dining' }).click();

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
    const toolsTab = page.locator('header nav button:has-text("Tools"), nav button:has-text("Tools")').locator('visible=true').first();
    await expect(toolsTab).toBeVisible();
    await toolsTab.click();

    await expect(page.locator('text=Tools & Power Utilities >> visible=true').first()).toBeVisible();
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

    // Change category in the popup modal to Food (loan selector remains hidden for non-Debt & Loans)
    await expect(page.getByTestId('modal-select-loan-101')).toHaveCount(0);
    const catSelect = page.locator('[data-testid="modal-select-category-101"] >> visible=true').first();
    await expect(catSelect).toBeVisible();
    await catSelect.selectOption('Food');
    await expect(page.locator('text=Moved transaction to "Food" >> visible=true').first()).toBeVisible();

    // Close the Account Inspection Modal
    const doneBtn = page.locator('[data-testid="modal-close-done-btn"] >> visible=true').first();
    await expect(doneBtn).toBeVisible();
    await doneBtn.click();
    await expect(page.getByRole('heading', { name: /Inspect Account: ASB Everyday Checking/i })).toBeHidden();

    // Verify Strategy 1 Tier-Grouped sections on main page
    await expect(page.locator('text=Tier 1: Cash Floor (Liquid Reserves) >> visible=true').first()).toBeVisible();
    await expect(page.locator('text=Tier 2: Growth Assets (Compounding Investments) >> visible=true').first()).toBeVisible();
    await expect(page.locator('text=Tier 3: Locked Reserve (Preserved Capital) >> visible=true').first()).toBeVisible();

    // Verify All Accounts Combined Ledger card opens modal
    const combinedCard = page.locator('[data-testid="account-card-all"] >> visible=true').first();
    await expect(combinedCard).toBeVisible();
    await combinedCard.click();
    await expect(page.getByRole('heading', { name: /Inspect: All Accounts/i })).toBeVisible();
    const doneCombinedBtn = page.locator('[data-testid="modal-close-done-btn"] >> visible=true').first();
    await expect(doneCombinedBtn).toBeVisible();
    await doneCombinedBtn.click();
    await expect(page.getByRole('heading', { name: /Inspect: All Accounts/i })).toBeHidden();

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

  test('clears CacheStorage and reloads runway metrics when refresh button is clicked', async ({ page }) => {
    await expect(page.locator('text=184 >> visible=true').first()).toBeVisible();

    const seededKeys = await page.evaluate(async () => {
      const cache = await window.caches.open('workbox-precache-v2-stale-test');
      await cache.put(
        new Request('/stale-asset.js'),
        new Response('console.log("stale")', {
          headers: { 'Content-Type': 'application/javascript' },
        })
      );
      return window.caches.keys();
    });
    expect(seededKeys).toContain('workbox-precache-v2-stale-test');

    let runwayFetchCount = 0;
    await page.route(/\/api\/runway(\?.*)?$/, async (route) => {
      runwayFetchCount += 1;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...MOCK_RUNWAY_DATA,
          primary_runway_weeks: 192,
          primary_runway_years: 3.7,
          breakdown: {
            ...MOCK_RUNWAY_DATA.breakdown,
            growth_weeks: 192,
          },
        }),
      });
    });

    const refreshBtn = page.locator('[data-testid="refresh-button"]');
    await expect(refreshBtn).toBeVisible();
    await refreshBtn.click();

    await expect.poll(() => runwayFetchCount).toBeGreaterThanOrEqual(1);
    await expect(page.locator('text=192 >> visible=true').first()).toBeVisible();

    await expect
      .poll(async () => page.evaluate(() => window.caches.keys()))
      .toEqual([]);
  });

  test('auto-calculates category budget limits from average weekly burn', async ({ page }) => {
    const limitsBtn = page.locator('button:has-text("Manage Limits"), button:has-text("Limits")').locator('visible=true').first();
    await limitsBtn.scrollIntoViewIfNeeded();
    await limitsBtn.click();

    await expect(page.getByRole('heading', { name: 'Category Budget Guardrails' })).toBeVisible();
    await expect(page.locator('text=12w Average Burn:')).toBeVisible();

    await page.getByTestId('budget-period-mode-annual').click();
    await expect(page.getByTestId('budget-annual-limit-input')).toBeVisible();

    const groceriesAnnualToggle = page.getByTestId('rule-toggle-annual-groceries');
    await groceriesAnnualToggle.click();
    await expect(page.locator('text=52w Annual')).toBeVisible();
    await expect(groceriesAnnualToggle).toContainText('52w On');

    const syncBtn = page.getByTestId('sync-from-burn-btn');
    await expect(syncBtn).toBeVisible();
    await syncBtn.click();

    await expect(page.locator('text=Calculated category budgets from 12-week average burn!')).toBeVisible();
  });

  test('displays itemized recurring commitments and variable category percentages in BurnBreakdownModal', async ({ page }) => {
    const recurringBtn = page.getByTestId('inspect-recurring-burn-btn').locator('visible=true').first();
    await recurringBtn.scrollIntoViewIfNeeded();
    await recurringBtn.click();

    await expect(page.getByRole('heading', { name: 'Weekly Burn Anatomy' })).toBeVisible();
    await expect(page.getByTestId('recurring-loan-row')).toHaveCount(1);
    await expect(page.locator('text=Toyota Corolla Cross (TFS)')).toBeVisible();
    await expect(page.getByTestId('recurring-commitment-row')).toHaveCount(3);
    await expect(page.locator('text=Home rent')).toBeVisible();
    await expect(page.locator('text=Southern Cross')).toBeVisible();
    await expect(page.locator('text=CityFitness')).toBeVisible();

    const varTab = page.getByTestId('burn-tab-variable');
    await varTab.click();

    const rows = page.getByTestId('variable-category-row');
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(0)).toContainText('Groceries');
    await expect(rows.nth(0)).toContainText('58.2%');
    await expect(rows.nth(1)).toContainText('Food');
    await expect(rows.nth(1)).toContainText('41.8%');

    const toggleGroceriesBtn = page.getByTestId('toggle-annual-groceries');
    await expect(toggleGroceriesBtn).toContainText('Spread over 52w');
    await toggleGroceriesBtn.click();
    await expect(rows.nth(0)).toContainText('52w Annual');
    await expect(toggleGroceriesBtn).toContainText('Spread 52w On');
  });

  test('overrides period filter for annual categories and inspects cross-category tag spending', async ({ page }) => {
    const budgetTab = page
      .locator('header nav button:has-text("Spending & Budgets"), nav button:has-text("Budgets")')
      .locator('visible=true')
      .first();
    await budgetTab.click();

    // 1. Annual category overrides This Month filter -> Trailing 52 Weeks (365d)
    const travelRow = page.getByTestId('category-row-travel').locator('visible=true').first();
    await expect(travelRow).toBeVisible();
    await travelRow.click();

    const catModal = page.getByTestId('category-inspection-modal');
    await expect(catModal).toBeVisible();
    await expect(page.getByTestId('annual-override-badge')).toContainText('52w Annual Budget Period');
    await expect(catModal).toContainText('Trailing 52 Weeks (365d)');
    await expect(catModal).toContainText('Air New Zealand');
    await catModal.getByRole('button', { name: 'Done' }).click();
    await expect(catModal).toBeHidden();

    // 2. Tag & Trip Explorer shows cross-category trip breakdown and opens inspection modal
    const tagCard = page.getByTestId('tag-spending-breakdown');
    await tagCard.scrollIntoViewIfNeeded();
    await expect(tagCard).toBeVisible();

    const queenstownRow = page.getByTestId('tag-row-queenstown-trip');
    await expect(queenstownRow).toBeVisible();
    await expect(queenstownRow).toContainText('#queenstown-trip');
    await expect(queenstownRow).toContainText('Travel');
    await expect(queenstownRow).toContainText('Food');
    await queenstownRow.click();

    const tagModal = page.getByTestId('tag-inspection-modal');
    await expect(tagModal).toBeVisible();
    await expect(page.getByTestId('tag-category-breakdown')).toContainText('Travel');
    await expect(page.getByTestId('tag-category-breakdown')).toContainText('Food');
    await expect(page.getByTestId('tag-category-breakdown')).toContainText('Transport');
    await expect(tagModal).toContainText('Air New Zealand');
    await expect(tagModal).toContainText('Fergburger Queenstown');
    await expect(tagModal).toContainText('Queenstown Airport Shuttle');

    // Filter down to Food within the trip tag modal
    await page.getByTestId('tag-category-breakdown').getByRole('button', { name: /Food:/i }).click();
    await expect(tagModal).toContainText('Fergburger Queenstown');
    await expect(tagModal).not.toContainText('Air New Zealand');
  });

  test('reconciles amortized recurring commitments inside CategoryTransactionInspectionModal', async ({ page }) => {
    const budgetTab = page
      .locator('header nav button:has-text("Spending & Budgets"), nav button:has-text("Budgets")')
      .locator('visible=true')
      .first();
    await budgetTab.click();

    const utilitiesRow = page.getByTestId('category-row-utilities').locator('visible=true').first();
    await expect(utilitiesRow).toBeVisible();
    await expect(utilitiesRow).toContainText('2 + 2 fixed');
    await expect(utilitiesRow).toContainText('$46.99 NZD');
    await utilitiesRow.click();

    const catModal = page.getByTestId('category-inspection-modal');
    await expect(catModal).toBeVisible();
    await expect(catModal).toContainText('$46.99');
    await expect(page.getByTestId('category-inspection-count-summary')).toContainText('2 txns + 2 amortized');
    await expect(catModal).toContainText('2 + 2 fixed');

    // Actual dated transactions
    await expect(catModal).toContainText('iCloud');
    await expect(catModal).toContainText('SKINNY MOBIL');

    // Amortized recurring commitments section
    const amortizedSection = page.getByTestId('amortized-commitments-section');
    await expect(amortizedSection).toBeVisible();
    await expect(amortizedSection).toContainText('Amortized Recurring Commitments (2)');
    await expect(amortizedSection).toContainText('Google One');
    await expect(page.getByTestId('amortized-badge-122')).toContainText('Annual amortized');
    await expect(page.getByTestId('amortized-amount-122')).toContainText('-$23.31 NZD/mo');
    await expect(amortizedSection).toContainText('ANNUAL FEE');
    await expect(amortizedSection).toContainText('From SGD 120.00');
    await expect(page.getByTestId('amortized-amount-123')).toContainText('-$13.69 NZD/mo');

    // Search filters uniformly across actual and amortized commitments
    const searchInput = catModal.getByPlaceholder('Filter by merchant or account...');
    await searchInput.fill('Google');
    await expect(catModal).toContainText('Google One');
    await expect(catModal).not.toContainText('iCloud');
    await expect(catModal).not.toContainText('ANNUAL FEE');

    await searchInput.fill('');
    await expect(catModal).toContainText('iCloud');
    await expect(catModal).toContainText('Google One');
    await expect(catModal).toContainText('ANNUAL FEE');
  });

  test('manages hierarchical categories and 52w amortization from Tools hub', async ({ page }) => {
    const toolsTab = page
      .locator('header nav button:has-text("Tools"), nav button:has-text("Tools")')
      .locator('visible=true')
      .first();
    await toolsTab.click();

    await page.getByTestId('categories-manager-btn').click();
    await expect(page.getByRole('heading', { name: /Categories & Hierarchy/i })).toBeVisible();

    await expect(page.getByTestId('category-row-food')).toBeVisible();
    await expect(page.getByTestId('category-row-dining')).toBeVisible();
    await expect(page.getByTestId('category-row-groceries')).toBeVisible();
    await expect(page.getByTestId('category-row-alcohol')).toBeVisible();
    await expect(page.getByTestId('category-row-finance')).toBeVisible();
    await expect(page.getByTestId('category-row-fees-admin')).toBeVisible();
    await expect(page.getByTestId('category-row-debt-loans')).toBeVisible();
    await expect(page.getByTestId('toggle-amortize-travel')).toContainText('52w On');

    // Create a new child category under Food with 52w annual spread
    await page.getByTestId('new-category-btn').click();
    await expect(page.getByTestId('category-editor-form')).toBeVisible();
    await page.getByTestId('category-name-input').fill('Coffee');
    await page.getByTestId('category-parent-select').selectOption({ label: 'Food' });
    await page.getByTestId('category-amortize-mode-annual').click();
    await page.getByTestId('save-category-btn').click();

    await expect(page.getByTestId('category-row-coffee')).toBeVisible();
    await expect(page.getByTestId('toggle-amortize-coffee')).toContainText('52w On');

    // Toggle 52w spread off directly from the category row
    await page.getByTestId('toggle-amortize-coffee').click();
    await expect(page.getByTestId('toggle-amortize-coffee')).toContainText('Spread 52w');

    // Delete with reassignment defaulting to parent Food
    await page.getByTestId('delete-category-coffee').click();
    await expect(page.getByTestId('delete-category-confirm')).toBeVisible();
    await expect(page.getByTestId('delete-reassign-select')).toHaveValue('Food');
    await page.getByTestId('confirm-delete-category-btn').click();

    await expect(page.getByTestId('category-row-coffee')).toHaveCount(0);
  });

  test('manages categorization rule amount bounds and cashflow direction', async ({ page }) => {
    const toolsTab = page
      .locator('header nav button:has-text("Tools"), nav button:has-text("Tools")')
      .locator('visible=true')
      .first();
    await toolsTab.click();

    await page.getByTestId('rules-manager-btn').click();
    await expect(page.getByRole('heading', { name: /Outlook-Style Categorization Rules/i })).toBeVisible();

    await expect(page.getByTestId('rule-range-badge-3')).toContainText('>= $30.00');
    await expect(page.getByTestId('rule-direction-badge-3')).toContainText('Outflow');
    await expect(page.getByTestId('rule-range-badge-4')).toContainText('<= $29.99');
    await expect(page.getByTestId('rule-direction-badge-4')).toContainText('Outflow');
    await expect(page.getByTestId('rule-counterpart-pill-5')).toContainText('Manulife');

    await page.getByRole('button', { name: /New Rule/i }).click();
    await page.getByTestId('rule-name-input').fill('BPme Fuel Refund');
    await page.getByTestId('rule-pattern-input').fill('BPME');
    await page.getByTestId('rule-min-amount-input').fill('50.00');
    await page.getByTestId('rule-max-amount-input').fill('20.00');
    await page.getByTestId('rule-direction-select').selectOption('inflow');
    await page.getByTestId('rule-category-select').selectOption('Fuel');
    await expect(page.getByTestId('rule-loan-select')).toHaveCount(0);
    await expect(page.getByTestId('rule-counterpart-account-select')).toBeVisible();
    await page.getByTestId('rule-counterpart-account-select').selectOption('5');
    await page.getByTestId('save-rule-btn').click();

    await expect(page.locator('text=Min amount must be less than or equal to max amount.')).toBeVisible();

    await page.getByTestId('rule-min-amount-input').fill('10.00');
    await page.getByTestId('rule-max-amount-input').fill('200.00');
    await page.getByTestId('save-rule-btn').click();

    await expect(page.getByTestId('rule-row-6')).toBeVisible();
    await expect(page.getByTestId('rule-range-badge-6')).toContainText('$10.00 - $200.00');
    await expect(page.getByTestId('rule-direction-badge-6')).toContainText('Inflow');
    await expect(page.getByTestId('rule-counterpart-pill-6')).toContainText('Manulife');

    await page.getByTestId('edit-rule-6').click();
    await expect(page.getByTestId('rule-min-amount-input')).toHaveValue('10');
    await expect(page.getByTestId('rule-max-amount-input')).toHaveValue('200');
    await expect(page.getByTestId('rule-direction-select')).toHaveValue('inflow');
    await expect(page.getByTestId('rule-counterpart-account-select')).toHaveValue('5');

    await page.getByTestId('rule-max-amount-input').fill('');
    await page.getByTestId('rule-direction-select').selectOption('outflow');
    await page.getByTestId('rule-counterpart-account-select').selectOption('');
    await page.getByTestId('save-rule-btn').click();

    await expect(page.getByTestId('rule-range-badge-6')).toContainText('>= $10.00');
    await expect(page.getByTestId('rule-direction-badge-6')).toContainText('Outflow');
    await expect(page.getByTestId('rule-counterpart-pill-6')).toHaveCount(0);
  });

  test('omits exchange_rate when recording a manual snapshot on non-NZD Manulife account', async ({ page }) => {
    let capturedSnapshotPayload: Record<string, unknown> | null = null;
    await page.route(/\/api\/accounts\/5\/snapshots$/, async (route) => {
      if (route.request().method() === 'POST') {
        capturedSnapshotPayload = route.request().postDataJSON() as Record<string, unknown>;
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 100,
            snapshot_date: '2026-11-18',
            account_id: 5,
            balance: Number(capturedSnapshotPayload.balance),
            currency: 'SGD',
            exchange_rate: 1.29,
            balance_nzd: Math.round(Number(capturedSnapshotPayload.balance) * 1.29 * 100) / 100,
            source: 'manual',
            notes: capturedSnapshotPayload.notes || null,
          }),
        });
        return;
      }
      await route.fallback();
    });

    const accountsTab = page
      .locator('header nav button:has-text("Accounts"), nav button:has-text("Accounts")')
      .locator('visible=true')
      .first();
    await accountsTab.click();

    await page.getByTestId('account-card-5').click();
    await expect(page.getByRole('heading', { name: /Inspect Account: Manulife/i })).toBeVisible();
    await page.getByTestId('modal-record-snapshot-btn').click();

    await expect(
      page.getByRole('heading', { name: /Record Balance Valuation Snapshot: Manulife/i })
    ).toBeVisible();
    const balanceInput = page.getByPlaceholder('0.00');
    await expect(balanceInput).toHaveValue('14527.89');
    await balanceInput.fill('15100.50');
    await page.getByRole('button', { name: /Confirm & Save Valuation/i }).click();

    await expect
      .poll(() => capturedSnapshotPayload)
      .not.toBeNull();
    expect(capturedSnapshotPayload).toMatchObject({
      account_id: 5,
      balance: 15100.5,
      currency: 'SGD',
      source: 'manual',
    });
    expect(capturedSnapshotPayload?.exchange_rate).toBeUndefined();
  });

  test('filters needs_review receipts, links candidate transaction in 1 tap, and updates attention badge', async ({ page }) => {
    const toolsTab = page
      .locator('header nav button:has-text("Tools"), nav button:has-text("Tools")')
      .locator('visible=true')
      .first();
    await toolsTab.click();

    await expect(page.getByTestId('receipts-needs-review-badge')).toContainText('1 Needs Review');
    await page.getByTestId('receipts-hub-btn').click();

    await expect(page.getByRole('heading', { name: /Receipts & Product Inventory Hub/i })).toBeVisible();
    await expect(page.getByTestId('receipt-filter-all')).toContainText('3');
    await expect(page.getByTestId('receipt-filter-pending')).toContainText('2');
    await expect(page.getByTestId('receipt-filter-needs_review')).toContainText('1');
    await expect(page.getByTestId('receipt-filter-matched')).toContainText('1');

    await page.getByTestId('receipts-hub-needs-review-badge').click();
    await expect(page.getByTestId('receipt-row-3')).toBeVisible();
    await expect(page.getByTestId('receipt-row-1')).toHaveCount(0);
    await expect(page.getByTestId('receipt-row-2')).toHaveCount(0);

    await page.getByTestId('receipt-row-3').click();
    await expect(page.getByTestId('receipt-candidates-panel-3')).toBeVisible();
    await expect(page.getByTestId('receipt-candidate-3-201')).toContainText('$195.40 NZD');
    await expect(page.getByTestId('receipt-candidate-3-201')).toContainText('Orig. AUD 179.74');
    await expect(page.getByTestId('receipt-candidate-3-202')).toContainText('Est. AUD 180.25');

    await page.getByTestId('link-receipt-candidate-3-201').click();
    await expect(page.getByTestId('receipts-hub-status-banner')).toContainText('Linked "Sydney Roasters Online"');
    await expect(page.getByTestId('receipt-filter-pending')).toContainText('1');
    await expect(page.getByTestId('receipt-filter-needs_review')).toContainText('0');
    await expect(page.getByTestId('receipt-filter-matched')).toContainText('2');

    await page.getByRole('button', { name: 'Done' }).click();
    await expect(page.getByTestId('receipts-needs-review-badge')).toHaveCount(0);
    await expect(page.getByTestId('receipts-pending-badge')).toContainText('1 Pending');
  });
});
