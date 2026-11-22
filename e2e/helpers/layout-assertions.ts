import { expect, type Locator, type Page } from '@playwright/test';

interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

function boxesOverlap(a: BoundingBox, b: BoundingBox): boolean {
  return (
    a.x < b.x + b.width - 1 &&
    a.x + a.width > b.x + 1 &&
    a.y < b.y + b.height - 1 &&
    a.y + a.height > b.y + 1
  );
}

/**
 * Verifies a loan-linked transaction row keeps its loan-flow pill, amount,
 * and loan selector disjoint and within the row bounding box.
 */
export async function assertLoanRowHasNoOverlap(page: Page, txId: number): Promise<void> {
  const row = page.locator(`[data-testid="account-modal-tx-row-${txId}"] >> visible=true`).first();
  const pill = row.locator(`[data-testid="loan-flow-${txId}"] >> visible=true`).first();
  const amount = row.locator(`[data-testid="tx-amount-${txId}"] >> visible=true`).first();
  const loanSelect = row.locator(`[data-testid="modal-select-loan-${txId}"] >> visible=true`).first();
  const categorySelect = row.locator(`[data-testid="modal-select-category-${txId}"] >> visible=true`).first();

  await expect(row).toBeVisible();
  await expect(pill).toBeVisible();
  await expect(amount).toBeVisible();

  const control = (await loanSelect.count()) > 0 ? loanSelect : categorySelect;
  await expect(control).toBeVisible();

  const [rowBox, pillBox, amountBox, controlBox] = await Promise.all([
    row.boundingBox(),
    pill.boundingBox(),
    amount.boundingBox(),
    control.boundingBox(),
  ]);

  expect(rowBox).not.toBeNull();
  expect(pillBox).not.toBeNull();
  expect(amountBox).not.toBeNull();
  expect(controlBox).not.toBeNull();

  expect(boxesOverlap(pillBox!, amountBox!)).toBe(false);
  expect(boxesOverlap(pillBox!, controlBox!)).toBe(false);
  expect(boxesOverlap(amountBox!, controlBox!)).toBe(false);

  expect(pillBox!.x + pillBox!.width).toBeLessThanOrEqual(rowBox!.x + rowBox!.width + 1);
  expect(controlBox!.x + controlBox!.width).toBeLessThanOrEqual(rowBox!.x + rowBox!.width + 1);
}

/**
 * Verifies metric values inside a loan card stay inside the card horizontal bounds.
 */
export async function assertCardMetricsWithinBounds(card: Locator): Promise<void> {
  await expect(card).toBeVisible();
  const cardBox = await card.boundingBox();
  expect(cardBox).not.toBeNull();

  const metrics = card.locator('.grid .font-mono, .grid .font-mono span');
  const count = await metrics.count();
  expect(count).toBeGreaterThan(0);

  for (let i = 0; i < count; i += 1) {
    const metricBox = await metrics.nth(i).boundingBox();
    expect(metricBox).not.toBeNull();
    expect(metricBox!.x).toBeGreaterThanOrEqual(cardBox!.x - 1);
    expect(metricBox!.x + metricBox!.width).toBeLessThanOrEqual(cardBox!.x + cardBox!.width + 1);
  }
}

/**
 * Verifies an account card and its earned chip stay inside horizontal card bounds.
 */
export async function assertAccountCardHasNoOverflow(
  card: Locator,
  earnedChipTestId?: string
): Promise<void> {
  await expect(card).toBeVisible();
  const cardBox = await card.boundingBox();
  expect(cardBox).not.toBeNull();

  const overflows = await card.evaluate(
    (el) => el.scrollWidth > el.clientWidth + 1
  );
  expect(overflows).toBe(false);

  if (earnedChipTestId) {
    const chip = card.locator(`[data-testid="${earnedChipTestId}"]`);
    await expect(chip).toBeVisible();
    const chipBox = await chip.boundingBox();
    expect(chipBox).not.toBeNull();
    expect(chipBox!.x).toBeGreaterThanOrEqual(cardBox!.x - 1);
    expect(chipBox!.x + chipBox!.width).toBeLessThanOrEqual(cardBox!.x + cardBox!.width + 1);
  }
}

/**
 * Verifies a counterpart-attributed transaction row keeps its flow pill, amount,
 * and controls disjoint and within the row horizontal bounds.
 */
export async function assertCounterpartRowHasNoOverlap(
  page: Page,
  txId: number
): Promise<void> {
  const row = page.locator(`[data-testid="account-modal-tx-row-${txId}"] >> visible=true`).first();
  const pill = row.locator(`[data-testid="counterpart-flow-${txId}"] >> visible=true`).first();
  const amount = row.locator(`[data-testid="tx-amount-${txId}"] >> visible=true`).first();
  const categorySelect = row.locator(`[data-testid="modal-select-category-${txId}"] >> visible=true`).first();

  await expect(row).toBeVisible();
  await expect(pill).toBeVisible();
  await expect(amount).toBeVisible();
  await expect(categorySelect).toBeVisible();

  const [rowBox, pillBox, amountBox, categoryBox] = await Promise.all([
    row.boundingBox(),
    pill.boundingBox(),
    amount.boundingBox(),
    categorySelect.boundingBox(),
  ]);

  expect(rowBox).not.toBeNull();
  expect(pillBox).not.toBeNull();
  expect(amountBox).not.toBeNull();
  expect(categoryBox).not.toBeNull();

  expect(boxesOverlap(pillBox!, amountBox!)).toBe(false);
  expect(boxesOverlap(pillBox!, categoryBox!)).toBe(false);
  expect(boxesOverlap(amountBox!, categoryBox!)).toBe(false);

  expect(pillBox!.x + pillBox!.width).toBeLessThanOrEqual(rowBox!.x + rowBox!.width + 1);
  expect(categoryBox!.x + categoryBox!.width).toBeLessThanOrEqual(rowBox!.x + rowBox!.width + 1);
}
