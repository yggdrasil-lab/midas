import React, { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
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
import { formatReceiptAmount, isReceiptPending, type ReceiptFeedFilter } from '../utils/receipts';
import { ProductsCatalogTab } from './receipts/ProductsCatalogTab';
import { ReceiptsFeedTab } from './receipts/ReceiptsFeedTab';

interface ReceiptsHubModalProps {
  isOpen: boolean;
  onClose: () => void;
  onReceiptLinked?: () => void;
}

type ReceiptsTab = 'receipts' | 'products';

function useReceiptFeedMutations(opts: {
  expandedReceiptId: number | null;
  loadData: () => Promise<void>;
  onReceiptLinked?: () => void;
  setters: {
    setExpandedReceiptId: (id: number | null) => void;
    setUploading: (v: boolean) => void;
    setDeletingId: (v: number | null) => void;
    setReprocessingId: (v: number | null) => void;
    setReconciling: (v: boolean) => void;
    setError: (v: string | null) => void;
    setStatusMsg: (v: string | null) => void;
  };
}) {
  const { setters } = opts;

  const handleUploadFile = async (file: File) => {
    setters.setUploading(true); setters.setError(null); setters.setStatusMsg(null);
    try {
      const res = await uploadReceipt(file);
      setters.setStatusMsg(
        res.is_processed === false
          ? `Saved original receipt "${res.merchant}" for later processing or manual linking.`
          : `Uploaded receipt from ${res.merchant} (${formatReceiptAmount(res.total_amount, res.currency)}). Status: ${res.status}.`
      );
      await opts.loadData(); opts.onReceiptLinked?.();
    } catch (err) { setters.setError(err instanceof Error ? err.message : 'Failed to parse receipt'); }
    finally { setters.setUploading(false); }
  };

  const handleDeleteReceipt = async (id: number) => {
    setters.setDeletingId(id); setters.setError(null); setters.setStatusMsg(null);
    try {
      await deleteReceipt(id);
      if (opts.expandedReceiptId === id) setters.setExpandedReceiptId(null);
      setters.setStatusMsg('Receipt deleted.');
      await opts.loadData(); opts.onReceiptLinked?.();
    } catch (err) { setters.setError(err instanceof Error ? err.message : 'Failed to delete receipt'); }
    finally { setters.setDeletingId(null); }
  };

  const handleReprocessReceipt = async (id: number) => {
    setters.setReprocessingId(id); setters.setError(null); setters.setStatusMsg(null);
    try {
      const res = await reprocessReceipt(id);
      setters.setStatusMsg(`Processed receipt from ${res.merchant} (${formatReceiptAmount(res.total_amount, res.currency)}).`);
      await opts.loadData(); opts.onReceiptLinked?.();
    } catch (err) { setters.setError(err instanceof Error ? err.message : 'Failed to reprocess receipt'); }
    finally { setters.setReprocessingId(null); }
  };

  const handleReconcile = async () => {
    setters.setReconciling(true); setters.setError(null); setters.setStatusMsg(null);
    try {
      const res = await reconcileReceipts();
      setters.setStatusMsg(`Reconciliation complete: matched ${res.matched_count} receipts with transactions.`);
      await opts.loadData(); opts.onReceiptLinked?.();
    } catch (err) { setters.setError(err instanceof Error ? err.message : 'Reconciliation failed'); }
    finally { setters.setReconciling(false); }
  };

  return { handleUploadFile, handleDeleteReceipt, handleReprocessReceipt, handleReconcile };
}

function useReceiptActions(opts: {
  expandedReceiptId: number | null;
  loadData: () => Promise<void>;
  onReceiptLinked?: () => void;
  setters: {
    setReceipts: React.Dispatch<React.SetStateAction<Receipt[]>>;
    setExpandedReceiptId: (id: number | null) => void;
    setUploading: (v: boolean) => void;
    setDeletingId: (v: number | null) => void;
    setReprocessingId: (v: number | null) => void;
    setUpdatingItemId: (v: number | null) => void;
    setReconciling: (v: boolean) => void;
    setError: (v: string | null) => void;
    setStatusMsg: (v: string | null) => void;
  };
}) {
  const { setters } = opts;
  const feedMutations = useReceiptFeedMutations({ expandedReceiptId: opts.expandedReceiptId, loadData: opts.loadData, onReceiptLinked: opts.onReceiptLinked, setters });

  const handleUpdateReceiptItem = async (receiptId: number, itemId: number, patch: { category?: string; tags?: string[] }) => {
    setters.setUpdatingItemId(itemId); setters.setError(null);
    try {
      const updated = await updateReceiptItem(receiptId, itemId, patch);
      setters.setReceipts((prev) => prev.map((r) => (r.id === receiptId ? { ...r, items: r.items.map((it) => (it.id === itemId ? updated : it)) } : r)));
      opts.onReceiptLinked?.();
    } catch (err) { setters.setError(err instanceof Error ? err.message : 'Failed to update receipt item'); }
    finally { setters.setUpdatingItemId(null); }
  };

  const handleCandidateLinked = async (updated: Receipt) => {
    setters.setReceipts((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    setters.setStatusMsg(`Linked "${updated.merchant}" to transaction #${updated.transaction_id}.`);
    await opts.loadData(); opts.onReceiptLinked?.();
  };

  return { ...feedMutations, handleUpdateReceiptItem, handleCandidateLinked };
}

function useProductActions(opts: {
  products: Product[];
  allTags: string[];
  setProducts: React.Dispatch<React.SetStateAction<Product[]>>;
  setAllTags: React.Dispatch<React.SetStateAction<string[]>>;
  setError: (v: string | null) => void;
}) {
  const handleToggleFavorite = async (product: Product) => {
    try {
      const updated = await updateProduct(product.id, { is_favorite: !product.is_favorite });
      opts.setProducts((prev) => prev.map((item) => (item.id === product.id ? updated : item)));
    } catch (err) { opts.setError(err instanceof Error ? err.message : 'Failed to update favorite'); }
  };

  const handleSaveNote = async (productId: number, note: string) => {
    try {
      const updated = await updateProduct(productId, { notes: note });
      opts.setProducts((prev) => prev.map((item) => (item.id === productId ? updated : item)));
    } catch (err) {
      opts.setError(err instanceof Error ? err.message : 'Failed to save note');
      throw err;
    }
  };

  const handleAddTag = async (productId: number, rawTag: string) => {
    const cleanTag = rawTag.trim().toLowerCase().replace(/^#/, '');
    const prod = opts.products.find((p) => p.id === productId);
    if (!cleanTag || !prod || prod.tags.includes(cleanTag)) return;
    try {
      const updated = await updateProduct(productId, { tags: [...prod.tags, cleanTag] });
      opts.setProducts((prev) => prev.map((item) => (item.id === productId ? updated : item)));
      if (!opts.allTags.includes(cleanTag)) opts.setAllTags((prev) => [...prev, cleanTag].sort());
    } catch (err) { opts.setError(err instanceof Error ? err.message : 'Failed to add tag'); }
  };

  const handleRemoveTag = async (productId: number, tagToRemove: string) => {
    const prod = opts.products.find((p) => p.id === productId);
    if (!prod) return;
    try {
      const updated = await updateProduct(productId, { tags: prod.tags.filter((t) => t !== tagToRemove) });
      opts.setProducts((prev) => prev.map((item) => (item.id === productId ? updated : item)));
    } catch (err) { opts.setError(err instanceof Error ? err.message : 'Failed to remove tag'); }
  };

  return { handleToggleFavorite, handleSaveNote, handleAddTag, handleRemoveTag };
}

function useReceiptsHubState(isOpen: boolean, onReceiptLinked?: () => void) {
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
        fetchProducts({ domain: selectedDomain !== 'all' ? selectedDomain : undefined, tag: selectedTag !== 'all' ? selectedTag : undefined, search: searchQuery.trim() || undefined, is_favorite: filterFavorites ? true : undefined }),
      ]);
      setReceipts(rList); setProducts(pResponse.products); setAllTags(pResponse.all_tags);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load receipts data');
    } finally { setLoading(false); }
  };

  useEffect(() => {
    if (isOpen) { void loadData(); return; }
    setStatusMsg(null); setError(null); setStatusFilter('all');
  }, [isOpen, selectedDomain, selectedTag, filterFavorites]);

  const receiptActions = useReceiptActions({
    expandedReceiptId, loadData, onReceiptLinked,
    setters: { setReceipts, setExpandedReceiptId, setUploading, setDeletingId, setReprocessingId, setUpdatingItemId, setReconciling, setError, setStatusMsg },
  });
  const productActions = useProductActions({ products, allTags, setProducts, setAllTags, setError });

  return {
    activeTab, setActiveTab, receipts, products, allTags, loading, uploading, reconciling,
    deletingId, reprocessingId, updatingItemId, error, statusMsg, expandedReceiptId, setExpandedReceiptId,
    statusFilter, setStatusFilter, selectedDomain, setSelectedDomain, selectedTag, setSelectedTag,
    searchQuery, setSearchQuery, filterFavorites, setFilterFavorites, loadData, ...receiptActions, ...productActions,
  };
}

const ReceiptsHubHeaderBar: React.FC<{
  activeTab: ReceiptsTab;
  receiptCount: number;
  productCount: number;
  needsReviewCount: number;
  pendingCount: number;
  reconciling: boolean;
  onChangeTab: (tab: ReceiptsTab) => void;
  onFilterNeedsReview: () => void;
  onFilterPending: () => void;
  onReconcile: () => void;
}> = ({ activeTab, receiptCount, productCount, needsReviewCount, pendingCount, reconciling, onChangeTab, onFilterNeedsReview, onFilterPending, onReconcile }) => (
  <div className="flex items-center justify-between border-b border-border pb-2 gap-2 flex-wrap">
    <SegmentedControl<ReceiptsTab>
      options={[{ id: 'receipts', label: 'Receipts Feed', badge: receiptCount }, { id: 'products', label: 'Products & Price History', badge: productCount }]}
      value={activeTab} onChange={onChangeTab} variant="brand" size="sm" idPrefix="receipts-hub-tab"
    />
    <div className="flex items-center gap-2 flex-wrap">
      {needsReviewCount > 0 ? (
        <button type="button" data-testid="receipts-hub-needs-review-badge" onClick={onFilterNeedsReview} className="px-2 py-1 text-[11px] font-semibold rounded-lg bg-amber-500/15 text-amber-300 border border-amber-500/30 hover:bg-amber-500/25 transition-colors whitespace-nowrap">
          {needsReviewCount} Needs Review
        </button>
      ) : pendingCount > 0 ? (
        <button type="button" data-testid="receipts-hub-pending-badge" onClick={onFilterPending} className="px-2 py-1 text-[11px] font-medium rounded-lg bg-slate-800/80 text-slate-300 border border-border hover:text-white transition-colors whitespace-nowrap">
          {pendingCount} Pending
        </button>
      ) : null}
      <Button variant="outline" size="xs" icon={<RefreshCw className={`w-3 h-3 text-amber-400 ${reconciling ? 'animate-spin' : ''}`} />} onClick={onReconcile} disabled={reconciling} title="Auto-match unlinked receipts with bank transactions">
        Reconcile
      </Button>
    </div>
  </div>
);

/**
 * Receipts OCR ingestion, reconciliation, and product longevity catalog modal.
 */
export const ReceiptsHubModal: React.FC<ReceiptsHubModalProps> = ({ isOpen, onClose, onReceiptLinked }) => {
  const s = useReceiptsHubState(isOpen, onReceiptLinked);
  const needsReviewCount = s.receipts.filter((r) => r.status === 'needs_review').length;
  const pendingCount = s.receipts.filter((r) => isReceiptPending(r)).length;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Receipts & Product Inventory Hub"
      footer={<div className="flex justify-end"><Button variant="outline" size="sm" onClick={onClose}>Done</Button></div>}
    >
      <div className="space-y-4">
        <ReceiptsHubHeaderBar
          activeTab={s.activeTab} receiptCount={s.receipts.length} productCount={s.products.length}
          needsReviewCount={needsReviewCount} pendingCount={pendingCount} reconciling={s.reconciling}
          onChangeTab={s.setActiveTab}
          onFilterNeedsReview={() => { s.setActiveTab('receipts'); s.setStatusFilter('needs_review'); }}
          onFilterPending={() => { s.setActiveTab('receipts'); s.setStatusFilter('pending'); }}
          onReconcile={() => void s.handleReconcile()}
        />
        {s.error && <AlertBanner variant="error">{s.error}</AlertBanner>}
        {s.statusMsg && <div data-testid="receipts-hub-status-banner"><AlertBanner variant="success">{s.statusMsg}</AlertBanner></div>}
        {s.activeTab === 'receipts' ? (
          <ReceiptsFeedTab
            receipts={s.receipts} loading={s.loading} uploading={s.uploading} deletingId={s.deletingId}
            reprocessingId={s.reprocessingId} updatingItemId={s.updatingItemId} expandedReceiptId={s.expandedReceiptId}
            statusFilter={s.statusFilter} onChangeStatusFilter={s.setStatusFilter}
            onToggleExpand={(id) => s.setExpandedReceiptId((prev) => (prev === id ? null : id))}
            onUploadFile={s.handleUploadFile} onDeleteReceipt={s.handleDeleteReceipt}
            onReprocessReceipt={s.handleReprocessReceipt} onReceiptLinked={s.handleCandidateLinked}
            onUpdateReceiptItem={s.handleUpdateReceiptItem}
          />
        ) : (
          <ProductsCatalogTab
            products={s.products} allTags={s.allTags} loading={s.loading}
            selectedDomain={s.selectedDomain} selectedTag={s.selectedTag}
            searchQuery={s.searchQuery} filterFavorites={s.filterFavorites}
            onChangeDomain={s.setSelectedDomain} onChangeTag={s.setSelectedTag}
            onChangeSearch={s.setSearchQuery} onToggleFavorites={() => s.setFilterFavorites((prev) => !prev)}
            onSearchSubmit={(e) => { e.preventDefault(); void s.loadData(); }}
            onToggleFavorite={s.handleToggleFavorite} onSaveNote={s.handleSaveNote}
            onAddTag={s.handleAddTag} onRemoveTag={s.handleRemoveTag}
          />
        )}
      </div>
    </Modal>
  );
};
