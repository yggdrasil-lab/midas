import {
  CategorizationRule,
  CategorizationRuleCreate,
  CategorizationRuleUpdate,
  CategoryCreatePayload,
  CategoryDeleteResult,
  CategoryItem,
  CategoryUpdatePayload,
} from '../types';
import { HttpClient, jsonRequestInit } from './http';

export function createCategoriesTransport(client: HttpClient) {
  return {
    fetchRules(isActive?: boolean): Promise<CategorizationRule[]> {
      const params = new URLSearchParams();
      if (isActive !== undefined) params.set('is_active', String(isActive));
      const qs = params.toString();
      return client.requestJson<CategorizationRule[]>(`/rules${qs ? `?${qs}` : ''}`, {
        fallbackError: 'Failed to fetch categorization rules',
      });
    },

    createRule(payload: CategorizationRuleCreate): Promise<CategorizationRule> {
      return client.requestJson<CategorizationRule>(
        '/rules',
        jsonRequestInit('POST', payload, 'Failed to create categorization rule')
      );
    },

    updateRule(id: number, payload: CategorizationRuleUpdate): Promise<CategorizationRule> {
      return client.requestJson<CategorizationRule>(
        `/rules/${id}`,
        jsonRequestInit('PUT', payload, 'Failed to update categorization rule')
      );
    },

    deleteRule(id: number): Promise<void> {
      return client.requestVoid(`/rules/${id}`, {
        method: 'DELETE',
        fallbackError: 'Failed to delete categorization rule',
      });
    },

    applyAllRules(): Promise<{
      evaluated: number;
      updated: number;
      receipt_items_evaluated?: number;
      receipt_items_updated?: number;
    }> {
      return client.requestJson('/rules/apply-all', {
        method: 'POST',
        fallbackError: 'Failed to apply categorization rules',
      });
    },

    fetchCategories(includeInactive = false): Promise<CategoryItem[]> {
      const params = includeInactive ? '?include_inactive=true' : '';
      return client.requestJson<CategoryItem[]>(`/categories${params}`, {
        fallbackError: 'Failed to fetch categories',
      });
    },

    createCategory(payload: CategoryCreatePayload): Promise<CategoryItem> {
      return client.requestJson<CategoryItem>(
        '/categories',
        jsonRequestInit('POST', payload, 'Failed to create category')
      );
    },

    updateCategory(id: number, payload: CategoryUpdatePayload): Promise<CategoryItem> {
      return client.requestJson<CategoryItem>(
        `/categories/${id}`,
        jsonRequestInit('PATCH', payload, 'Failed to update category')
      );
    },

    deleteCategory(id: number, reassignTo?: string): Promise<CategoryDeleteResult> {
      const params = reassignTo
        ? `?reassign_to=${encodeURIComponent(reassignTo)}`
        : '';
      return client.requestJson<CategoryDeleteResult>(`/categories/${id}${params}`, {
        method: 'DELETE',
        fallbackError: 'Failed to delete category',
      });
    },
  };
}
