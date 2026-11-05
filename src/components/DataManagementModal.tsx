import React, { useState } from 'react';
import { Database, RefreshCw, Trash2, CheckCircle2, AlertTriangle, ShieldCheck } from 'lucide-react';
import { Modal } from '@yggdrasil-lab/ui';
import { resetDatabase, seedTestData } from '../services/api';

interface DataManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

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

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Wealth Data Controls">
      <div className="space-y-4">
        {statusMessage && (
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 rounded-xl text-xs flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>{statusMessage}</span>
          </div>
        )}

        {error && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-xl text-xs flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        {/* Option 1: Seed Test Baseline */}
        <div className="p-4 rounded-xl bg-card border border-border space-y-3">
          <div className="flex items-start space-x-3">
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 mt-0.5 shrink-0">
              <Database className="w-4 h-4" />
            </div>
            <div className="space-y-1">
              <h4 className="text-xs font-semibold text-slate-200">Seed Realistic Test Dataset</h4>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Populates test accounts (cash, growth, locked), a weekly budget target, and trailing transactions from Plutus so all metrics, HUD clocks, and scenario sliders are interactive.
              </p>
            </div>
          </div>

          <button
            onClick={handleSeed}
            disabled={loading}
            className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold text-xs rounded-xl flex items-center justify-center space-x-2 transition-all shadow"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>{loading ? 'Populating...' : 'Seed Test Baseline'}</span>
          </button>
        </div>

        {/* Option 2: Clear Data (Fresh Slate) */}
        <div className="p-4 rounded-xl bg-card border border-border space-y-3">
          <div className="flex items-start space-x-3">
            <div className="p-2 rounded-lg bg-rose-500/10 text-rose-400 mt-0.5 shrink-0">
              <Trash2 className="w-4 h-4" />
            </div>
            <div className="space-y-1">
              <h4 className="text-xs font-semibold text-slate-200">Clear Data (Fresh Slate)</h4>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Wipe all transactions, asset snapshots, and budgets. Use this once you are satisfied with
                testing to start feeding your live statements and accounts.
              </p>
            </div>
          </div>

          {!showConfirmClear ? (
            <button
              onClick={() => setShowConfirmClear(true)}
              disabled={loading}
              className="w-full py-2.5 bg-rose-950/40 hover:bg-rose-900/60 border border-rose-500/40 text-rose-200 font-semibold text-xs rounded-xl flex items-center justify-center space-x-2 transition-all"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-400" />
              <span>Clear Ledger for Real Data</span>
            </button>
          ) : (
            <div className="p-3 bg-rose-950/50 border border-rose-500/50 rounded-xl space-y-3">
              <div className="text-xs text-rose-200 font-medium">
                Are you sure you want to clear all data?
              </div>

              <label className="flex items-center space-x-2 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={clearAccounts}
                  onChange={(e) => setClearAccounts(e.target.checked)}
                  className="rounded border-border bg-background text-amber-500 focus:ring-0"
                />
                <span>Also remove account shells</span>
              </label>

              <div className="flex space-x-2">
                <button
                  onClick={() => setShowConfirmClear(false)}
                  className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={handleClear}
                  disabled={loading}
                  className="flex-1 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-lg shadow flex items-center justify-center space-x-1"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>{loading ? 'Clearing...' : 'Confirm Clear'}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};
