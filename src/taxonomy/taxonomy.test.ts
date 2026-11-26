import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Account, CategoryItem, InstitutionInfo } from '../types';
import {
  ACCOUNT_TIER_META,
  TIER_ORDER,
  buildInstitutionOptions,
  deriveCategoryTaxonomy,
  formatAccountTypeLabel,
  formatPeriodLabel,
  isTransferCategory,
  loadCategoryRows,
  toTaxonomySlug,
  useCategories,
} from './index';

function makeCategory(overrides: Partial<CategoryItem> = {}): CategoryItem {
  return {
    id: 1,
    name: 'Food',
    parent_id: null,
    parent_name: null,
    is_system: false,
    is_active: true,
    amortize_period: null,
    sort_order: 10,
    transaction_count: 0,
    rule_count: 0,
    child_count: 0,
    has_budget_rule: false,
    budget_period: null,
    weekly_limit: null,
    monthly_limit: null,
    annual_limit: null,
    ...overrides,
  };
}

function makeAccount(overrides: Partial<Account> = {}): Account {
  return {
    id: 1001,
    name: 'Alex Everyday',
    account_type: 'checking',
    tier: 'cash',
    institution: 'Main Bank',
    currency: 'NZD',
    expected_annual_return: 0,
    is_active: true,
    ...overrides,
  };
}

function makeInstitution(overrides: Partial<InstitutionInfo> = {}): InstitutionInfo {
  return {
    name: 'Main Bank',
    default_tier: 'cash',
    default_type: 'checking',
    currency: 'NZD',
    ...overrides,
  };
}

describe('Midas taxonomy deep module', () => {
  describe('tiers metadata and ordering', () => {
    it('defines canonical tier order and consistent badge/card/stat variants', () => {
      expect(TIER_ORDER).toEqual(['cash', 'growth', 'locked']);
      expect(ACCOUNT_TIER_META.cash).toMatchObject({
        shortLabel: 'Cash Floor',
        badgeVariant: 'info',
        cardVariant: 'blue',
        statCardVariant: 'sky',
      });
      expect(ACCOUNT_TIER_META.growth).toMatchObject({
        shortLabel: 'Growth',
        badgeVariant: 'success',
        cardVariant: 'emerald',
        statCardVariant: 'emerald',
      });
      expect(ACCOUNT_TIER_META.locked).toMatchObject({
        shortLabel: 'Locked',
        badgeVariant: 'warning',
        cardVariant: 'amber',
        statCardVariant: 'amber',
      });
    });
  });

  describe('toTaxonomySlug', () => {
    it('normalizes whitespace, punctuation, and leading/trailing separators', () => {
      expect(toTaxonomySlug('Groceries')).toBe('groceries');
      expect(toTaxonomySlug('Fees & Admin')).toBe('fees-admin');
      expect(toTaxonomySlug('  Software & AI  ')).toBe('software-ai');
      expect(toTaxonomySlug('---Debt & Loans---')).toBe('debt-loans');
      expect(toTaxonomySlug('   ')).toBe('');
    });
  });

  describe('buildInstitutionOptions', () => {
    it('combines institutions and accounts with trimming, deduping, and zero fallback', () => {
      expect(buildInstitutionOptions([], [])).toEqual([]);

      const institutions = [
        makeInstitution({ name: '  Main Bank  ' }),
        makeInstitution({ name: '   ' }),
        makeInstitution({ name: 'Northwind Wealth' }),
      ];
      const accounts = [
        makeAccount({ id: 1001, institution: 'main bank' }),
        makeAccount({ id: 1002, institution: '  Harbour Credit  ' }),
        makeAccount({ id: 1003, institution: '' }),
        makeAccount({ id: 1004, institution: 'Harbour Credit' }),
      ];

      expect(buildInstitutionOptions(institutions, accounts)).toEqual([
        'Main Bank',
        'Northwind Wealth',
        'Harbour Credit',
      ]);
    });
  });

  describe('deriveCategoryTaxonomy and fail-loud category loading', () => {
    it('returns empty collections when no active categories exist', () => {
      expect(deriveCategoryTaxonomy([])).toEqual({
        categoryNames: [],
        budgetCategoryNames: [],
        baseCategories: [],
        parentMap: {},
      });

      expect(deriveCategoryTaxonomy([makeCategory({ is_active: false })])).toEqual({
        categoryNames: [],
        budgetCategoryNames: [],
        baseCategories: [],
        parentMap: {},
      });
    });

    it('derives active names, budget-eligible expenses, base categories, and parent map', () => {
      const food = makeCategory({ id: 1, name: 'Food' });
      const dining = makeCategory({ id: 2, name: 'Dining', parent_id: 1, parent_name: 'Food' });
      const transfers = makeCategory({ id: 3, name: 'Transfers', is_system: true });
      const income = makeCategory({ id: 4, name: 'Income', is_system: true });
      const general = makeCategory({ id: 5, name: 'General', is_system: true });
      const archived = makeCategory({ id: 6, name: 'Archived', is_active: false });

      const result = deriveCategoryTaxonomy([food, dining, transfers, income, general, archived]);

      expect(result.categoryNames).toEqual(['Food', 'Dining', 'Transfers', 'Income', 'General']);
      expect(result.budgetCategoryNames).toEqual(['Food', 'Dining', 'General']);
      expect(result.baseCategories.map((c) => c.name)).toEqual(['Food']);
      expect(result.parentMap).toEqual({ Dining: 'Food' });
    });

    it('clears categories on load failure and recovers on retry', async () => {
      const failed = await loadCategoryRows(async () => {
        throw new Error('Categories API unreachable');
      });
      expect(failed).toEqual({
        categories: [],
        error: 'Categories API unreachable',
      });
      expect(deriveCategoryTaxonomy(failed.categories)).toEqual({
        categoryNames: [],
        budgetCategoryNames: [],
        baseCategories: [],
        parentMap: {},
      });

      const food = makeCategory({ id: 1, name: 'Food' });
      const recovered = await loadCategoryRows(async () => [food]);
      expect(recovered).toEqual({
        categories: [food],
        error: null,
      });
      expect(deriveCategoryTaxonomy(recovered.categories).budgetCategoryNames).toEqual(['Food']);
    });

    it('exposes empty default context values without static fallback categories', () => {
      let snapshot: ReturnType<typeof useCategories> | null = null;
      const Probe: React.FC = () => {
        snapshot = useCategories();
        return null;
      };
      renderToStaticMarkup(React.createElement(Probe));

      expect(snapshot).not.toBeNull();
      expect(snapshot!.categories).toEqual([]);
      expect(snapshot!.categoryNames).toEqual([]);
      expect(snapshot!.budgetCategoryNames).toEqual([]);
      expect(snapshot!.baseCategories).toEqual([]);
      expect(snapshot!.parentMap).toEqual({});
      expect(snapshot!.loading).toBe(false);
      expect(snapshot!.error).toBeNull();
    });
  });

  describe('reference helpers', () => {
    it('formats account type labels cleanly', () => {
      expect(formatAccountTypeLabel()).toBe('Account');
      expect(formatAccountTypeLabel('  ')).toBe('Account');
      expect(formatAccountTypeLabel('kiwisaver')).toBe('KiwiSaver');
      expect(formatAccountTypeLabel('private_note')).toBe('Private Note');
      expect(formatAccountTypeLabel('term_deposit')).toBe('Term Deposit');
    });

    it('detects transfer categories and linked transfer transactions', () => {
      expect(isTransferCategory('Transfers')).toBe(true);
      expect(isTransferCategory('transfer')).toBe(true);
      expect(isTransferCategory('Food')).toBe(false);
      expect(
        isTransferCategory('Food', {
          id: 1,
          transaction_date: '2026-11-10',
          account_id: 1,
          amount: -100,
          currency: 'NZD',
          merchant: 'Internal Move',
          category: 'Food',
          linked_transaction_id: 99,
        })
      ).toBe(true);
    });

    it('formats period labels across standard, annual, all, and custom ranges', () => {
      expect(formatPeriodLabel('annual')).toBe('Trailing 52 Weeks (365d)');
      expect(formatPeriodLabel('all')).toBe('All Time');
      expect(formatPeriodLabel('week')).toBe('This Week');
      expect(formatPeriodLabel('month')).toBe('This Month');
      expect(formatPeriodLabel('custom', '2026-11-01', '2026-11-15')).toBe(
        '2026-11-01 to 2026-11-15'
      );
      expect(formatPeriodLabel('custom')).toBe('Custom Range');
    });
  });
});
