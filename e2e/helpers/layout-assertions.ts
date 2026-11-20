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

  await expect(row).toBeVisible();
  await expect(pill).toBeVisible();
  await expect(amount).toBeVisible();
  await expect(loanSelect).toBeVisible();

  const [rowBox, pillBox, amountBox, selectBox] = await Promise.all([
    row.boundingBox(),
    pill.boundingBox(),
    amount.boundingBox(),
    loanSelect.boundingBox(),
  ]);

  expect(rowBox).not.toBeNull();
  expect(pillBox).not.toBeNull();
  expect(amountBox).not.toBeNull();
  expect(selectBox).not.toBeNull();

  expect(boxesOverlap(pillBox!, amountBox!)).toBe(false);
  expect(boxesOverlap(pillBox!, selectBox!)).toBe(false);
  expect(boxesOverlap(amountBox!, selectBox!)).toBe(false);

  expect(pillBox!.x + pillBox!.width).toBeLessThanOrEqual(rowBox!.x + rowBox!.width + 1);
  expect(selectBox!.x + selectBox!.width).toBeLessThanOrEqual(rowBox!.x + rowBox!.width + 1);
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
