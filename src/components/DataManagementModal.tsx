import React, { useState } from 'react';
import {
  AlertTriangle,
  ArrowRightLeft,
  CheckCircle2,
  Database,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import { AlertBanner, Button, ConfirmActionBox, Modal } from '@yggdrasil-lab/ui';
import {
  resetDatabase,
  seedTestData,
  triggerReconcileTransfers,
} from '../services/api';

interface DataManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

/**
 * Modal for seeding baseline test data, reconciling multi-currency transfers,
 * and clearing the ledger with an inline confirmation guard.
 */
export const DataManagementModal: React.FC<DataManagementModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [showConfirmClear, setShowConfirmClear] = useState(false);
  const [clearAccounts, setClearAccounts] = useState(false);

  const handleSeed = async () => {
    setLoading(true);
    setError(null);
    setStatusMessage(null);
    try {
      const res = await seedTestData();
      setStatusMessage(res.message || 'Seeded realistic financial dataset successfully!');
      onSuccess();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to seed test data');
    } finally {
      setLoading(false);
    }
  };

  const handleClear = async () => {
    setLoading(true);
    setError(null);
    setStatusMessage(null);
    try {
      const res = await resetDatabase(clearAccounts);
      setStatusMessage(res.message || 'Ledger cleared! Ready for real data.');
      setShowConfirmClear(false);
      onSuccess();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to reset data');
    } finally {
      setLoading(false);
    }
  };

  const handleReconcileTransfers = async () => {
    setLoading(true);
    setError(null);
    setStatusMessage(null);
    try {
      const res = await triggerReconcileTransfers();
      setStatusMessage(
        res.matched_transfers > 0
          ? `Successfully reconciled and paired ${res.matched_transfers} transfer legs across accounts!`
          : 'Transfer scan complete. All inter-account transfers are currently reconciled.'
      );
      onSuccess();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to reconcile transfers');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Wealth Data Controls">
      <div className="space-y-4">
        {statusMessage && (
          <AlertBanner
            variant="success"
            icon={<CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />}
          >
            {statusMessage}
          </AlertBanner>
        )}

        {error && (
          <AlertBanner
            variant="error"
            icon={<AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />}
          >
            {error}
          </AlertBanner>
        )}

        {/* Option 1: Seed Test Baseline */}
        <div className="p-4 rounded-xl bg-card border border-border space-y-3">
          <div className="flex items-start space-x-3">
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 mt-0.5 shrink-0">
              <Database className="w-4 h-4" />
            </div>
            <div className="space-y-1">
              <h4 className="text-xs font-semibold text-slate-200">
                Seed Realistic Test Dataset
              </h4>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Populates test accounts (cash, growth, locked), a weekly budget target, and trailing transactions from Plutus so all metrics, HUD clocks, and scenario sliders are interactive.
              </p>
            </div>
          </div>

          <Button
            variant="amber"
            size="md"
            fullWidth
            loading={loading}
            loadingText="Populating..."
            icon={<RefreshCw className="w-3.5 h-3.5" />}
            onClick={handleSeed}
          >
            Seed Test Baseline
          </Button>
        </div>

        {/* Option 2: Reconcile Transfers & Multi-Currency FX */}
        <div className="p-4 rounded-xl bg-card border border-border space-y-3">
          <div className="flex items-start space-x-3">
            <div className="p-2 rounded-lg bg-sky-500/10 text-sky-400 mt-0.5 shrink-0">
              <ArrowRightLeft className="w-4 h-4" />
            </div>
            <div className="space-y-1">
              <h4 className="text-xs font-semibold text-slate-200">
                Reconcile Account Transfers & Multi-Currency FX
              </h4>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Scan all unlinked internal transfers, international remittances (e.g. DBS Singapore, Philippine banks), Bitcoin/crypto conversions, and multi-currency accounts, pairing counter-legs and tracking exchange rates and fees.
              </p>
            </div>
          </div>

          <Button
            variant="secondary"
            size="md"
            fullWidth
            loading={loading}
            loadingText="Reconciling Transfers..."
            icon={<ArrowRightLeft className="w-3.5 h-3.5 text-sky-400" />}
            onClick={handleReconcileTransfers}
          >
            Reconcile Transfers & FX
          </Button>
        </div>

        {/* Option 3: Clear Data (Fresh Slate) */}
        <div className="p-4 rounded-xl bg-card border border-border space-y-3">
          <div className="flex items-start space-x-3">
            <div className="p-2 rounded-lg bg-rose-500/10 text-rose-400 mt-0.5 shrink-0">
              <Trash2 className="w-4 h-4" />
            </div>
            <div className="space-y-1">
              <h4 className="text-xs font-semibold text-slate-200">
                Clear Data (Fresh Slate)
              </h4>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Wipe all transactions, asset snapshots, and budgets. Use this once you are satisfied with testing to start feeding your live statements and accounts.
              </p>
            </div>
          </div>

          {!showConfirmClear ? (
            <Button
              variant="danger"
              size="md"
              fullWidth
              icon={<Trash2 className="w-3.5 h-3.5 text-rose-400" />}
              onClick={() => setShowConfirmClear(true)}
            >
              Clear Ledger for Real Data
            </Button>
          ) : (
            <ConfirmActionBox
              variant="danger"
              title="Are you sure you want to clear all data?"
              description={
                <label className="flex items-center space-x-2 text-xs text-slate-300 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={clearAccounts}
                    onChange={(e) => setClearAccounts(e.target.checked)}
                    className="rounded border-border bg-background text-amber-500 focus:ring-0"
                  />
                  <span>Also remove account shells</span>
                </label>
              }
              confirmLabel="Confirm Clear"
              cancelLabel="Cancel"
              loading={loading}
              onCancel={() => setShowConfirmClear(false)}
              onConfirm={handleClear}
            />
          )}
        </div>
      </div>
    </Modal>
  );
};
