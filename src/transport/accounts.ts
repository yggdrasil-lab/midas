import {
  Account,
  AccountUpdatePayload,
  AssetSnapshot,
  AssetSnapshotCreatePayload,
  InstitutionInfo,
  LoanCreatePayload,
  LoanItem,
  LoansSummaryResponse,
  SyncResult,
} from '../types';
import { HttpClient, jsonRequestInit } from './http';

function fetchInstitutions(client: HttpClient): Promise<InstitutionInfo[]> {
  return client.requestJson<InstitutionInfo[]>('/institutions', {
    fallbackError: 'Failed to fetch institutions',
  });
}

function fetchAccounts(client: HttpClient): Promise<Account[]> {
  return client.requestJson<Account[]>('/accounts', {
    fallbackError: 'Failed to fetch accounts',
  });
}

function updateAccount(
  client: HttpClient,
  accountId: number,
  payload: AccountUpdatePayload
): Promise<Account> {
  return client.requestJson<Account>(
    `/accounts/${accountId}`,
    jsonRequestInit('PATCH', payload, `Failed to update account ${accountId}`)
  );
}

function fetchAccountSnapshots(
  client: HttpClient,
  accountId: number,
  limit = 30
): Promise<AssetSnapshot[]> {
  return client.requestJson<AssetSnapshot[]>(
    `/accounts/${accountId}/snapshots?limit=${limit}`,
    { fallbackError: `Failed to fetch snapshots for account ${accountId}` }
  );
}

function recordAccountSnapshot(
  client: HttpClient,
  accountId: number,
  payload: AssetSnapshotCreatePayload
): Promise<AssetSnapshot> {
  return client.requestJson<AssetSnapshot>(
    `/accounts/${accountId}/snapshots`,
    jsonRequestInit('POST', payload, 'Failed to record account snapshot')
  );
}

function fetchLoans(client: HttpClient): Promise<LoansSummaryResponse> {
  return client.requestJson<LoansSummaryResponse>('/loans', {
    fallbackError: 'Failed to fetch loans',
  });
}

function createLoan(client: HttpClient, payload: LoanCreatePayload): Promise<LoanItem> {
  return client.requestJson<LoanItem>(
    '/loans',
    jsonRequestInit('POST', payload, 'Failed to create loan')
  );
}

function deleteLoan(client: HttpClient, id: number): Promise<void> {
  return client.requestVoid(`/loans/${id}`, {
    method: 'DELETE',
    fallbackError: 'Failed to delete loan',
  });
}

function syncAllIntegrations(client: HttpClient, days = 30): Promise<SyncResult> {
  return client.requestJson<SyncResult>(`/integrations/sync/all?days=${days}`, {
    method: 'POST',
    fallbackError: 'Bank feed sync failed',
  });
}

export function createAccountsTransport(client: HttpClient) {
  return {
    fetchInstitutions: () => fetchInstitutions(client),
    fetchAccounts: () => fetchAccounts(client),
    updateAccount: (accountId: number, payload: AccountUpdatePayload) =>
      updateAccount(client, accountId, payload),
    fetchAccountSnapshots: (accountId: number, limit = 30) =>
      fetchAccountSnapshots(client, accountId, limit),
    recordAccountSnapshot: (accountId: number, payload: AssetSnapshotCreatePayload) =>
      recordAccountSnapshot(client, accountId, payload),
    fetchLoans: () => fetchLoans(client),
    createLoan: (payload: LoanCreatePayload) => createLoan(client, payload),
    deleteLoan: (id: number) => deleteLoan(client, id),
    syncAllIntegrations: (days = 30) => syncAllIntegrations(client, days),
  };
}
