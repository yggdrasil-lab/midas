import React, { useEffect, useState } from 'react';
import {
  Upload,
  RefreshCw,
  CheckCircle2,
  Clock,
  Calendar,
  ChevronDown,
  ChevronUp,
  Search,
  Tag,
  Star,
  TrendingUp,
  TrendingDown,
  Edit3,
  Save,
  Plus,
  X,
  Check,
} from 'lucide-react';
import { Modal, Button, AlertBanner } from '@yggdrasil-lab/ui';
import { Product, Receipt } from '../types';
import {
  fetchReceipts,
  fetchProducts,
  updateProduct,
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
  const [products, setProducts] = useState<Product[]>([]);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [reconciling, setReconciling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [expandedReceiptId, setExpandedReceiptId] = useState<number | null>(null);
  const [expandedPriceHistoryId, setExpandedPriceHistoryId] = useState<number | null>(null);

  // Filters
  const [selectedDomain, setSelectedDomain] = useState<string>('all');
  const [selectedTag, setSelectedTag] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterFavorites, setFilterFavorites] = useState<boolean>(false);

  // Note editing state
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null);
  const [noteDraft, setNoteDraft] = useState<string>('');
  const [savingNoteId, setSavingNoteId] = useState<number | null>(null);

  // Tag adding state
  const [addingTagProductId, setAddingTagProductId] = useState<number | null>(null);
  const [newTagInput, setNewTagInput] = useState<string>('');

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
      setEditingNoteId(null);
      setAddingTagProductId(null);
    }
  }, [isOpen, selectedDomain, selectedTag, filterFavorites]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadData();
  };

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

  const handleToggleFavorite = async (p: Product) => {
    const nextFav = !p.is_favorite;
    try {
      const updated = await updateProduct(p.id, { is_favorite: nextFav });
      setProducts((prev) => prev.map((item) => (item.id === p.id ? updated : item)));
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to update favorite');
    }
  };

  const handleStartEditingNote = (p: Product) => {
    setEditingNoteId(p.id);
    setNoteDraft(p.notes || '');
  };

  const handleSaveNote = async (productId: number) => {
    setSavingNoteId(productId);
    try {
      const updated = await updateProduct(productId, { notes: noteDraft });
      setProducts((prev) => prev.map((item) => (item.id === productId ? updated : item)));
      setEditingNoteId(null);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to save note');
    } finally {
      setSavingNoteId(null);
    }
  };

  const handleAddTag = async (productId: number) => {
    const cleanTag = newTagInput.trim().toLowerCase().replace(/^#/, '');
    if (!cleanTag) {
      setAddingTagProductId(null);
      return;
    }

    const prod = products.find((p) => p.id === productId);
    if (!prod) return;

    if (prod.tags.includes(cleanTag)) {
      setAddingTagProductId(null);
      setNewTagInput('');
      return;
    }

    const nextTags = [...prod.tags, cleanTag];
    try {
      const updated = await updateProduct(productId, { tags: nextTags });
      setProducts((prev) => prev.map((item) => (item.id === productId ? updated : item)));
      if (!allTags.includes(cleanTag)) {
        setAllTags((prev) => [...prev, cleanTag].sort());
      }
      setAddingTagProductId(null);
      setNewTagInput('');
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to add tag');
    }
  };

  const handleRemoveTag = async (productId: number, tagToRemove: string) => {
    const prod = products.find((p) => p.id === productId);
    if (!prod) return;

    const nextTags = prod.tags.filter((t) => t !== tagToRemove);
    try {
      const updated = await updateProduct(productId, { tags: nextTags });
      setProducts((prev) => prev.map((item) => (item.id === productId ? updated : item)));
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to remove tag');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Receipts & Product Inventory Hub"
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
              Products & Price History ({products.length})
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
                        onClick={() => setExpandedReceiptId((prev) => (prev === r.id ? null : r.id))}
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
                                        {item.domain === '02-skin' ? 'Skin' : item.domain === '01-health' ? 'Health' : item.domain}
                                      </span>
                                    )}
                                    {item.tags && item.tags.length > 0 && (
                                      <div className="flex items-center gap-1">
                                        {item.tags.map((t) => (
                                          <span key={t} className="text-amber-400/80">#{t}</span>
                                        ))}
                                      </div>
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

        {/* Tab 2: Products Catalog & Price History */}
        {activeTab === 'products' && (
          <div className="space-y-3">
            {/* Search Bar & Favorite Toggle */}
            <form onSubmit={handleSearchSubmit} className="flex items-center space-x-2">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search products, brands, tags, or notes..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-card/60 border border-border rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500/50"
                />
              </div>

              <Button
                type="button"
                variant={filterFavorites ? 'primary' : 'outline'}
                size="xs"
                onClick={() => setFilterFavorites((prev) => !prev)}
                icon={<Star className={`w-3 h-3 ${filterFavorites ? 'fill-amber-400 text-amber-400' : 'text-slate-400'}`} />}
                title="Filter favorites"
              >
                Starred
              </Button>
            </form>

            {/* Domain Filter Buttons */}
            <div className="flex flex-wrap items-center gap-1.5">
              {[
                { id: 'all', label: 'All Domains' },
                { id: '02-skin', label: 'Skincare' },
                { id: '01-health', label: 'Health' },
                { id: '20-home', label: 'Home' },
              ].map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => setSelectedDomain(d.id)}
                  className={`px-2.5 py-1 text-xs rounded-lg transition-colors ${
                    selectedDomain === d.id
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 font-medium'
                      : 'text-slate-400 hover:text-slate-200 bg-card/30 border border-border/40'
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>

            {/* Dynamic Tag Pills */}
            {allTags.length > 0 && (
              <div className="flex items-center space-x-1.5 overflow-x-auto py-1 scrollbar-none">
                <span className="text-[10px] text-slate-500 font-medium flex items-center shrink-0">
                  <Tag className="w-3 h-3 mr-1 text-slate-500" /> Tags:
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedTag('all')}
                  className={`px-2 py-0.5 text-[11px] rounded-md transition-colors shrink-0 ${
                    selectedTag === 'all'
                      ? 'bg-amber-500 text-slate-900 font-bold'
                      : 'bg-card/50 text-slate-400 hover:text-slate-200 border border-border/40'
                  }`}
                >
                  #all
                </button>
                {allTags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setSelectedTag(tag === selectedTag ? 'all' : tag)}
                    className={`px-2 py-0.5 text-[11px] rounded-md transition-colors shrink-0 ${
                      selectedTag === tag
                        ? 'bg-amber-500 text-slate-900 font-bold'
                        : 'bg-card/50 text-slate-400 hover:text-slate-200 border border-border/40'
                    }`}
                  >
                    #{tag}
                  </button>
                ))}
              </div>
            )}

            {loading ? (
              <div className="py-8 flex flex-col items-center justify-center space-y-2 text-slate-400 text-xs">
                <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
                <span>Loading product inventory and price telemetry...</span>
              </div>
            ) : products.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400 bg-card/30 rounded-xl border border-border/50">
                No products match the selected criteria. Upload receipts or adjust tags to see cataloged items.
              </div>
            ) : (
              <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
                {products.map((p) => {
                  const hasPriceChange = p.price_change_latest !== null && p.price_change_latest !== undefined;
                  const isPriceUp = hasPriceChange && (p.price_change_latest || 0) > 0;
                  const isPriceDown = hasPriceChange && (p.price_change_latest || 0) < 0;
                  const isExpanded = expandedPriceHistoryId === p.id;
                  const isEditingNote = editingNoteId === p.id;

                  return (
                    <div
                      key={p.id}
                      className="p-3 bg-card/60 hover:bg-card/80 border border-border rounded-xl space-y-2.5 transition-all"
                    >
                      {/* Product Header */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-0.5 min-w-0">
                          <div className="flex items-center space-x-2">
                            <button
                              type="button"
                              onClick={() => handleToggleFavorite(p)}
                              className="text-slate-400 hover:text-amber-400 transition-colors"
                              title={p.is_favorite ? 'Favorited' : 'Add to favorites'}
                            >
                              <Star
                                className={`w-3.5 h-3.5 ${
                                  p.is_favorite ? 'fill-amber-400 text-amber-400' : 'text-slate-500'
                                }`}
                              />
                            </button>
                            <span className="text-xs font-bold text-slate-100 truncate">{p.name}</span>
                          </div>

                          <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-slate-400">
                            {p.brand && <span className="font-semibold text-slate-300">{p.brand}</span>}
                            {p.volume_ml && <span className="text-slate-400">({p.volume_ml})</span>}
                            {p.domain && (
                              <span className="px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20 font-medium">
                                {p.domain === '02-skin' ? 'Skin' : p.domain === '01-health' ? 'Health' : p.domain}
                              </span>
                            )}
                            <span>• {p.purchase_count} {p.purchase_count === 1 ? 'purchase' : 'purchases'}</span>
                          </div>
                        </div>

                        {/* Price & Fluctuation Badge */}
                        <div className="text-right shrink-0 space-y-0.5">
                          <div className="flex items-center justify-end space-x-1.5">
                            <span className="text-xs font-bold font-mono text-slate-100">
                              ${p.latest_price !== null && p.latest_price !== undefined ? p.latest_price.toFixed(2) : '0.00'}
                            </span>
                            {hasPriceChange && (
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold flex items-center border ${
                                  isPriceUp
                                    ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                                    : isPriceDown
                                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                                    : 'bg-slate-700 text-slate-300 border-slate-600'
                                }`}
                              >
                                {isPriceUp ? (
                                  <TrendingUp className="w-2.5 h-2.5 mr-0.5 text-rose-400" />
                                ) : (
                                  <TrendingDown className="w-2.5 h-2.5 mr-0.5 text-emerald-400" />
                                )}
                                {isPriceUp ? `+${p.price_change_latest?.toFixed(2)}` : p.price_change_latest?.toFixed(2)}
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            Total Spent: ${p.total_spent.toFixed(2)}
                          </div>
                        </div>
                      </div>

                      {/* Tag Pill Badges & Add Tag */}
                      <div className="flex flex-wrap items-center gap-1 pt-0.5">
                        {p.tags.map((t) => (
                          <span
                            key={t}
                            className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-800 text-slate-300 border border-slate-700/80 group"
                          >
                            #{t}
                            <button
                              type="button"
                              onClick={() => handleRemoveTag(p.id, t)}
                              className="ml-1 opacity-60 hover:opacity-100 text-slate-400 hover:text-rose-400"
                              title={`Remove tag #${t}`}
                            >
                              <X className="w-2.5 h-2.5" />
                            </button>
                          </span>
                        ))}

                        {addingTagProductId === p.id ? (
                          <div className="inline-flex items-center space-x-1">
                            <input
                              type="text"
                              value={newTagInput}
                              onChange={(e) => setNewTagInput(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleAddTag(p.id);
                                } else if (e.key === 'Escape') {
                                  setAddingTagProductId(null);
                                }
                              }}
                              placeholder="tag..."
                              autoFocus
                              className="px-1.5 py-0.5 text-[10px] bg-slate-900 border border-amber-500/50 rounded text-slate-100 w-16 focus:outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => handleAddTag(p.id)}
                              className="p-0.5 text-emerald-400 hover:text-emerald-300"
                            >
                              <Check className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setAddingTagProductId(null)}
                              className="p-0.5 text-slate-400 hover:text-slate-300"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setAddingTagProductId(p.id);
                              setNewTagInput('');
                            }}
                            className="inline-flex items-center px-1.5 py-0.5 text-[10px] text-slate-400 hover:text-amber-400 border border-dashed border-slate-700 rounded-md transition-colors"
                          >
                            <Plus className="w-2.5 h-2.5 mr-0.5" /> tag
                          </button>
                        )}
                      </div>

                      {/* Longevity & Restock Projection */}
                      <div className="p-2 bg-background/80 rounded-lg border border-border/60 flex flex-col sm:flex-row sm:items-center justify-between text-[11px] gap-2">
                        <div className="flex items-center space-x-1.5 text-slate-300">
                          <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          <span>
                            {p.avg_days_between_purchases
                              ? `Usage Longevity: ~${p.avg_days_between_purchases} days per unit`
                              : p.first_purchased
                              ? `First recorded: ${p.first_purchased}`
                              : 'Single purchase recorded'}
                          </span>
                        </div>

                        {p.estimated_depletion_date && (
                          <div className="flex items-center space-x-1.5 text-emerald-300 font-medium">
                            <Calendar className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            <span>Est. Restock: {p.estimated_depletion_date}</span>
                          </div>
                        )}
                      </div>

                      {/* User Notes & Observations Section */}
                      <div className="p-2 bg-card/40 rounded-lg border border-border/50 text-xs space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">
                            Notes & Observations
                          </span>
                          {!isEditingNote && (
                            <button
                              type="button"
                              onClick={() => handleStartEditingNote(p)}
                              className="text-[11px] text-amber-400 hover:text-amber-300 flex items-center space-x-1"
                            >
                              <Edit3 className="w-3 h-3" />
                              <span>{p.notes ? 'Edit' : 'Add Note'}</span>
                            </button>
                          )}
                        </div>

                        {isEditingNote ? (
                          <div className="space-y-2 pt-1">
                            <textarea
                              value={noteDraft}
                              onChange={(e) => setNoteDraft(e.target.value)}
                              placeholder="Write impressions, skin reactions, usage instructions, or reasons for buying..."
                              rows={2}
                              className="w-full p-2 text-xs bg-background border border-amber-500/40 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none"
                            />
                            <div className="flex justify-end space-x-2">
                              <Button
                                variant="outline"
                                size="xs"
                                onClick={() => setEditingNoteId(null)}
                                disabled={savingNoteId === p.id}
                              >
                                Cancel
                              </Button>
                              <Button
                                variant="primary"
                                size="xs"
                                onClick={() => handleSaveNote(p.id)}
                                disabled={savingNoteId === p.id}
                                icon={<Save className="w-3 h-3" />}
                              >
                                {savingNoteId === p.id ? 'Saving...' : 'Save Note'}
                              </Button>
                            </div>
                          </div>
                        ) : p.notes ? (
                          <p className="text-slate-300 text-xs italic bg-background/40 p-2 rounded border border-border/40">
                            {p.notes}
                          </p>
                        ) : (
                          <p className="text-slate-500 text-[11px] italic">
                            No notes added yet. Click &quot;Add Note&quot; to keep observations about this product.
                          </p>
                        )}
                      </div>

                      {/* Expandable Price History Timeline */}
                      {p.price_history && p.price_history.length > 0 && (
                        <div>
                          <button
                            type="button"
                            onClick={() => setExpandedPriceHistoryId((prev) => (prev === p.id ? null : p.id))}
                            className="text-[11px] text-slate-400 hover:text-slate-200 flex items-center space-x-1 transition-colors"
                          >
                            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            <span>
                              {isExpanded ? 'Hide Price Timeline' : `View Price History (${p.price_history.length} purchases)`}
                            </span>
                          </button>

                          {isExpanded && (
                            <div className="mt-2 space-y-1.5 pt-2 border-t border-border/40 animate-in fade-in">
                              {p.price_history.map((pt, idx) => (
                                <div
                                  key={idx}
                                  className="p-1.5 bg-background/60 rounded border border-border/40 flex items-center justify-between text-[11px]"
                                >
                                  <div className="space-y-0.5">
                                    <div className="font-mono text-slate-300 font-medium">{pt.date}</div>
                                    <div className="text-slate-400 text-[10px]">{pt.merchant}</div>
                                  </div>
                                  <div className="text-right">
                                    <div className="font-mono font-bold text-slate-100">
                                      ${pt.unit_price.toFixed(2)}
                                    </div>
                                    {pt.quantity > 1 && (
                                      <div className="text-[10px] text-slate-400">
                                        Qty: {pt.quantity} (${pt.total_price.toFixed(2)})
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
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
