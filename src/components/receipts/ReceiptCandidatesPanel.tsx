import React, { useEffect, useState } from 'react';
import { Link2 } from 'lucide-react';
import { AlertBanner, Button, LoadingState, StatusBadge } from '@yggdrasil-lab/ui';
import { getReceiptCandidates, linkReceipt } from '../../services/api';
import { Receipt, ReceiptTransactionCandidate } from '../../types';
import {
  formatCandidateLedgerAmount,
  formatConfidencePercent,
  formatReceiptAmount,
} from '../../utils/receipts';

interface ReceiptCandidatesPanelProps {
  receipt: Receipt;
  onLinked?: (updatedReceipt: Receipt) => void | Promise<void>;
}

/**
 * Lazily fetches candidate bank transactions for an unlinked or needs_review receipt
 * and provides a 1-tap mobile-friendly Link action with inline error and loading states.
 */
export const ReceiptCandidatesPanel: React.FC<ReceiptCandidatesPanelProps> = ({
  receipt,
  onLinked,
}) => {
  const [candidates, setCandidates] = useState<ReceiptTransactionCandidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [linkingTxId, setLinkingTxId] = useState<number | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const isNeedsReview = receipt.status === 'needs_review';
  const canLink = receipt.transaction_id == null;

  useEffect(() => {
    if (!canLink) {
      setCandidates([]);
      setLoadError(null);
      return;
    }

    let active = true;
    setLoading(true);
    setLoadError(null);

    getReceiptCandidates(receipt.id)
      .then((rows) => {
        if (active) {
          setCandidates(rows);
        }
      })
      .catch((err) => {
        console.error(err);
        if (active) {
          setLoadError(
            err instanceof Error ? err.message : 'Failed to load suggested matches'
          );
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [receipt.id, canLink, reloadKey]);

  if (!canLink) {
    return null;
  }

  const handleLink = async (transactionId: number) => {
    setLinkingTxId(transactionId);
    setLinkError(null);
    try {
      const updated = await linkReceipt(receipt.id, transactionId);
      await onLinked?.(updated);
    } catch (err) {
      console.error(err);
      setLinkError(
        err instanceof Error ? err.message : 'Failed to link receipt to transaction'
      );
    } finally {
      setLinkingTxId(null);
    }
  };

  return (
    <div
      data-testid={`receipt-candidates-panel-${receipt.id}`}
      className={`rounded-xl border p-3 space-y-2.5 ${
        isNeedsReview
          ? 'bg-amber-500/5 border-amber-500/25'
          : 'bg-background/50 border-border/70'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <Link2
            className={`w-3.5 h-3.5 shrink-0 ${
              isNeedsReview ? 'text-amber-400' : 'text-slate-400'
            }`}
          />
          <span
            className={`text-[11px] font-semibold uppercase tracking-wider truncate ${
              isNeedsReview ? 'text-amber-300' : 'text-slate-300'
            }`}
          >
            Suggested Matches
          </span>
        </div>

        {!loading && !loadError && candidates.length > 0 && (
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-slate-800/90 text-slate-300 border border-border/60 shrink-0">
            {candidates.length} {candidates.length === 1 ? 'candidate' : 'candidates'}
          </span>
        )}
      </div>

      {linkError && <AlertBanner variant="error">{linkError}</AlertBanner>}

      {loading ? (
        <LoadingState label="Finding suggested matches..." variant="brand" />
      ) : loadError ? (
        <AlertBanner
          variant="error"
          action={
            <Button
              variant="outline"
              size="xs"
              onClick={() => setReloadKey((k) => k + 1)}
              className="shrink-0"
            >
              Retry
            </Button>
          }
        >
          {loadError}
        </AlertBanner>
      ) : candidates.length === 0 ? (
        <div className="text-[11px] text-slate-400 px-2.5 py-2 rounded-lg border border-dashed border-border/60 bg-background/40">
          No matching ledger transactions found yet.
        </div>
      ) : (
        <div className="space-y-2">
          {candidates.map((c) => {
            const normalizedConf = c.confidence <= 1 ? c.confidence : c.confidence / 100;
            const confidenceVariant =
              normalizedConf >= 0.85
                ? 'success'
                : normalizedConf >= 0.65
                  ? 'info'
                  : 'warning';
            const displayMerchant = c.merchant || c.raw_description || 'Bank Transaction';
            const showRawDesc = Boolean(
              c.merchant && c.raw_description && c.raw_description !== c.merchant
            );
            const hasOriginalFx = c.original_amount != null && Boolean(c.original_currency);
            const hasEstimatedFx = !hasOriginalFx && c.estimated_receipt_amount != null;

            return (
              <div
                key={c.transaction_id}
                data-testid={`receipt-candidate-${receipt.id}-${c.transaction_id}`}
                className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 p-2.5 rounded-lg bg-card/80 border border-border/70"
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] font-mono text-slate-400 whitespace-nowrap shrink-0">
                      {c.transaction_date}
                    </span>
                    <StatusBadge
                      label={`${formatConfidencePercent(c.confidence)} match`}
                      variant={confidenceVariant}
                      className="px-1.5 py-0.5 text-[10px] shrink-0"
                    />
                    {c.account_name && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800/90 text-slate-300 border border-slate-700/60 truncate max-w-[170px]">
                        {c.account_name}
                      </span>
                    )}
                  </div>

                  <div className="text-xs font-semibold text-slate-100 truncate">
                    {displayMerchant}
                  </div>

                  {showRawDesc && (
                    <div className="text-[10px] text-slate-400 font-mono truncate">
                      {c.raw_description}
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px]">
                    <span className="font-mono font-semibold text-slate-100 whitespace-nowrap">
                      {formatCandidateLedgerAmount(c.amount, c.currency)}
                    </span>
                    {hasOriginalFx && (
                      <span className="text-[10px] font-mono text-sky-300 whitespace-nowrap">
                        Orig.{' '}
                        {formatReceiptAmount(
                          Math.abs(Number(c.original_amount)),
                          c.original_currency
                        )}
                      </span>
                    )}
                    {hasEstimatedFx && (
                      <span className="text-[10px] font-mono text-amber-300 whitespace-nowrap">
                        Est.{' '}
                        {formatReceiptAmount(
                          Math.abs(Number(c.estimated_receipt_amount)),
                          receipt.currency
                        )}
                      </span>
                    )}
                  </div>

                  {c.match_reason && (
                    <div className="text-[10px] text-slate-400 leading-snug">
                      {c.match_reason}
                    </div>
                  )}
                </div>

                <Button
                  variant="brand"
                  size="sm"
                  icon={<Link2 className="w-3.5 h-3.5" />}
                  loading={linkingTxId === c.transaction_id}
                  loadingText="Linking..."
                  disabled={linkingTxId !== null}
                  onClick={() => void handleLink(c.transaction_id)}
                  data-testid={`link-receipt-candidate-${receipt.id}-${c.transaction_id}`}
                  className="min-h-[44px] w-full sm:w-auto shrink-0"
                >
                  Link
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
