import React, { useEffect, useState } from 'react';
import { CheckCircle2, RefreshCw } from 'lucide-react';
import { AlertBanner, Button, Modal, SegmentedControl } from '@yggdrasil-lab/ui';
import {
  deleteReceipt,
  fetchProducts,
  fetchReceipts,
  reconcileReceipts,
  reprocessReceipt,
  updateProduct,
  updateReceiptItem,
  uploadReceipt,
} from '../services/api';
import { Product, Receipt } from '../types';
import {
  formatReceiptAmount,
  isReceiptPending,
  type ReceiptFeedFilter,
} from '../utils/receipts';
import { ProductsCatalogTab } from './receipts/ProductsCatalogTab';
import { ReceiptsFeedTab } from './receipts/ReceiptsFeedTab';

interface ReceiptsHubModalProps {
  isOpen: boolean;
  onClose: () => void;
  onReceiptLinked?: () => void;
}

type ReceiptsTab = 'receipts' | 'products';

/**
 * Receipts OCR ingestion, reconciliation, and product longevity catalog modal.
 */
export const ReceiptsHubModal: React.FC<ReceiptsHubModalProps> = ({
  isOpen,
  onClose,
  onReceiptLinked,
}) => {
  const [activeTab, setActiveTab] = useState<ReceiptsTab>('receipts');
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [reconciling, setReconciling] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [reprocessingId, setReprocessingId] = useState<number | null>(null);
  const [updatingItemId, setUpdatingItemId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [expandedReceiptId, setExpandedReceiptId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<ReceiptFeedFilter>('all');

  const [selectedDomain, setSelectedDomain] = useState('all');
  const [selectedTag, setSelectedTag] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterFavorites, setFilterFavorites] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [rList, pResponse] = await Promise.all([
        fetchReceipts(),
        fetchProducts({
          domain: selectedDomain !== 'all' ? selectedDomain : undefined,
          tag: selectedTag !== 'all' ? selectedTag : undefined,
          search: searchQuery.trim() || undefined,
          is_favorite: filterFavorites ? true : undefined,
        }),
      ]);
      setReceipts(rList);
      setProducts(pResponse.products);
      setAllTags(pResponse.all_tags);
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
      setStatusFilter('all');
    }
  }, [isOpen, selectedDomain, selectedTag, filterFavorites]);

  const handleUploadFile = async (file: File) => {
    setUploading(true);
    setError(null);
    setStatusMsg(null);
    try {
      const res = await uploadReceipt(file);
      const formattedTotal = formatReceiptAmount(res.total_amount, res.currency);
      setStatusMsg(
        res.is_processed === false
          ? `Saved original receipt "${res.merchant}" for later processing or manual linking.`
          : `Uploaded receipt from ${res.merchant} (${formattedTotal}). Status: ${res.status}.`
      );
      await loadData();
      onReceiptLinked?.();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to parse receipt');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteReceipt = async (id: number) => {
    setDeletingId(id);
    setError(null);
    setStatusMsg(null);
    try {
      await deleteReceipt(id);
      if (expandedReceiptId === id) {
        setExpandedReceiptId(null);
      }
      setStatusMsg('Receipt deleted.');
      await loadData();
      onReceiptLinked?.();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to delete receipt');
    } finally {
      setDeletingId(null);
    }
  };

  const handleReprocessReceipt = async (id: number) => {
    setReprocessingId(id);
    setError(null);
    setStatusMsg(null);
    try {
      const res = await reprocessReceipt(id);
      const formattedTotal = formatReceiptAmount(res.total_amount, res.currency);
      setStatusMsg(`Processed receipt from ${res.merchant} (${formattedTotal}).`);
      await loadData();
      onReceiptLinked?.();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to reprocess receipt');
    } finally {
      setReprocessingId(null);
    }
  };

  const handleUpdateReceiptItem = async (
    receiptId: number,
    itemId: number,
    patch: { category?: string; tags?: string[] }
  ) => {
    setUpdatingItemId(itemId);
    setError(null);
    try {
      const updated = await updateReceiptItem(receiptId, itemId, patch);
      setReceipts((prev) =>
        prev.map((r) =>
          r.id === receiptId
            ? { ...r, items: r.items.map((it) => (it.id === itemId ? updated : it)) }
            : r
        )
      );
      onReceiptLinked?.();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to update receipt item');
    } finally {
      setUpdatingItemId(null);
    }
  };

  const handleCandidateLinked = async (updated: Receipt) => {
    setReceipts((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    setStatusMsg(
      `Linked "${updated.merchant}" to transaction #${updated.transaction_id}.`
    );
    await loadData();
    onReceiptLinked?.();
  };

  const needsReviewCount = receipts.filter((r) => r.status === 'needs_review').length;
  const pendingCount = receipts.filter((r) => isReceiptPending(r)).length;

  const handleReconcile = async () => {
    setReconciling(true);
    setError(null);
    setStatusMsg(null);
    try {
      const res = await reconcileReceipts();
      setStatusMsg(
        `Reconciliation complete: matched ${res.matched_count} receipts with transactions.`
      );
      await loadData();
      onReceiptLinked?.();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Reconciliation failed');
    } finally {
      setReconciling(false);
    }
  };

  const handleToggleFavorite = async (product: Product) => {
    try {
      const updated = await updateProduct(product.id, { is_favorite: !product.is_favorite });
      setProducts((prev) => prev.map((item) => (item.id === product.id ? updated : item)));
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to update favorite');
    }
  };

  const handleSaveNote = async (productId: number, note: string) => {
    try {
      const updated = await updateProduct(productId, { notes: note });
      setProducts((prev) => prev.map((item) => (item.id === productId ? updated : item)));
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to save note');
      throw err;
    }
  };

  const handleAddTag = async (productId: number, rawTag: string) => {
    const cleanTag = rawTag.trim().toLowerCase().replace(/^#/, '');
    const prod = products.find((p) => p.id === productId);
    if (!cleanTag || !prod || prod.tags.includes(cleanTag)) return;

    try {
      const updated = await updateProduct(productId, { tags: [...prod.tags, cleanTag] });
      setProducts((prev) => prev.map((item) => (item.id === productId ? updated : item)));
      if (!allTags.includes(cleanTag)) {
        setAllTags((prev) => [...prev, cleanTag].sort());
      }
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to add tag');
    }
  };

  const handleRemoveTag = async (productId: number, tagToRemove: string) => {
    const prod = products.find((p) => p.id === productId);
    if (!prod) return;
    try {
      const updated = await updateProduct(productId, {
        tags: prod.tags.filter((t) => t !== tagToRemove),
      });
      setProducts((prev) => prev.map((item) => (item.id === productId ? updated : item)));
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to remove tag');
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Receipts & Product Inventory Hub">
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-2 gap-2 flex-wrap">
          <SegmentedControl<ReceiptsTab>
            options={[
              { id: 'receipts', label: 'Receipts Feed', badge: receipts.length },
              { id: 'products', label: 'Products & Price History', badge: products.length },
            ]}
            value={activeTab}
            onChange={setActiveTab}
            variant="amber"
            size="sm"
            idPrefix="receipts-hub-tab"
          />

          <div className="flex items-center gap-2 flex-wrap">
            {needsReviewCount > 0 ? (
              <button
                type="button"
                data-testid="receipts-hub-needs-review-badge"
                onClick={() => {
                  setActiveTab('receipts');
                  setStatusFilter('needs_review');
                }}
                className="px-2 py-1 text-[11px] font-semibold rounded-lg bg-amber-500/15 text-amber-300 border border-amber-500/30 hover:bg-amber-500/25 transition-colors whitespace-nowrap"
              >
                {needsReviewCount} Needs Review
              </button>
            ) : pendingCount > 0 ? (
              <button
                type="button"
                data-testid="receipts-hub-pending-badge"
                onClick={() => {
                  setActiveTab('receipts');
                  setStatusFilter('pending');
                }}
                className="px-2 py-1 text-[11px] font-medium rounded-lg bg-slate-800/80 text-slate-300 border border-border hover:text-white transition-colors whitespace-nowrap"
              >
                {pendingCount} Pending
              </button>
            ) : null}

            <Button
              variant="outline"
              size="xs"
              icon={
                <RefreshCw
                  className={`w-3 h-3 text-amber-400 ${reconciling ? 'animate-spin' : ''}`}
                />
              }
              onClick={handleReconcile}
              disabled={reconciling}
              title="Auto-match unlinked receipts with bank transactions"
            >
              Reconcile
            </Button>
          </div>
        </div>

        {error && <AlertBanner variant="error">{error}</AlertBanner>}
        {statusMsg && (
          <div
            data-testid="receipts-hub-status-banner"
            className="p-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-xs text-emerald-300 flex items-center space-x-2 animate-in fade-in"
          >
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
            <span>{statusMsg}</span>
          </div>
        )}

        {activeTab === 'receipts' ? (
          <ReceiptsFeedTab
            receipts={receipts}
            loading={loading}
            uploading={uploading}
            deletingId={deletingId}
            reprocessingId={reprocessingId}
            updatingItemId={updatingItemId}
            expandedReceiptId={expandedReceiptId}
            statusFilter={statusFilter}
            onChangeStatusFilter={setStatusFilter}
            onToggleExpand={(id) =>
              setExpandedReceiptId((prev) => (prev === id ? null : id))
            }
            onUploadFile={handleUploadFile}
            onDeleteReceipt={handleDeleteReceipt}
            onReprocessReceipt={handleReprocessReceipt}
            onReceiptLinked={handleCandidateLinked}
            onUpdateReceiptItem={handleUpdateReceiptItem}
          />
        ) : (
          <ProductsCatalogTab
            products={products}
            allTags={allTags}
            loading={loading}
            selectedDomain={selectedDomain}
            selectedTag={selectedTag}
            searchQuery={searchQuery}
            filterFavorites={filterFavorites}
            onChangeDomain={setSelectedDomain}
            onChangeTag={setSelectedTag}
            onChangeSearch={setSearchQuery}
            onToggleFavorites={() => setFilterFavorites((prev) => !prev)}
            onSearchSubmit={(e) => {
              e.preventDefault();
              void loadData();
            }}
            onToggleFavorite={handleToggleFavorite}
            onSaveNote={handleSaveNote}
            onAddTag={handleAddTag}
            onRemoveTag={handleRemoveTag}
          />
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
