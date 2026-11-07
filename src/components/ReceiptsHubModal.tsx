import React, { useEffect, useState } from 'react';
import {
  Upload,
  RefreshCw,
  CheckCircle2,
  Clock,
  Calendar,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Modal, Button, AlertBanner } from '@yggdrasil-lab/ui';
import { ProductStatisticItem, Receipt } from '../types';
import {
  fetchReceipts,
  fetchProductStatistics,
  uploadReceipt,
  reconcileReceipts,
} from '../services/api';

interface ReceiptsHubModalProps {
  isOpen: boolean;
  onClose: () => void;
  onReceiptLinked?: () => void;
}

export const ReceiptsHubModal: React.FC<ReceiptsHubModalProps> = ({
  isOpen,
  onClose,
  onReceiptLinked,
}) => {
  const [activeTab, setActiveTab] = useState<'receipts' | 'products'>('receipts');
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [products, setProducts] = useState<ProductStatisticItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [reconciling, setReconciling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [expandedReceiptId, setExpandedReceiptId] = useState<number | null>(null);
  const [selectedDomain, setSelectedDomain] = useState<string>('all');

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [rList, pStats] = await Promise.all([
        fetchReceipts(),
        fetchProductStatistics(selectedDomain !== 'all' ? selectedDomain : undefined),
      ]);
      setReceipts(rList);
      setProducts(pStats.products);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to load receipts data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
    } else {
      setStatusMsg(null);
      setError(null);
    }
  }, [isOpen, selectedDomain]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);
    setStatusMsg(null);

    try {
      const res = await uploadReceipt(file);
      setStatusMsg(
        `Uploaded receipt from ${res.merchant} ($${res.total_amount.toFixed(2)}). Status: ${res.status}.`
      );
      await loadData();
      if (onReceiptLinked) onReceiptLinked();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to parse receipt');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleReconcile = async () => {
    setReconciling(true);
    setError(null);
    setStatusMsg(null);
    try {
      const res = await reconcileReceipts();
      setStatusMsg(`Reconciliation complete: matched ${res.matched_count} receipts with transactions.`);
      await loadData();
      if (onReceiptLinked) onReceiptLinked();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Reconciliation failed');
    } finally {
      setReconciling(false);
    }
  };

  const toggleExpand = (id: number) => {
    setExpandedReceiptId((prev) => (prev === id ? null : id));
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Receipts & Granular Product Hub"
    >
      <div className="space-y-4">
        {/* Navigation tabs */}
        <div className="flex items-center justify-between border-b border-border pb-2">
          <div className="flex items-center space-x-1 bg-card/60 p-1 rounded-xl border border-border">
            <button
              type="button"
              onClick={() => setActiveTab('receipts')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                activeTab === 'receipts'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Receipts Feed ({receipts.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('products')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                activeTab === 'products'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Product Longevity ({products.length})
            </button>
          </div>

          <Button
            variant="outline"
            size="xs"
            icon={<RefreshCw className={`w-3 h-3 text-amber-400 ${reconciling ? 'animate-spin' : ''}`} />}
            onClick={handleReconcile}
            disabled={reconciling}
            title="Auto-match unlinked receipts with bank transactions"
          >
            Reconcile
          </Button>
        </div>

        {error && <AlertBanner variant="error">{error}</AlertBanner>}
        {statusMsg && (
          <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-xs text-emerald-300 flex items-center space-x-2 animate-in fade-in">
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
            <span>{statusMsg}</span>
          </div>
        )}

        {/* Tab 1: Receipts List & Upload Dropzone */}
        {activeTab === 'receipts' && (
          <div className="space-y-3.5">
            {/* Upload Box */}
            <div className="p-3.5 bg-card/40 border border-dashed border-amber-500/30 hover:border-amber-500/60 rounded-xl text-center transition-colors">
              <input
                type="file"
                id="receipt_upload_input"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={handleFileUpload}
                disabled={uploading}
              />
              <label
                htmlFor="receipt_upload_input"
                className="cursor-pointer flex flex-col items-center justify-center space-y-1.5"
              >
                <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
                  {uploading ? (
                    <RefreshCw className="w-5 h-5 animate-spin" />
                  ) : (
                    <Upload className="w-5 h-5" />
                  )}
                </div>
                <div className="text-xs font-medium text-slate-200">
                  {uploading ? 'Parsing receipt with Jev Vision...' : 'Drop receipt photo or PDF here'}
                </div>
                <p className="text-[11px] text-slate-400">
                  Extracts merchant, items, volume, and matches credit card statements
                </p>
              </label>
            </div>

            {/* Receipts List */}
            {loading && !receipts.length ? (
              <div className="py-8 flex flex-col items-center justify-center space-y-2 text-slate-400 text-xs">
                <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
                <span>Loading receipts...</span>
              </div>
            ) : receipts.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400 bg-card/30 rounded-xl border border-border/50">
                No receipts recorded yet. Upload a photo or PDF to parse granular line items.
              </div>
            ) : (
              <div className="space-y-2 max-h-[45vh] overflow-y-auto pr-1">
                {receipts.map((r) => {
                  const isExpanded = expandedReceiptId === r.id;
                  const isMatched = r.status === 'matched' || r.status === 'verified';

                  return (
                    <div
                      key={r.id}
                      className="p-3 bg-card/60 hover:bg-card/80 border border-border rounded-xl transition-all"
                    >
                      <div
                        className="flex items-center justify-between cursor-pointer"
                        onClick={() => toggleExpand(r.id)}
                        role="button"
                        tabIndex={0}
                        data-testid={`receipt-row-${r.id}`}
                      >
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center space-x-2">
                            <span className="text-[11px] font-mono text-slate-400">{r.receipt_date}</span>
                            <span
                              className={`text-[10px] px-1.5 py-0.5 rounded font-medium border ${
                                isMatched
                                  ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                                  : 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                              }`}
                            >
                              {isMatched ? 'Matched to Ledger' : 'Unlinked'}
                            </span>
                            {r.items && r.items.length > 0 && (
                              <span className="text-[10px] text-slate-400">
                                ({r.items.length} {r.items.length === 1 ? 'item' : 'items'})
                              </span>
                            )}
                          </div>
                          <div className="text-xs font-semibold text-slate-200 truncate">{r.merchant}</div>
                        </div>

                        <div className="flex items-center space-x-3 shrink-0">
                          <span className="text-xs font-bold font-mono text-slate-100">
                            ${Number(r.total_amount).toFixed(2)}
                          </span>
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4 text-slate-400" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-slate-400" />
                          )}
                        </div>
                      </div>

                      {/* Expandable itemized line items */}
                      {isExpanded && r.items && (
                        <div className="mt-3 pt-3 border-t border-border/60 space-y-2 animate-in fade-in">
                          <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                            Itemized Breakdown
                          </div>
                          <div className="space-y-1.5">
                            {r.items.map((item) => (
                              <div
                                key={item.id}
                                className="p-2 bg-background/60 rounded-lg border border-border/50 flex items-center justify-between text-xs"
                              >
                                <div className="space-y-0.5 min-w-0 pr-2">
                                  <div className="font-medium text-slate-200 truncate">{item.item_name}</div>
                                  <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-slate-400">
                                    {item.brand && <span className="font-semibold text-slate-300">{item.brand}</span>}
                                    {item.volume_ml && (
                                      <span className="px-1 rounded bg-slate-800 text-slate-300">
                                        {item.volume_ml}
                                      </span>
                                    )}
                                    {item.domain && (
                                      <span className="px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20">
                                        {item.domain === '02-skin' ? '✨ Skin' : item.domain === '01-health' ? '💪 Health' : item.domain}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div className="text-right shrink-0">
                                  <div className="font-mono font-medium text-slate-100">
                                    ${Number(item.total_price).toFixed(2)}
                                  </div>
                                  {item.quantity > 1 && (
                                    <div className="text-[10px] text-slate-400">
                                      {item.quantity}x @ ${Number(item.unit_price).toFixed(2)}
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Product Longevity & Statistics */}
        {activeTab === 'products' && (
          <div className="space-y-3">
            {/* Domain Filter Buttons */}
            <div className="flex items-center space-x-1.5">
              {['all', '02-skin', '01-health', '20-home'].map((dom) => (
                <button
                  key={dom}
                  type="button"
                  onClick={() => setSelectedDomain(dom)}
                  className={`px-2.5 py-1 text-xs rounded-lg transition-colors ${
                    selectedDomain === dom
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 font-medium'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {dom === 'all'
                    ? 'All Domains'
                    : dom === '02-skin'
                    ? '✨ Skincare'
                    : dom === '01-health'
                    ? '💪 Health'
                    : '🏠 Home'}
                </button>
              ))}
            </div>

            {loading ? (
              <div className="py-8 flex flex-col items-center justify-center space-y-2 text-slate-400 text-xs">
                <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
                <span>Computing product purchase frequencies...</span>
              </div>
            ) : products.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400 bg-card/30 rounded-xl border border-border/50">
                No product statistics available yet for this domain. Upload receipts to build purchase frequency models.
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[50vh] overflow-y-auto pr-1">
                {products.map((p, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-card/60 hover:bg-card/80 border border-border rounded-xl space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-xs font-semibold text-slate-100">{p.item_name}</div>
                        <div className="flex items-center space-x-2 text-[10px] text-slate-400 mt-0.5">
                          {p.brand && <span>{p.brand}</span>}
                          {p.volume_ml && <span>• {p.volume_ml}</span>}
                          <span>• {p.purchase_count} {p.purchase_count === 1 ? 'purchase' : 'purchases'}</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-xs font-bold font-mono text-amber-400">
                          ${p.total_spent.toFixed(2)}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          Latest: ${p.unit_price_latest.toFixed(2)}
                        </div>
                      </div>
                    </div>

                    {/* Longevity & Depletion Card */}
                    <div className="p-2 bg-background/80 rounded-lg border border-border/60 flex flex-col sm:flex-row sm:items-center justify-between text-[11px] gap-2">
                      <div className="flex items-center space-x-1.5 text-slate-300">
                        <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span>
                          {p.avg_days_between_purchases
                            ? `Usage Longevity: ~${p.avg_days_between_purchases} days per bottle`
                            : `First recorded: ${p.first_purchased}`}
                        </span>
                      </div>

                      {p.estimated_depletion_date && (
                        <div className="flex items-center space-x-1.5 text-emerald-300 font-medium">
                          <Calendar className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          <span>Est. Restock: {p.estimated_depletion_date}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="pt-2 flex justify-end">
          <Button variant="outline" size="sm" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </Modal>
  );
};
