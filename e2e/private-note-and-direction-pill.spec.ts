import { test, expect, devices, type Page } from '@playwright/test';
import { MOCK_RUNWAY_DATA, setupMockApi } from './helpers/mock-data';
import {
  assertAccountCardHasNoOverflow,
  assertCounterpartRowHasNoOverlap,
} from './helpers/layout-assertions';

const VIEWPORTS = [
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

interface SyntheticTx {
  id: number;
  transaction_date: string;
  account_id: number;
  account_name: string;
  amount: number;
  currency: string;
  merchant: string;
  raw_description: string;
  category: string;
  linked_transaction_id: number | null;
  counterpart_account_id: number | null;
  counterpart_account_name: string | null;
  counterpart_account_type: string | null;
}

const SYNTHETIC_ACCOUNTS = [
  {
    id: 1,
    name: 'ASB Everyday Checking',
    account_type: 'checking',
    tier: 'cash',
    institution: 'ASB',
    currency: 'NZD',
    expected_annual_return: 0.0,
    is_active: true,
    payout_total_native: 0,
    payout_total_nzd: 0,
    payout_count: 0,
  },
  {
    id: 3,
    name: 'Simplicity KiwiSaver',
    account_type: 'kiwisaver',
    tier: 'locked',
    institution: 'Simplicity',
    currency: 'NZD',
    expected_annual_return: 0.06,
    is_active: true,
    payout_total_native: 0,
    payout_total_nzd: 0,
    payout_count: 0,
  },
  {
    id: 5,
    name: 'Manulife',
    account_type: 'brokerage',
    tier: 'growth',
    institution: 'Manulife',
    currency: 'SGD',
    expected_annual_return: 0.0,
    is_active: true,
    payout_total_native: 65.54,
    payout_total_nzd: 84.55,
    payout_count: 1,
  },
  {
    id: 6,
    name: 'DBS Synthetic Savings',
    account_type: 'savings',
    tier: 'cash',
    institution: 'DBS Bank',
    currency: 'SGD',
    expected_annual_return: 0.02,
    is_active: true,
    payout_total_native: 0,
    payout_total_nzd: 0,
    payout_count: 0,
  },
  {
    id: 7,
    name: 'Alex Business Note',
    account_type: 'private_note',
    tier: 'locked',
    institution: 'Alex Ventures',
    currency: 'SGD',
    expected_annual_return: 0.102,
    is_active: true,
    payout_total_native: 5015.0,
    payout_total_nzd: 6820.4,
    payout_count: 59,
    first_payout_date: '2021-11-30',
    last_payout_date: '2026-09-30',
  },
];

function createSyntheticTransactions(): SyntheticTx[] {
  return [
    {
      id: 701,
      transaction_date: '2026-11-20',
      account_id: 6,
      account_name: 'DBS Synthetic Savings',
      amount: 85.0,
      currency: 'SGD',
      merchant: 'Alex Monthly Payout',
      raw_description: 'FAST CREDIT ALEX VENTURES',
      category: 'Income',
      linked_transaction_id: null,
      counterpart_account_id: 7,
      counterpart_account_name: 'Alex Business Note',
      counterpart_account_type: 'private_note',
    },
    {
      id: 703,
      transaction_date: '2026-11-18',
      account_id: 6,
      account_name: 'DBS Synthetic Savings',
      amount: -300.0,
      currency: 'SGD',
      merchant: 'Manulife Allocation',
      raw_description: 'GIRO MANULIFE ALLOCATION',
      category: 'Finance',
      linked_transaction_id: null,
      counterpart_account_id: 5,
      counterpart_account_name: 'Manulife',
      counterpart_account_type: 'brokerage',
    },
    {
      id: 702,
      transaction_date: '2026-11-16',
      account_id: 6,
      account_name: 'DBS Synthetic Savings',
      amount: -10000.0,
      currency: 'SGD',
      merchant: 'Alex Note Principal',
      raw_description: 'FAST DEBIT ALEX VENTURES',
      category: 'Finance',
      linked_transaction_id: null,
      counterpart_account_id: 7,
      counterpart_account_name: 'Alex Business Note',
      counterpart_account_type: 'private_note',
    },
    {
      id: 704,
      transaction_date: '2026-11-15',
      account_id: 6,
      account_name: 'DBS Synthetic Savings',
      amount: 85.0,
      currency: 'SGD',
      merchant: 'Unattributed Note Distribution',
      raw_description: 'FAST CREDIT DISTRIBUTION',
      category: 'Income',
      linked_transaction_id: null,
      counterpart_account_id: null,
      counterpart_account_name: null,
      counterpart_account_type: null,
    },
  ];
}

async function setupPrivateNoteRoutes(page: Page) {
  const txs = createSyntheticTransactions();
  const patchPayloads: Array<{ id: number; body: Record<string, unknown> }> = [];

  await setupMockApi(page);

  await page.route(/\/api\/runway(\?.*)?$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ...MOCK_RUNWAY_DATA,
        breakdown: {
          ...MOCK_RUNWAY_DATA.breakdown,
          locked_balance: 98600.0,
          tier_labels: {
            cash: 'Cash',
            growth: 'Growth',
            locked: 'Locked Reserve',
          },
        },
      }),
    });
  });

  await page.route(/\/api\/accounts(\?.*)?$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(SYNTHETIC_ACCOUNTS),
    });
  });

  await page.route(/\/api\/accounts\/7\/snapshots(\?.*)?$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          id: 700,
          snapshot_date: '2026-11-23',
          account_id: 7,
          balance: 10000.0,
          currency: 'SGD',
          exchange_rate: 1.36,
          balance_nzd: 13600.0,
          source: 'manual',
          notes: 'Private note principal',
        },
      ]),
    });
  });

  await page.route(/\/api\/transactions(\/.*|\?.*)?$/, async (route) => {
    const req = route.request();
    if (req.method() === 'PATCH') {
      const match = req.url().match(/\/api\/transactions\/(\d+)/);
      const txId = match ? Number(match[1]) : 0;
      const body = (req.postDataJSON() || {}) as Record<string, unknown>;
      patchPayloads.push({ id: txId, body });
      const target = txs.find((t) => t.id === txId);
      if (!target) {
        await route.fulfill({ status: 404, body: JSON.stringify({ detail: 'Not found' }) });
        return;
      }
      if ('counterpart_account_id' in body) {
        const nextId =
          body.counterpart_account_id !== null && body.counterpart_account_id !== undefined
            ? Number(body.counterpart_account_id)
            : null;
        const matched = nextId !== null ? SYNTHETIC_ACCOUNTS.find((a) => a.id === nextId) : null;
        target.counterpart_account_id = nextId;
        target.counterpart_account_name = matched ? matched.name : null;
        target.counterpart_account_type = matched ? matched.account_type : null;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(target),
      });
      return;
    }

    const url = new URL(req.url());
    const accountIdParam = url.searchParams.get('account_id');
    const filtered = accountIdParam
      ? txs.filter(
          (tx) =>
            tx.account_id === Number(accountIdParam) ||
            (tx.counterpart_account_id === Number(accountIdParam) && tx.linked_transaction_id === null)
        )
      : txs;

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(filtered),
    });
  });

  return { patchPayloads };
}

for (const { name, options } of VIEWPORTS) {
  test.describe(`Private Note, Earned Telemetry & Counterpart Pills - ${name.toUpperCase()}`, () => {
    test.use(options);

    test(`renders private_note card, Total Earned tile, direction pills, and inline picker on ${name}`, async ({ page }) => {
      const { patchPayloads } = await setupPrivateNoteRoutes(page);
      await page.goto('/');

      // 1. Freedom Clock displays Locked Reserve when locked assets coexist
      await expect(page.locator('text=Locked Reserve >> visible=true').first()).toBeVisible();

      // 2. Navigate to Accounts tab and inspect Alex Business Note card
      await page.locator('header nav button:has-text("Accounts"), nav button:has-text("Accounts")').locator('visible=true').first().click();
      await expect(page.locator('text=Tier 3: Locked Reserve (Preserved Capital) >> visible=true').first()).toBeVisible();

      const noteCard = page.getByTestId('account-card-7');
      await noteCard.scrollIntoViewIfNeeded();
      await expect(noteCard).toBeVisible();
      await expect(noteCard).toContainText('Alex Business Note');
      await expect(noteCard).toContainText('Private Note');
      await expect(noteCard).toContainText('10.2% p.a.');
      await expect(noteCard).toContainText('$10,000.00');
      await expect(noteCard).toContainText('SGD');

      const earnedChip = page.getByTestId('account-earned-chip-7');
      await expect(earnedChip).toContainText('Earned');
      await expect(earnedChip).toContainText('+$5,015.00 SGD');
      await expect(earnedChip).toContainText('50.2% recovered');
      await expect(earnedChip).toContainText('59 payouts');
      await assertAccountCardHasNoOverflow(noteCard, 'account-earned-chip-7');
      await page.waitForTimeout(250);
      await page.screenshot({
        path: `screenshots/${name}/22-private-note-account-card.png`,
      });

      // 3. Open Alex Business Note AccountInspectionModal -> Total Earned tile + counterpart rows
      await noteCard.click();
      const modal = page.getByTestId('account-inspection-modal');
      await expect(modal).toBeVisible();
      await expect(modal).toContainText('Alex Ventures • Private Note • 10.2% p.a.');

      const earnedTile = page.getByTestId('account-total-earned-tile');
      await expect(earnedTile).toBeVisible();
      await expect(earnedTile).toContainText('Total Earned');
      await expect(earnedTile).toContainText('+$5,015.00 SGD');
      await expect(earnedTile).toContainText('NZD $6,820.40');
      await expect(earnedTile).toContainText('50.2% of principal');
      await expect(earnedTile).toContainText('59 payouts');

      // Direct Inflow summary chip must not double-count counterpart payouts
      await expect(modal).toContainText('$0.00 SGD');

      // Counterpart pills inside inspection modal
      const payoutPill = page.getByTestId('counterpart-flow-701');
      await payoutPill.scrollIntoViewIfNeeded();
      await expect(payoutPill).toContainText('Alex Business Note');
      await expect(payoutPill).toContainText('DBS Synthetic Savings');
      await expect(page.getByTestId('counterpart-role-701')).toHaveText('Payout');
      await assertCounterpartRowHasNoOverlap(page, 701);
      await earnedTile.scrollIntoViewIfNeeded();
      await page.waitForTimeout(250);
      await page.screenshot({
        path: `screenshots/${name}/23-private-note-inspection-modal.png`,
      });

      const principalPill = page.getByTestId('counterpart-flow-702');
      await principalPill.scrollIntoViewIfNeeded();
      await expect(principalPill).toContainText('DBS Synthetic Savings');
      await expect(principalPill).toContainText('Alex Business Note');
      await expect(page.getByTestId('counterpart-role-702')).toHaveText('Principal');
      await assertCounterpartRowHasNoOverlap(page, 702);

      await page.getByTestId('modal-close-done-btn').click();
      await expect(modal).toBeHidden();

      // 4. Inspect DBS Synthetic Savings -> Contribution pill + inline Counterpart Picker PATCH
      await page.getByTestId('account-card-6').click();
      await expect(modal).toBeVisible();

      const contributionPill = page.getByTestId('counterpart-flow-703');
      await contributionPill.scrollIntoViewIfNeeded();
      await expect(contributionPill).toContainText('DBS Synthetic Savings');
      await expect(contributionPill).toContainText('Manulife');
      await expect(page.getByTestId('counterpart-role-703')).toHaveText('Contribution');
      await assertCounterpartRowHasNoOverlap(page, 703);

      // Assign counterpart account to unattributed inflow 704
      await expect(page.getByTestId('counterpart-flow-704')).toHaveCount(0);
      const toggleBtn = page.getByTestId('counterpart-tx-btn-704');
      await toggleBtn.scrollIntoViewIfNeeded();
      await toggleBtn.click();

      const counterpartSelect = page.getByTestId('modal-select-counterpart-704');
      await expect(counterpartSelect).toBeVisible();
      await counterpartSelect.scrollIntoViewIfNeeded();
      await page.waitForTimeout(250);
      await page.screenshot({
        path: `screenshots/${name}/24-counterpart-principal-and-picker.png`,
      });
      const optionLabels = await counterpartSelect.locator('option').allTextContents();
      expect(optionLabels).toContain('None');
      expect(optionLabels.some((lbl) => lbl.includes('Alex Business Note'))).toBe(true);
      expect(optionLabels.some((lbl) => lbl.includes('DBS Synthetic Savings'))).toBe(false);

      if (name !== 'desktop') {
        const fontSizePx = await counterpartSelect.evaluate((el) =>
          parseFloat(window.getComputedStyle(el).fontSize)
        );
        expect(fontSizePx).toBeGreaterThanOrEqual(16);
      }

      await counterpartSelect.selectOption('7');
      await expect.poll(() => patchPayloads.length).toBe(1);
      expect(patchPayloads[0]).toEqual({ id: 704, body: { counterpart_account_id: 7 } });

      const updatedPill = page.getByTestId('counterpart-flow-704');
      await expect(updatedPill).toBeVisible();
      await expect(updatedPill).toContainText('Alex Business Note');
      await expect(updatedPill).toContainText('DBS Synthetic Savings');
      await expect(page.getByTestId('counterpart-role-704')).toHaveText('Payout');

      // Clear counterpart account back to None (null)
      await page.getByTestId('counterpart-tx-btn-704').click();
      await page.getByTestId('modal-select-counterpart-704').selectOption('');
      await expect.poll(() => patchPayloads.length).toBe(2);
      expect(patchPayloads[1]).toEqual({ id: 704, body: { counterpart_account_id: null } });
      await expect(page.getByTestId('counterpart-flow-704')).toHaveCount(0);
    });
  });
}
