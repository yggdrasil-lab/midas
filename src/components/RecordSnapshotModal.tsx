import React, { useEffect, useState } from 'react';
import { Button, FormField, Modal, SelectInput, TextInput } from '@yggdrasil-lab/ui';
import { fetchAccountSnapshots, recordAccountSnapshot } from '../services/api';
import { Account, AssetSnapshot } from '../types';

interface RecordSnapshotModalProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: Account[];
  initialAccountId: number | null;
  getAccountLatestBalance: (accountId: number) => number;
  onSnapshotSaved: (
    accountId: number,
    snapshots: AssetSnapshot[],
    accountName: string
  ) => void;
  onError: (message: string) => void;
}

/**
 * Modal for recording a manual balance valuation checkpoint on a portfolio account.
 */
export const RecordSnapshotModal: React.FC<RecordSnapshotModalProps> = ({
  isOpen,
  onClose,
  accounts,
  initialAccountId,
  getAccountLatestBalance,
  onSnapshotSaved,
  onError,
}) => {
  const [accountId, setAccountId] = useState<number | null>(initialAccountId);
  const [balance, setBalance] = useState('');
  const [snapshotDate, setSnapshotDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const targetId = initialAccountId ?? accounts[0]?.id ?? null;
    setAccountId(targetId);
    setBalance(targetId ? String(getAccountLatestBalance(targetId) || '') : '');
    setSnapshotDate(new Date().toISOString().split('T')[0]);
    setNotes('');
  }, [isOpen, initialAccountId, accounts, getAccountLatestBalance]);

  const selectedAccount = accounts.find((a) => a.id === accountId);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountId) return;
    const balanceNum = parseFloat(balance);
    if (isNaN(balanceNum)) {
      onError('Please enter a valid numeric balance amount');
      return;
    }

    setSaving(true);
    try {
      await recordAccountSnapshot(accountId, {
        account_id: accountId,
        balance: balanceNum,
        snapshot_date: snapshotDate,
        currency: selectedAccount?.currency || 'NZD',
        source: 'manual',
        notes: notes.trim() || undefined,
      });

      const updatedSnaps = await fetchAccountSnapshots(accountId, 12);
      onSnapshotSaved(accountId, updatedSnaps, selectedAccount?.name || 'account');
      onClose();
    } catch (err) {
      console.error(err);
      onError(err instanceof Error ? err.message : 'Failed to record balance snapshot');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        selectedAccount
          ? `Record Balance Valuation Snapshot: ${selectedAccount.name}`
          : 'Record Balance Valuation Snapshot'
      }
      footer={
        <div className="flex items-center justify-end space-x-2">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="record-snapshot-form" variant="amber" size="sm" loading={saving}>
            Confirm & Save Valuation
          </Button>
        </div>
      }
    >
      <form id="record-snapshot-form" onSubmit={handleSave} className="space-y-4 pt-1">
        <FormField label="Select Account">
          <SelectInput
            value={accountId ? String(accountId) : ''}
            onChange={(e) => {
              const nextId = parseInt(e.target.value, 10);
              setAccountId(nextId);
              setBalance(String(getAccountLatestBalance(nextId) || ''));
            }}
            variant="amber"
          >
            {accounts.map((acc) => (
              <option key={acc.id} value={acc.id}>
                {acc.name} ({acc.institution} • {acc.currency})
              </option>
            ))}
          </SelectInput>
        </FormField>

        <FormField label="Snapshot Date">
          <TextInput
            type="date"
            value={snapshotDate}
            onChange={(e) => setSnapshotDate(e.target.value)}
            variant="amber"
          />
        </FormField>

        <FormField label={`Closing Balance (${selectedAccount?.currency || 'NZD'})`} required>
          <TextInput
            type="number"
            step="any"
            value={balance}
            onChange={(e) => setBalance(e.target.value)}
            placeholder="0.00"
            variant="amber"
            className="font-mono"
            required
          />
        </FormField>

        <FormField label="Notes (Optional)">
          <TextInput
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Monthly statement reconciliation"
            variant="amber"
          />
        </FormField>
      </form>
    </Modal>
  );
};
