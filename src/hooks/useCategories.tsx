import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  BUDGET_CATEGORY_CHOICES,
  CATEGORY_CHOICES,
  CATEGORY_PARENTS,
} from '../constants/categories';
import { fetchCategories } from '../transport';
import { CategoryItem } from '../types';

interface CategoriesContextValue {
  categories: CategoryItem[];
  loading: boolean;
  error: string | null;
  categoryNames: string[];
  budgetCategoryNames: string[];
  baseCategories: CategoryItem[];
  parentMap: Record<string, string>;
  refreshCategories: () => Promise<void>;
}

const NON_EXPENSE_SYSTEM = new Set(['transfers', 'transfer', 'income']);

const DEFAULT_CONTEXT_VALUE: CategoriesContextValue = {
  categories: [],
  loading: false,
  error: null,
  categoryNames: Array.from(CATEGORY_CHOICES),
  budgetCategoryNames: Array.from(BUDGET_CATEGORY_CHOICES),
  baseCategories: [],
  parentMap: { ...CATEGORY_PARENTS },
  refreshCategories: async () => {},
};

const CategoriesContext = createContext<CategoriesContextValue>(DEFAULT_CONTEXT_VALUE);

/**
 * Provides dynamic hierarchical spending categories synced with the Plutus backend,
 * falling back cleanly to static canonical defaults until loaded.
 */
export const CategoryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshCategories = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await fetchCategories();
      setCategories(rows);
    } catch (err) {
      console.error('Failed to load dynamic categories:', err);
      setError(err instanceof Error ? err.message : 'Failed to load categories');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshCategories();
  }, [refreshCategories]);

  const value = useMemo<CategoriesContextValue>(() => {
    const active = categories.filter((c) => c.is_active);
    if (active.length === 0) {
      return {
        ...DEFAULT_CONTEXT_VALUE,
        categories,
        loading,
        error,
        refreshCategories,
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
      categories,
      loading,
      error,
      categoryNames,
      budgetCategoryNames,
      baseCategories,
      parentMap,
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
