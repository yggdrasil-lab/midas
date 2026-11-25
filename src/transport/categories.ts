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

function fetchRulesRequest(
  client: HttpClient,
  isActive?: boolean
): Promise<CategorizationRule[]> {
  const params = new URLSearchParams();
  if (isActive !== undefined) params.set('is_active', String(isActive));
  const qs = params.toString();
  return client.requestJson<CategorizationRule[]>(`/rules${qs ? `?${qs}` : ''}`, {
    fallbackError: 'Failed to fetch categorization rules',
  });
}

function createRulesOps(client: HttpClient) {
  return {
    fetchRules: (isActive?: boolean) => fetchRulesRequest(client, isActive),
    createRule: (payload: CategorizationRuleCreate) =>
      client.requestJson<CategorizationRule>(
        '/rules',
        jsonRequestInit('POST', payload, 'Failed to create categorization rule')
      ),
    updateRule: (id: number, payload: CategorizationRuleUpdate) =>
      client.requestJson<CategorizationRule>(
        `/rules/${id}`,
        jsonRequestInit('PUT', payload, 'Failed to update categorization rule')
      ),
    deleteRule: (id: number) =>
      client.requestVoid(`/rules/${id}`, {
        method: 'DELETE',
        fallbackError: 'Failed to delete categorization rule',
      }),
    applyAllRules: () =>
      client.requestJson<{
        evaluated: number;
        updated: number;
        receipt_items_evaluated?: number;
        receipt_items_updated?: number;
      }>('/rules/apply-all', {
        method: 'POST',
        fallbackError: 'Failed to apply categorization rules',
      }),
  };
}

function createCategoryOps(client: HttpClient) {
  return {
    fetchCategories: (includeInactive = false) => {
      const params = includeInactive ? '?include_inactive=true' : '';
      return client.requestJson<CategoryItem[]>(`/categories${params}`, {
        fallbackError: 'Failed to fetch categories',
      });
    },
    createCategory: (payload: CategoryCreatePayload) =>
      client.requestJson<CategoryItem>(
        '/categories',
        jsonRequestInit('POST', payload, 'Failed to create category')
      ),
    updateCategory: (id: number, payload: CategoryUpdatePayload) =>
      client.requestJson<CategoryItem>(
        `/categories/${id}`,
        jsonRequestInit('PATCH', payload, 'Failed to update category')
      ),
    deleteCategory: (id: number, reassignTo?: string) => {
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

export function createCategoriesTransport(client: HttpClient) {
  return {
    ...createRulesOps(client),
    ...createCategoryOps(client),
  };
}
