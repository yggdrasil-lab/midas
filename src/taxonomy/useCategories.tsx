import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { fetchCategories } from '../transport';
import { CategoryItem } from '../types';

export interface DerivedCategoryTaxonomy {
  categoryNames: string[];
  budgetCategoryNames: string[];
  baseCategories: CategoryItem[];
  parentMap: Record<string, string>;
}

export interface CategoriesContextValue extends DerivedCategoryTaxonomy {
  categories: CategoryItem[];
  loading: boolean;
  error: string | null;
  refreshCategories: () => Promise<void>;
}

const NON_EXPENSE_SYSTEM = new Set(['transfers', 'transfer', 'income']);

const DEFAULT_CONTEXT_VALUE: CategoriesContextValue = {
  categories: [],
  loading: false,
  error: null,
  categoryNames: [],
  budgetCategoryNames: [],
  baseCategories: [],
  parentMap: {},
  refreshCategories: async () => {},
};

const CategoriesContext = createContext<CategoriesContextValue>(DEFAULT_CONTEXT_VALUE);

/**
 * Derives active category names, budget-eligible expense names, base categories,
 * and child-to-parent lookup mappings from live Plutus category records.
 */
export function deriveCategoryTaxonomy(
  categories: readonly CategoryItem[]
): DerivedCategoryTaxonomy {
  const active = categories.filter((c) => c.is_active);
  if (active.length === 0) {
    return {
      categoryNames: [],
      budgetCategoryNames: [],
      baseCategories: [],
      parentMap: {},
    };
  }

  const categoryNames = active.map((c) => c.name);
  const budgetCategoryNames = active
    .filter((c) => !NON_EXPENSE_SYSTEM.has(c.name.trim().toLowerCase()))
    .map((c) => c.name);
  const baseCategories = active.filter((c) => !c.is_system && c.parent_id === null);
  const parentMap: Record<string, string> = {};
  for (const cat of active) {
    if (cat.parent_name) {
      parentMap[cat.name] = cat.parent_name;
    }
  }

  return {
    categoryNames,
    budgetCategoryNames,
    baseCategories,
    parentMap,
  };
}

/**
 * Fetches dynamic category rows fail-loudly: clears stale rows and returns
 * an explicit error message when loading fails.
 */
export async function loadCategoryRows(
  fetcher: () => Promise<CategoryItem[]> = fetchCategories
): Promise<{ categories: CategoryItem[]; error: string | null }> {
  try {
    const rows = await fetcher();
    return { categories: rows, error: null };
  } catch (err) {
    console.error('Failed to load dynamic categories:', err);
    return {
      categories: [],
      error: err instanceof Error ? err.message : 'Failed to load categories',
    };
  }
}

/**
 * Provides dynamic hierarchical spending categories synced with the Plutus backend,
 * exposing explicit empty collections and error state when loading fails.
 */
export const CategoryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshCategories = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await loadCategoryRows();
    setCategories(result.categories);
    setError(result.error);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refreshCategories();
  }, [refreshCategories]);

  const value = useMemo<CategoriesContextValue>(() => {
    const derived = deriveCategoryTaxonomy(categories);
    return {
      categories,
      loading,
      error,
      ...derived,
      refreshCategories,
    };
  }, [categories, loading, error, refreshCategories]);

  return (
    <CategoriesContext.Provider value={value}>
      {children}
    </CategoriesContext.Provider>
  );
};

/**
 * Read active hierarchical categories and refresh trigger from the shared CategoryProvider.
 */
export function useCategories(): CategoriesContextValue {
  return useContext(CategoriesContext);
}
