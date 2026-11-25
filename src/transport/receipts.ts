import {
  Product,
  ProductListResponse,
  ProductStatisticsResponse,
  ProductUpdatePayload,
  Receipt,
  ReceiptItem,
  ReceiptTransactionCandidate,
} from '../types';
import { HttpClient, jsonRequestInit } from './http';

export function createReceiptsTransport(client: HttpClient) {
  return {
    fetchReceipts(status?: string): Promise<Receipt[]> {
      const params = new URLSearchParams();
      if (status) params.set('status', status);
      const qs = params.toString();
      return client.requestJson<Receipt[]>(`/receipts${qs ? `?${qs}` : ''}`, {
        fallbackError: 'Failed to fetch receipts',
      });
    },

    fetchReceipt(id: number): Promise<Receipt> {
      return client.requestJson<Receipt>(`/receipts/${id}`, {
        fallbackError: 'Failed to fetch receipt',
      });
    },

    uploadReceipt(file: File): Promise<Receipt> {
      const formData = new FormData();
      formData.append('file', file);
      return client.requestFormData<Receipt>('/receipts/upload', formData, {
        fallbackError: 'Failed to upload receipt',
      });
    },

    deleteReceipt(id: number): Promise<void> {
      return client.requestVoid(`/receipts/${id}`, {
        method: 'DELETE',
        fallbackError: 'Failed to delete receipt',
      });
    },

    reprocessReceipt(id: number): Promise<Receipt> {
      return client.requestJson<Receipt>(`/receipts/${id}/reprocess`, {
        method: 'POST',
        fallbackError: 'Failed to reprocess receipt',
      });
    },

    getReceiptImageUrl(id: number): string {
      return `${client.baseUrl}/receipts/${id}/image`;
    },

    updateReceiptItem(
      receiptId: number,
      itemId: number,
      payload: {
        category?: string;
        domain?: string | null;
        tags?: string[];
        notes?: string | null;
      }
    ): Promise<ReceiptItem> {
      return client.requestJson<ReceiptItem>(
        `/receipts/${receiptId}/items/${itemId}`,
        jsonRequestInit('PATCH', payload, 'Failed to update receipt item')
      );
    },

    fetchProductStatistics(
      domain?: string,
      productType?: string
    ): Promise<ProductStatisticsResponse> {
      const params = new URLSearchParams();
      if (domain) params.set('domain', domain);
      if (productType) params.set('product_type', productType);
      const qs = params.toString();
      return client.requestJson<ProductStatisticsResponse>(
        `/receipts/statistics/products${qs ? `?${qs}` : ''}`,
        { fallbackError: 'Failed to fetch product statistics' }
      );
    },

    getReceiptCandidates(receiptId: number): Promise<ReceiptTransactionCandidate[]> {
      return client.requestJson<ReceiptTransactionCandidate[]>(
        `/receipts/${receiptId}/candidates`,
        { fallbackError: 'Failed to load receipt candidates' }
      );
    },

    linkReceipt(receiptId: number, transactionId: number): Promise<Receipt> {
      return client.requestJson<Receipt>(`/receipts/${receiptId}/link/${transactionId}`, {
        method: 'POST',
        fallbackError: 'Failed to link receipt',
      });
    },

    reconcileReceipts(): Promise<{ status: string; matched_count: number }> {
      return client.requestJson<{ status: string; matched_count: number }>(
        '/receipts/reconcile',
        { method: 'POST', fallbackError: 'Failed to reconcile receipts' }
      );
    },

    fetchProducts(params?: {
      domain?: string;
      tag?: string;
      search?: string;
      is_favorite?: boolean;
    }): Promise<ProductListResponse> {
      const query = new URLSearchParams();
      if (params?.domain) query.set('domain', params.domain);
      if (params?.tag) query.set('tag', params.tag);
      if (params?.search) query.set('search', params.search);
      if (params?.is_favorite !== undefined) {
        query.set('is_favorite', String(params.is_favorite));
      }
      const qs = query.toString();
      return client.requestJson<ProductListResponse>(`/products${qs ? `?${qs}` : ''}`, {
        fallbackError: 'Failed to fetch products',
      });
    },

    fetchProduct(id: number): Promise<Product> {
      return client.requestJson<Product>(`/products/${id}`, {
        fallbackError: 'Failed to fetch product',
      });
    },

    createProduct(payload: Partial<Product>): Promise<Product> {
      return client.requestJson<Product>(
        '/products',
        jsonRequestInit('POST', payload, 'Failed to create product')
      );
    },

    updateProduct(id: number, payload: ProductUpdatePayload): Promise<Product> {
      return client.requestJson<Product>(
        `/products/${id}`,
        jsonRequestInit('PATCH', payload, 'Failed to update product')
      );
    },

    deleteProduct(id: number): Promise<{ status: string; id: number }> {
      return client.requestJson<{ status: string; id: number }>(`/products/${id}`, {
        method: 'DELETE',
        fallbackError: 'Failed to delete product',
      });
    },
  };
}
