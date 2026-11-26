import type { Page, Route } from '@playwright/test';
import type { MockApiState, MockCategoryRecord } from '../mock-types';

function fulfillJson(route: Route, status: number, payload: unknown): Promise<void> {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(payload),
  });
}

function compareNormalizedCategories(
  a: MockCategoryRecord,
  b: MockCategoryRecord,
  enrichedById: Map<number, MockCategoryRecord>
): number {
  const rootA = (a.parent_id !== null ? enrichedById.get(a.parent_id) : a) || a;
  const rootB = (b.parent_id !== null ? enrichedById.get(b.parent_id) : b) || b;
  const sysDiff = Number(rootA.is_system) - Number(rootB.is_system);
  if (sysDiff !== 0) return sysDiff;
  if (rootA.sort_order !== rootB.sort_order) return rootA.sort_order - rootB.sort_order;
  const rootNameCmp = rootA.name.toLowerCase().localeCompare(rootB.name.toLowerCase());
  if (rootNameCmp !== 0) return rootNameCmp;
  const depthDiff = Number(a.parent_id !== null) - Number(b.parent_id !== null);
  if (depthDiff !== 0) return depthDiff;
  if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
  return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
}

function normalizeMockCategories(rows: MockCategoryRecord[]): MockCategoryRecord[] {
  const byId = new Map(rows.map((r) => [r.id, r]));
  const childCounts = new Map<number, number>();
  for (const r of rows) {
    if (r.is_active && r.parent_id !== null) {
      childCounts.set(r.parent_id, (childCounts.get(r.parent_id) || 0) + 1);
    }
  }
  const enriched = rows.map((r) => {
    const parent = r.parent_id !== null ? byId.get(r.parent_id) || null : null;
    return {
      ...r,
      parent_name: parent ? parent.name : null,
      child_count: childCounts.get(r.id) || 0,
    };
  });
  const enrichedById = new Map(enriched.map((r) => [r.id, r]));
  return enriched.sort((a, b) => compareNormalizedCategories(a, b, enrichedById));
}

function handleCreateCategory(route: Route, state: MockApiState): Promise<void> {
  const body = route.request().postDataJSON() || {};
  const cleanedName = String(body.name || '').trim();
  const duplicate = state.categories.find(
    (c) => c.name.toLowerCase() === cleanedName.toLowerCase()
  );
  if (duplicate) {
    return fulfillJson(route, 409, { detail: `Category '${duplicate.name}' already exists.` });
  }
  const parent =
    body.parent_id !== null && body.parent_id !== undefined
      ? state.categories.find((c) => c.id === Number(body.parent_id)) || null
      : null;
  const created: MockCategoryRecord = {
    id: state.nextCategoryId++,
    name: cleanedName,
    parent_id: parent ? parent.id : null,
    parent_name: parent ? parent.name : null,
    is_system: false,
    is_active: true,
    amortize_period: body.amortize_period === 'annual' ? 'annual' : null,
    sort_order: body.sort_order ?? (parent ? parent.sort_order + 5 : 150),
    transaction_count: 0,
    rule_count: 0,
    child_count: 0,
    has_budget_rule: false,
    budget_period: body.amortize_period === 'annual' ? 'annual' : null,
    weekly_limit: null,
    monthly_limit: null,
    annual_limit: null,
  };
  state.categories = normalizeMockCategories([...state.categories, created]);
  return fulfillJson(route, 201, state.categories.find((c) => c.id === created.id)!);
}

function handlePatchCategory(
  route: Route,
  state: MockApiState,
  target: MockCategoryRecord
): Promise<void> {
  const body = route.request().postDataJSON() || {};
  const nextName =
    typeof body.name === 'string' && body.name.trim() ? body.name.trim() : target.name;
  const nextParentId =
    'parent_id' in body
      ? body.parent_id === null
        ? null
        : Number(body.parent_id)
      : target.parent_id;
  const nextAmortize =
    'amortize_period' in body
      ? body.amortize_period === 'annual'
        ? 'annual'
        : null
      : target.amortize_period;

  state.categories = normalizeMockCategories(
    state.categories.map((c) =>
      c.id === target.id
        ? {
            ...c,
            name: nextName,
            parent_id: nextParentId,
            amortize_period: nextAmortize,
            budget_period:
              nextAmortize === 'annual' ? 'annual' : c.has_budget_rule ? 'monthly' : null,
          }
        : c
    )
  );
  return fulfillJson(route, 200, state.categories.find((c) => c.id === target.id)!);
}

function handleDeleteCategory(
  route: Route,
  state: MockApiState,
  target: MockCategoryRecord
): Promise<void> {
  const url = new URL(route.request().url());
  const reassignTo = url.searchParams.get('reassign_to') || target.parent_name || 'General';
  let childrenPromoted = 0;
  state.categories = normalizeMockCategories(
    state.categories
      .filter((c) => c.id !== target.id)
      .map((c) => {
        if (c.parent_id === target.id) {
          childrenPromoted += 1;
          return { ...c, parent_id: null, parent_name: null };
        }
        return c;
      })
  );
  return fulfillJson(route, 200, {
    deleted_id: target.id,
    deleted_name: target.name,
    reassigned_to: reassignTo,
    transactions_reassigned: target.transaction_count,
    rules_reassigned: target.rule_count,
    receipt_items_reassigned: 0,
    products_reassigned: 0,
    children_promoted: childrenPromoted,
  });
}

export async function registerCategoryRoutes(page: Page, state: MockApiState): Promise<void> {
  await page.route(/\/api\/categories(\?.*)?$/, (route) => {
    const method = route.request().method();
    if (method === 'GET') {
      const includeInactive = new URL(route.request().url()).searchParams.get('include_inactive') === 'true';
      const ordered = normalizeMockCategories(state.categories).filter(
        (c) => includeInactive || c.is_active
      );
      return fulfillJson(route, 200, ordered);
    }
    if (method === 'POST') return handleCreateCategory(route, state);
    return route.continue();
  });

  await page.route(/\/api\/categories\/(\d+)(\?.*)?$/, (route) => {
    const match = route.request().url().match(/\/api\/categories\/(\d+)/);
    const catId = match ? Number(match[1]) : -1;
    const target = state.categories.find((c) => c.id === catId);
    if (!target) return fulfillJson(route, 404, { detail: 'Category not found.' });
    const method = route.request().method();
    if (method === 'PATCH') return handlePatchCategory(route, state, target);
    if (method === 'DELETE') return handleDeleteCategory(route, state, target);
    return route.continue();
  });
}
