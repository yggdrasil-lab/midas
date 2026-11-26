import type { MockCategoryRecord } from '../mock-types';

interface CategorySpec {
  id: number;
  name: string;
  parentId: number | null;
  parentName: string | null;
  isSystem?: boolean;
  amortize?: 'annual' | null;
  sort: number;
  txns?: number;
  rules?: number;
  weekly?: number | null;
}

const CATEGORY_SPECS: CategorySpec[] = [
  { id: 1, name: 'Food', parentId: null, parentName: null, sort: 10, txns: 6, rules: 1, weekly: 100 },
  { id: 2, name: 'Dining', parentId: 1, parentName: 'Food', sort: 11, txns: 14, rules: 2 },
  { id: 3, name: 'Groceries', parentId: 1, parentName: 'Food', sort: 12, txns: 18, rules: 2, weekly: 200 },
  { id: 4, name: 'Alcohol', parentId: 1, parentName: 'Food', sort: 13, txns: 3, rules: 1 },
  { id: 5, name: 'Housing', parentId: null, parentName: null, sort: 20, txns: 4, rules: 1 },
  { id: 6, name: 'Rent', parentId: 5, parentName: 'Housing', sort: 21, txns: 8, rules: 1 },
  { id: 7, name: 'Household', parentId: 5, parentName: 'Housing', sort: 22, txns: 5 },
  { id: 8, name: 'Transport', parentId: null, parentName: null, sort: 30, txns: 4, weekly: 60 },
  { id: 9, name: 'Fuel', parentId: 8, parentName: 'Transport', sort: 31, txns: 7, rules: 1 },
  { id: 10, name: 'Transit', parentId: 8, parentName: 'Transport', sort: 32, txns: 9, rules: 1 },
  { id: 11, name: 'Vehicle', parentId: 8, parentName: 'Transport', sort: 33, txns: 2 },
  { id: 12, name: 'Health', parentId: null, parentName: null, sort: 40, txns: 3, weekly: 50 },
  { id: 13, name: 'Fitness', parentId: 12, parentName: 'Health', sort: 41, txns: 4, rules: 1 },
  { id: 14, name: 'Medical', parentId: 12, parentName: 'Health', sort: 42, txns: 2 },
  { id: 15, name: 'Supplements', parentId: 12, parentName: 'Health', sort: 43, txns: 3 },
  { id: 16, name: 'Personal Care', parentId: 12, parentName: 'Health', sort: 44, txns: 4 },
  { id: 17, name: 'Shopping', parentId: null, parentName: null, sort: 50, txns: 6 },
  { id: 18, name: 'Clothing', parentId: 17, parentName: 'Shopping', sort: 51, txns: 2 },
  { id: 19, name: 'Tech', parentId: 17, parentName: 'Shopping', sort: 52, txns: 5 },
  { id: 20, name: 'Utilities', parentId: null, parentName: null, sort: 60, txns: 4, weekly: 80 },
  { id: 21, name: 'Bills & Telco', parentId: 20, parentName: 'Utilities', sort: 61, txns: 6, rules: 1 },
  { id: 22, name: 'Software & AI', parentId: 20, parentName: 'Utilities', sort: 62, txns: 8, rules: 2 },
  { id: 23, name: 'Insurance', parentId: null, parentName: null, sort: 70, txns: 4, weekly: 55 },
  { id: 24, name: 'Leisure', parentId: null, parentName: null, amortize: 'annual', sort: 80, txns: 6, weekly: 50 },
  { id: 25, name: 'Gaming', parentId: 24, parentName: 'Leisure', sort: 81, txns: 3 },
  { id: 26, name: 'Travel', parentId: null, parentName: null, amortize: 'annual', sort: 90, txns: 5 },
  { id: 27, name: 'Family', parentId: null, parentName: null, sort: 100, txns: 3 },
  { id: 28, name: 'Finance', parentId: null, parentName: null, sort: 110, txns: 1 },
  { id: 29, name: 'Fees & Admin', parentId: 28, parentName: 'Finance', sort: 111, txns: 4, rules: 1 },
  { id: 30, name: 'Debt & Loans', parentId: 28, parentName: 'Finance', isSystem: true, sort: 112, txns: 2 },
  { id: 31, name: 'General', parentId: null, parentName: null, isSystem: true, sort: 900, txns: 4 },
  { id: 32, name: 'Transfers', parentId: null, parentName: null, isSystem: true, sort: 910, txns: 10 },
  { id: 33, name: 'Income', parentId: null, parentName: null, isSystem: true, sort: 920, txns: 6 },
];

export function buildInitialMockCategories(): MockCategoryRecord[] {
  const childCountByParent = new Map<number, number>();
  for (const spec of CATEGORY_SPECS) {
    if (spec.parentId !== null) {
      childCountByParent.set(spec.parentId, (childCountByParent.get(spec.parentId) || 0) + 1);
    }
  }

  return CATEGORY_SPECS.map((s) => {
    const weekly = s.weekly ?? null;
    const isAnnual = s.amortize === 'annual';
    return {
      id: s.id,
      name: s.name,
      parent_id: s.parentId,
      parent_name: s.parentName,
      is_system: Boolean(s.isSystem),
      is_active: true,
      amortize_period: s.amortize ?? null,
      sort_order: s.sort,
      transaction_count: s.txns ?? 0,
      rule_count: s.rules ?? 0,
      child_count: childCountByParent.get(s.id) ?? 0,
      has_budget_rule: weekly !== null,
      budget_period: weekly !== null ? (isAnnual ? 'annual' : 'monthly') : isAnnual ? 'annual' : null,
      weekly_limit: weekly,
      monthly_limit: weekly !== null ? Math.round(((weekly * 52) / 12) * 100) / 100 : null,
      annual_limit: weekly !== null ? Math.round(weekly * 52 * 100) / 100 : null,
    };
  });
}
