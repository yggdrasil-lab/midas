import type { Page, Route } from '@playwright/test';
import { MOCK_PRODUCT_STATS } from '../fixtures/receipts-fixtures';
import { MOCK_PRODUCTS_DATA } from '../mock-fixtures';
import type { MockApiState } from '../mock-types';

const MOCK_RECEIPT_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="140" viewBox="0 0 240 140"><rect width="240" height="140" fill="#0f172a"/><rect x="16" y="14" width="208" height="112" rx="8" fill="#1e293b" stroke="#f59e0b" stroke-opacity="0.5"/><text x="120" y="54" fill="#f8fafc" font-family="monospace" font-size="13" text-anchor="middle">CHEMIST WAREHOUSE</text><text x="120" y="78" fill="#94a3b8" font-family="monospace" font-size="11" text-anchor="middle">2x Items   NZ$74.98</text><text x="120" y="102" fill="#fbbf24" font-family="monospace" font-size="10" text-anchor="middle">STORED WEBP RECEIPT</text></svg>`;

function fulfillJson(route: Route, status: number, payload: unknown): Promise<void> {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(payload),
  });
}

function buildUploadedReceipt() {
  const now = new Date().toISOString();
  return {
    id: 10,
    merchant: 'Chemist Warehouse Albany',
    receipt_date: '2026-11-04',
    total_amount: 74.98,
    currency: 'NZD',
    status: 'matched',
    transaction_id: 101,
    created_at: now,
    updated_at: now,
    items: [
      {
        id: 20,
        receipt_id: 10,
        item_name: 'Vitamin C Serum 30ml',
        brand: 'La Roche-Posay',
        category: 'Health',
        domain: '02-skin',
        product_type: 'serum',
        volume_ml: '30ml',
        quantity: 1.0,
        unit_price: 44.99,
        total_price: 44.99,
        created_at: now,
      },
    ],
  };
}

function handleReceiptCandidates(route: Route, state: MockApiState): Promise<void> {
  const match = route.request().url().match(/\/api\/receipts\/(\d+)\/candidates/);
  const id = match ? Number(match[1]) : 0;
  const receipt = state.receipts.find((r) => r.id === id);
  if (!receipt) return fulfillJson(route, 404, { detail: 'Receipt not found' });
  const candidates = receipt.transaction_id != null ? [] : state.receiptCandidates[id] || [];
  return fulfillJson(route, 200, candidates);
}

function handleLinkReceipt(route: Route, state: MockApiState): Promise<void> {
  if (route.request().method() !== 'POST') return route.continue();
  const match = route.request().url().match(/\/api\/receipts\/(\d+)\/link\/(\d+)/);
  const receiptId = match ? Number(match[1]) : 0;
  const txId = match ? Number(match[2]) : 0;
  const receipt = state.receipts.find((r) => r.id === receiptId);
  if (!receipt) return fulfillJson(route, 404, { detail: 'Receipt not found' });
  receipt.transaction_id = txId;
  receipt.status = 'matched';
  receipt.updated_at = new Date().toISOString();
  return fulfillJson(route, 200, receipt);
}

function handleReceiptImage(route: Route, state: MockApiState): Promise<void> {
  const match = route.request().url().match(/\/api\/receipts\/(\d+)\/image$/);
  const id = match ? Number(match[1]) : 0;
  const receipt = state.receipts.find((r) => r.id === id);
  if (
    receipt?.image_mime_type === 'application/pdf' ||
    receipt?.image_filename?.toLowerCase().endsWith('.pdf')
  ) {
    return route.fulfill({
      status: 200,
      contentType: 'application/pdf',
      body: Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n', 'utf-8'),
    });
  }
  return route.fulfill({
    status: 200,
    contentType: 'image/svg+xml',
    body: MOCK_RECEIPT_SVG,
  });
}

function handleReceiptItemPatch(route: Route, state: MockApiState): Promise<void> {
  const match = route.request().url().match(/\/api\/receipts\/(\d+)\/items\/(\d+)$/);
  const receiptId = match ? Number(match[1]) : 0;
  const itemId = match ? Number(match[2]) : 0;
  if (route.request().method() !== 'PATCH') return route.continue();
  const payload = JSON.parse(route.request().postData() || '{}');
  const receipt = state.receipts.find((r) => r.id === receiptId);
  const item = receipt?.items.find((it) => it.id === itemId);
  if (!item) return fulfillJson(route, 404, { detail: 'Not found' });
  if (payload.category !== undefined) item.category = payload.category;
  if (payload.tags !== undefined) item.tags = payload.tags;
  return fulfillJson(route, 200, item);
}

function handleSingleReceipt(route: Route, state: MockApiState): Promise<void> {
  const match = route.request().url().match(/\/api\/receipts\/(\d+)$/);
  const id = match ? Number(match[1]) : 0;
  if (route.request().method() === 'GET') {
    const receipt = state.receipts.find((r) => r.id === id);
    if (!receipt) return fulfillJson(route, 404, { detail: 'Receipt not found' });
    return fulfillJson(route, 200, receipt);
  }
  if (route.request().method() === 'DELETE') {
    state.receipts = state.receipts.filter((r) => r.id !== id);
    return route.fulfill({ status: 204 });
  }
  return route.continue();
}

export async function registerReceiptRoutes(page: Page, state: MockApiState): Promise<void> {
  await page.route(/\/api\/receipts\/statistics\/products(\?.*)?$/, (route) =>
    fulfillJson(route, 200, MOCK_PRODUCT_STATS)
  );
  await page.route(/\/api\/receipts\/reconcile$/, (route) =>
    fulfillJson(route, 200, { status: 'reconciled', matched_count: 1, unmatched_count: 1 })
  );
  await page.route(/\/api\/receipts\/upload$/, (route) =>
    fulfillJson(route, 201, buildUploadedReceipt())
  );
  await page.route(/\/api\/receipts(\?.*)?$/, (route) => {
    const statusParam = new URL(route.request().url()).searchParams.get('status');
    const results = statusParam ? state.receipts.filter((r) => r.status === statusParam) : state.receipts;
    return fulfillJson(route, 200, results);
  });
  await page.route(/\/api\/receipts\/(\d+)\/candidates(\?.*)?$/, (route) =>
    handleReceiptCandidates(route, state)
  );
  await page.route(/\/api\/receipts\/(\d+)\/link\/(\d+)(\?.*)?$/, (route) =>
    handleLinkReceipt(route, state)
  );
  await page.route(/\/api\/receipts\/(\d+)\/image$/, (route) => handleReceiptImage(route, state));
  await page.route(/\/api\/receipts\/(\d+)\/items\/(\d+)$/, (route) =>
    handleReceiptItemPatch(route, state)
  );
  await page.route(/\/api\/receipts\/(\d+)$/, (route) => handleSingleReceipt(route, state));

  await page.route(/\/api\/products(\?.*)?$/, (route) =>
    route.request().method() === 'GET'
      ? fulfillJson(route, 200, MOCK_PRODUCTS_DATA)
      : route.continue()
  );
  await page.route(/\/api\/products\/\d+$/, (route) => {
    const method = route.request().method();
    if (method === 'PATCH') {
      const payload = JSON.parse(route.request().postData() || '{}');
      return fulfillJson(route, 200, { ...MOCK_PRODUCTS_DATA.products[0], ...payload });
    }
    if (method === 'GET') return fulfillJson(route, 200, MOCK_PRODUCTS_DATA.products[0]);
    return route.continue();
  });
}
