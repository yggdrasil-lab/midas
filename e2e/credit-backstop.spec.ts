import { expect, devices, test } from '@playwright/test';
import { assertAccountCardHasNoOverflow } from './helpers/layout-assertions';
import { setupMockApi } from './helpers/mock-data';

const PLATFORMS = [
  {
    name: 'desktop',
    options: { viewport: { width: 1280, height: 800 }, isMobile: false, hasTouch: false },
  },
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
];

for (const { name, options } of PLATFORMS) {
  test.describe(`Credit Backstop & Account Edit - ${name.toUpperCase()}`, () => {
    test.use(options);

    test(`renders overview pill, Credit Backstop section, and Edit Account flow on ${name}`, async ({ page }) => {
      const patchPayloads: Array<Record<string, unknown>> = [];
      await setupMockApi(page);
      await page.route(/\/api\/accounts\/\d+(\?.*)?$/, async (route, req) => {
        if (req.method() === 'PATCH') {
          patchPayloads.push((req.postDataJSON() || {}) as Record<string, unknown>);
        }
        await route.fallback();
      });

      await page.goto('/');

      // 1. Overview pill shows emergency backstop while Freedom Clock remains untouched
      await expect(page.locator('text=Financial Freedom Clock >> visible=true')).toBeVisible();
      await expect(page.locator('text=184 >> visible=true').first()).toBeVisible();

      const pill = page.getByTestId('overview-credit-backstop-pill');
      await pill.scrollIntoViewIfNeeded();
      await expect(pill).toBeVisible();
      await expect(pill).toContainText('Credit Backstop');
      await expect(pill).toContainText('$15,595 NZD');
      await expect(pill).toContainText('+15.6 w backstop');
      await expect(pill).toContainText('31.9% used');
      await expect(pill).toContainText('Separate from Freedom Runway');

      // 2. Clicking pill switches to Accounts tab
      await pill.click();
      const backstopSection = page.getByTestId('credit-backstop-section');
      await expect(backstopSection).toBeVisible();
      await expect(page.getByTestId('cash-floor-net-credit-note')).toContainText('Net of credit owed');

      // 3. Revolving cards appear inside Credit Backstop section without overflow
      const visaCard = backstopSection.getByTestId('account-card-8');
      const lineCard = backstopSection.getByTestId('account-card-9');
      await visaCard.scrollIntoViewIfNeeded();
      await expect(visaCard).toBeVisible();
      await expect(visaCard).toContainText('NZ Synthetic Visa');
      await expect(visaCard).toContainText('$8,500.00');
      await expect(visaCard).toContainText('15.0%');
      await assertAccountCardHasNoOverflow(visaCard);

      await lineCard.scrollIntoViewIfNeeded();
      await expect(lineCard).toBeVisible();
      await expect(lineCard).toContainText('SG Synthetic Cashline');
      await expect(lineCard).toContainText('Credit Line');
      await expect(lineCard).toContainText('No grace period');
      await expect(lineCard).toContainText('NZD $7,095.00');
      await expect(lineCard).toContainText('45.0%');
      await assertAccountCardHasNoOverflow(lineCard);

      // 4. Clicking card opens inspection modal with Edit Account trigger; clicking Edit opens EditAccountModal
      await visaCard.click();
      await expect(page.getByTestId('account-inspection-modal')).toBeVisible();
      await page.getByTestId('modal-edit-account-btn').click();
      await expect(page.getByTestId('account-inspection-modal')).toBeHidden();
      await expect(page.getByTestId('edit-account-modal')).toBeVisible();

      // 5. Client-side validation rejects <= 0 limit without calling PATCH
      const limitInput = page.getByTestId('edit-account-credit-limit-input');
      await limitInput.fill('0');
      await page.getByTestId('edit-account-save-btn').click();
      await expect(page.getByTestId('edit-account-error')).toContainText('positive number greater than 0');
      expect(patchPayloads).toHaveLength(0);

      // 6. Valid limit update persists via PATCH and refreshes Accounts & Overview pill
      await limitInput.fill('15000');
      await page.getByTestId('edit-account-save-btn').click();
      await expect(page.getByTestId('edit-account-modal')).toBeHidden();
      expect(patchPayloads).toHaveLength(1);
      expect(patchPayloads[0]).toMatchObject({ credit_limit: 15000 });
      await expect(visaCard).toContainText('$13,500.00');

      // 7. Blank credit limit clears via null and renders Set credit limit prompt
      await page.getByTestId('edit-account-btn-8').click();
      await expect(page.getByTestId('edit-account-modal')).toBeVisible();
      await expect(page.getByTestId('account-inspection-modal')).toBeHidden();
      await page.getByTestId('edit-account-credit-limit-input').fill('');
      await page.getByTestId('edit-account-save-btn').click();
      await expect(page.getByTestId('edit-account-modal')).toBeHidden();
      expect(patchPayloads).toHaveLength(2);
      expect(patchPayloads[1]).toMatchObject({ credit_limit: null });
      await expect(visaCard).toContainText('Set credit limit');
    });
  });
}
