import {
  Account,
  AssetSnapshot,
  AssetSnapshotCreatePayload,
  InstitutionInfo,
  LoanCreatePayload,
  LoanItem,
  LoansSummaryResponse,
  SyncResult,
} from '../types';
import { HttpClient, jsonRequestInit } from './http';

export function createAccountsTransport(client: HttpClient) {
  return {
    fetchInstitutions(): Promise<InstitutionInfo[]> {
      return client.requestJson<InstitutionInfo[]>('/institutions', {
        fallbackError: 'Failed to fetch institutions',
      });
    },

    fetchAccounts(): Promise<Account[]> {
      return client.requestJson<Account[]>('/accounts', {
        fallbackError: 'Failed to fetch accounts',
      });
    },

    fetchAccountSnapshots(accountId: number, limit = 30): Promise<AssetSnapshot[]> {
      return client.requestJson<AssetSnapshot[]>(
        `/accounts/${accountId}/snapshots?limit=${limit}`,
        { fallbackError: `Failed to fetch snapshots for account ${accountId}` }
      );
    },

    recordAccountSnapshot(
      accountId: number,
      payload: AssetSnapshotCreatePayload
    ): Promise<AssetSnapshot> {
      return client.requestJson<AssetSnapshot>(
        `/accounts/${accountId}/snapshots`,
        jsonRequestInit('POST', payload, 'Failed to record account snapshot')
      );
    },

    fetchLoans(): Promise<LoansSummaryResponse> {
      return client.requestJson<LoansSummaryResponse>('/loans', {
        fallbackError: 'Failed to fetch loans',
      });
    },

    createLoan(payload: LoanCreatePayload): Promise<LoanItem> {
      return client.requestJson<LoanItem>(
        '/loans',
        jsonRequestInit('POST', payload, 'Failed to create loan')
      );
    },

    deleteLoan(id: number): Promise<void> {
      return client.requestVoid(`/loans/${id}`, {
        method: 'DELETE',
        fallbackError: 'Failed to delete loan',
      });
    },

    syncAllIntegrations(days = 30): Promise<SyncResult> {
      return client.requestJson<SyncResult>(`/integrations/sync/all?days=${days}`, {
        method: 'POST',
        fallbackError: 'Bank feed sync failed',
      });
    },
  };
}
