import React, { useState } from 'react';
import {
  AlertTriangle,
  ArrowRightLeft,
  CheckCircle2,
} from 'lucide-react';
import { AlertBanner, Button, Modal } from '@yggdrasil-lab/ui';
import { triggerReconcileTransfers } from '../transport';

interface DataManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

/**
 * Modal for scanning and reconciling multi-currency transfers and FX counter-legs.
 */
export const DataManagementModal: React.FC<DataManagementModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

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
    <Modal isOpen={isOpen} onClose={onClose} title="Transfer & FX Reconciliation">
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

        <div className="p-4 rounded-xl bg-card border border-border space-y-3">
          <div className="flex items-start space-x-3">
            <div className="p-2 rounded-lg bg-sky-500/10 text-sky-400 mt-0.5 shrink-0">
              <ArrowRightLeft className="w-4 h-4" />
            </div>
            <div className="space-y-1">
              <h4 className="text-xs font-semibold text-slate-200">
                Reconcile Account Transfers &amp; Multi-Currency FX
              </h4>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Scan all unlinked internal transfers, international remittances (e.g. DBS Singapore, Philippine banks), Bitcoin conversions, and multi-currency accounts, pairing counter-legs and tracking exchange rates and fees.
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
            Reconcile Transfers &amp; FX
          </Button>
        </div>
      </div>
    </Modal>
  );
};
