import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Calendar,
  Check,
  FolderTree,
  Pencil,
  Plus,
  RefreshCw,
  Shield,
  Trash2,
} from 'lucide-react';
import {
  AlertBanner,
  Button,
  EmptyState,
  LoadingState,
  Modal,
  SearchInput,
  SegmentedControl,
  StatusBadge,
} from '@yggdrasil-lab/ui';
import { getCategoryIcon } from '../constants/categoryIcons';
import { useCategories } from '../hooks/useCategories';
import {
  createCategory,
  deleteCategory,
  fetchCategories,
  updateCategory,
} from '../services/api';
import { AmortizePeriod, CategoryItem } from '../types';

interface CategoryManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCategoriesChanged?: () => void;
}

type AmortizeSelection = 'none' | 'annual';

function toSlug(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Modal for creating, renaming, reparenting (2-level hierarchy), toggling 52-week
 * annual amortization, and safely deleting spending categories with record reassignment.
 */
export const CategoryManagerModal: React.FC<CategoryManagerModalProps> = ({
  isOpen,
  onClose,
  onCategoriesChanged,
}) => {
  const { refreshCategories } = useCategories();
  const [items, setItems] = useState<CategoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CategoryItem | null>(null);
  const [draftName, setDraftName] = useState('');
  const [draftParentId, setDraftParentId] = useState<string>('');
  const [draftAmortize, setDraftAmortize] = useState<AmortizeSelection>('none');
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<number | null>(null);

  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [reassignTarget, setReassignTarget] = useState('General');
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const loadLocalCategories = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await fetchCategories();
      setItems(rows);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to load categories');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      void loadLocalCategories();
    } else {
      setIsFormOpen(false);
      setEditingCategory(null);
      setConfirmDeleteId(null);
      setStatusMsg(null);
      setError(null);
      setSearchQuery('');
    }
  }, [isOpen, loadLocalCategories]);

  const activeItems = useMemo(() => items.filter((c) => c.is_active), [items]);

  const rootBaseOptions = useMemo(
    () =>
      activeItems.filter(
        (c) => !c.is_system && c.parent_id === null && c.id !== editingCategory?.id
      ),
    [activeItems, editingCategory?.id]
  );

  const syncAll = async () => {
    await loadLocalCategories();
    await refreshCategories();
    onCategoriesChanged?.();
  };

  const openCreateForm = () => {
    setEditingCategory(null);
    setDraftName('');
    setDraftParentId('');
    setDraftAmortize('none');
    setConfirmDeleteId(null);
    setStatusMsg(null);
    setError(null);
    setIsFormOpen(true);
  };

  const openEditForm = (cat: CategoryItem) => {
    setEditingCategory(cat);
    setDraftName(cat.name);
    setDraftParentId(cat.parent_id !== null ? String(cat.parent_id) : '');
    setDraftAmortize(cat.amortize_period === 'annual' ? 'annual' : 'none');
    setConfirmDeleteId(null);
    setStatusMsg(null);
    setError(null);
    setIsFormOpen(true);
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = draftName.trim();
    if (!cleaned) {
      setError('Category name is required.');
      return;
    }

    const parentId = draftParentId ? Number(draftParentId) : null;
    const amortizePeriod: AmortizePeriod = draftAmortize === 'annual' ? 'annual' : null;

    setSaving(true);
    setError(null);
    setStatusMsg(null);
    try {
      if (editingCategory) {
        await updateCategory(editingCategory.id, {
          name: cleaned,
          parent_id: editingCategory.child_count > 0 ? editingCategory.parent_id : parentId,
          amortize_period: amortizePeriod,
        });
        setStatusMsg(`Updated category "${cleaned}"`);
      } else {
        await createCategory({
          name: cleaned,
          parent_id: parentId,
          amortize_period: amortizePeriod,
        });
        setStatusMsg(`Created category "${cleaned}"`);
      }
      setIsFormOpen(false);
      setEditingCategory(null);
      await syncAll();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to save category');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleAmortize = async (cat: CategoryItem) => {
    const nextAmortize: AmortizePeriod = cat.amortize_period === 'annual' ? null : 'annual';
    setTogglingId(cat.id);
    setError(null);
    setStatusMsg(null);
    try {
      await updateCategory(cat.id, { amortize_period: nextAmortize });
      setStatusMsg(
        nextAmortize === 'annual'
          ? `Enabled 52w annual spread for "${cat.name}"`
          : `Disabled 52w annual spread for "${cat.name}"`
      );
      await syncAll();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to update 52w spread setting');
    } finally {
      setTogglingId(null);
    }
  };

  const startDeleteFlow = (cat: CategoryItem) => {
    const fallback =
      cat.parent_name && activeItems.some((c) => c.name === cat.parent_name && c.id !== cat.id)
        ? cat.parent_name
        : activeItems.find((c) => c.name === 'General' && c.id !== cat.id)?.name ||
          activeItems.find((c) => c.id !== cat.id)?.name ||
          'General';
    setReassignTarget(fallback);
    setConfirmDeleteId(cat.id);
    setError(null);
    setStatusMsg(null);
  };

  const handleConfirmDelete = async (cat: CategoryItem) => {
    setDeletingId(cat.id);
    setError(null);
    setStatusMsg(null);
    try {
      const res = await deleteCategory(cat.id, reassignTarget);
      setConfirmDeleteId(null);
      setStatusMsg(
        `Deleted "${res.deleted_name}" (reassigned ${res.transactions_reassigned} txns and ${res.rules_reassigned} rules to "${res.reassigned_to}")`
      );
      await syncAll();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to delete category');
    } finally {
      setDeletingId(null);
    }
  };

  const { filteredGroups, systemCats } = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const roots = activeItems.filter((c) => !c.is_system && c.parent_id === null);
    const childrenMap = new Map<number, CategoryItem[]>();
    for (const item of activeItems) {
      if (!item.is_system && item.parent_id !== null) {
        const list = childrenMap.get(item.parent_id) || [];
        list.push(item);
        childrenMap.set(item.parent_id, list);
      }
    }

    const groups: Array<{ root: CategoryItem; children: CategoryItem[] }> = [];
    for (const root of roots) {
      const allChildren = childrenMap.get(root.id) || [];
      if (!q) {
        groups.push({ root, children: allChildren });
        continue;
      }
      const rootMatches = root.name.toLowerCase().includes(q);
      const matchingChildren = allChildren.filter((child) =>
        child.name.toLowerCase().includes(q)
      );
      if (rootMatches) {
        groups.push({ root, children: allChildren });
      } else if (matchingChildren.length > 0) {
        groups.push({ root, children: matchingChildren });
      }
    }

    const systems = activeItems.filter(
      (c) => c.is_system && (!q || c.name.toLowerCase().includes(q))
    );

    return { filteredGroups: groups, systemCats: systems };
  }, [activeItems, searchQuery]);

  const renderCategoryCard = (cat: CategoryItem, isChild: boolean) => {
    const slug = toSlug(cat.name);
    const isAnnual = cat.amortize_period === 'annual';
    const isToggling = togglingId === cat.id;
    const isConfirming = confirmDeleteId === cat.id;
    const isDeleting = deletingId === cat.id;
    const reassignChoices = activeItems.filter((c) => c.id !== cat.id);

    return (
      <div
        key={cat.id}
        data-testid={`category-row-${slug}`}
        className={`p-2.5 rounded-xl border transition-colors ${
          isChild
            ? 'bg-background/70 border-border/70 hover:border-border'
            : 'bg-card/70 border-border hover:border-amber-500/30'
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-start gap-2.5 min-w-0">
            <div className="p-1.5 rounded-lg bg-background border border-border/70 shrink-0 mt-0.5">
              {getCategoryIcon(cat.name)}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs font-semibold text-slate-100">{cat.name}</span>
                {isAnnual && <StatusBadge variant="info" label="52w Annual" />}
                {cat.has_budget_rule && cat.weekly_limit !== null && (
                  <span className="text-[10px] font-mono text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 rounded px-1.5 py-0.5">
                    ${Math.round(cat.weekly_limit)}/wk
                  </span>
                )}
              </div>
              <div className="text-[10px] text-slate-400 font-mono mt-0.5 flex flex-wrap items-center gap-x-2">
                <span>
                  {cat.transaction_count} {cat.transaction_count === 1 ? 'txn' : 'txns'}
                </span>
                <span>
                  {cat.rule_count} {cat.rule_count === 1 ? 'rule' : 'rules'}
                </span>
                {!isChild && cat.child_count > 0 && <span>{cat.child_count} sub</span>}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
            <button
              type="button"
              data-testid={`toggle-amortize-${slug}`}
              disabled={isToggling}
              onClick={() => void handleToggleAmortize(cat)}
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-[11px] font-medium transition-colors cursor-pointer ${
                isAnnual
                  ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                  : 'bg-background/80 border-border text-slate-300 hover:border-amber-500/40 hover:text-amber-300'
              } ${isToggling ? 'opacity-60 cursor-wait' : ''}`}
            >
              <Calendar className="w-3 h-3" />
              <span>{isAnnual ? '52w On' : 'Spread 52w'}</span>
            </button>

            <button
              type="button"
              data-testid={`edit-category-${slug}`}
              aria-label={`Edit ${cat.name}`}
              onClick={() => openEditForm(cat)}
              className="p-1.5 rounded-lg bg-background/80 border border-border text-slate-300 hover:text-amber-300 hover:border-amber-500/40 transition-colors cursor-pointer"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              data-testid={`delete-category-${slug}`}
              aria-label={`Delete ${cat.name}`}
              onClick={() => startDeleteFlow(cat)}
              className="p-1.5 rounded-lg bg-background/80 border border-border text-slate-300 hover:text-rose-300 hover:border-rose-500/40 transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {isConfirming && (
          <div
            data-testid="delete-category-confirm"
            className="mt-2.5 p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 space-y-2"
          >
            <p className="text-[11px] text-rose-200 leading-relaxed">
              Delete &quot;{cat.name}&quot;? {cat.transaction_count}{' '}
              {cat.transaction_count === 1 ? 'transaction' : 'transactions'} and {cat.rule_count}{' '}
              {cat.rule_count === 1 ? 'rule' : 'rules'} will move to the target category below.
              {cat.child_count > 0
                ? ` ${cat.child_count} nested sub-categories will become top-level base categories.`
                : ''}
            </p>
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <div className="flex-1 min-w-0">
                <label className="text-[10px] text-rose-200/80 block mb-1">
                  Reassign records to
                </label>
                <select
                  data-testid="delete-reassign-select"
                  value={reassignTarget}
                  onChange={(e) => setReassignTarget(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-background border border-border rounded-lg text-base sm:text-xs text-slate-100 focus:outline-none focus:border-rose-500"
                >
                  {reassignChoices.map((choice) => (
                    <option key={choice.id} value={choice.name}>
                      {choice.parent_name ? `${choice.parent_name} > ${choice.name}` : choice.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center justify-end gap-2 sm:pt-4">
                <Button
                  variant="outline"
                  size="xs"
                  type="button"
                  disabled={isDeleting}
                  onClick={() => setConfirmDeleteId(null)}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="xs"
                  type="button"
                  data-testid="confirm-delete-category-btn"
                  disabled={isDeleting}
                  onClick={() => void handleConfirmDelete(cat)}
                  className="bg-rose-600 hover:bg-rose-500 border-rose-500 text-white"
                >
                  {isDeleting ? 'Deleting...' : 'Confirm Delete'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Categories & Hierarchy"
      className="sm:max-w-2xl"
    >
      <div className="space-y-3 sm:space-y-4">
        {!isFormOpen && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <p className="text-xs text-slate-300">
              Organize base pillars, nested sub-categories, and 52-week annual amortization rules.
            </p>
            <Button
              variant="primary"
              size="xs"
              data-testid="new-category-btn"
              icon={<Plus className="w-3.5 h-3.5" />}
              onClick={openCreateForm}
              className="shrink-0"
            >
              New Category
            </Button>
          </div>
        )}

        {error && <AlertBanner variant="error">{error}</AlertBanner>}

        {statusMsg && (
          <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-xs text-emerald-300 flex items-center space-x-2">
            <Check className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
            <span>{statusMsg}</span>
          </div>
        )}

        {isFormOpen ? (
          <form
            data-testid="category-editor-form"
            onSubmit={handleSaveCategory}
            className="p-3.5 bg-card/80 border border-amber-500/40 rounded-xl space-y-3"
          >
            <div className="flex items-center justify-between border-b border-border/60 pb-2">
              <span className="text-xs font-semibold text-amber-300 flex items-center space-x-1.5">
                <FolderTree className="w-3.5 h-3.5" />
                <span>
                  {editingCategory
                    ? `Edit Category: ${editingCategory.name}`
                    : 'Create Spending Category'}
                </span>
              </span>
              <button
                type="button"
                onClick={() => {
                  setIsFormOpen(false);
                  setEditingCategory(null);
                }}
                className="text-[11px] text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                Cancel
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] text-slate-300 block mb-1">Category Name</label>
                <input
                  type="text"
                  required
                  maxLength={50}
                  data-testid="category-name-input"
                  placeholder="e.g. Coffee, Pet Care, Subscriptions"
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-background border border-border rounded-lg text-base sm:text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-300 block mb-1">
                  Parent Base Class
                </label>
                <select
                  data-testid="category-parent-select"
                  value={draftParentId}
                  disabled={Boolean(editingCategory && editingCategory.child_count > 0)}
                  onChange={(e) => setDraftParentId(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-background border border-border rounded-lg text-base sm:text-xs text-slate-100 focus:outline-none focus:border-amber-500 disabled:opacity-60"
                >
                  <option value="">Top-Level Base Category</option>
                  {rootBaseOptions.map((root) => (
                    <option key={root.id} value={String(root.id)}>
                      {root.name}
                    </option>
                  ))}
                </select>
                {editingCategory && editingCategory.child_count > 0 && (
                  <p className="text-[10px] text-slate-400 mt-1">
                    Move or remove nested sub-categories before nesting this base class.
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] text-slate-300 block">
                Amortization &amp; Burn Cadence
              </label>
              <SegmentedControl<AmortizeSelection>
                idPrefix="category-amortize-mode"
                fullWidth
                size="xs"
                variant="amber"
                value={draftAmortize}
                onChange={setDraftAmortize}
                options={[
                  { id: 'none', label: 'Direct (Standard)' },
                  { id: 'annual', label: '52w Annual Spread' },
                ]}
              />
              <p className="text-[10px] text-slate-400">
                52w Annual Spread averages occasional or seasonal expenses across 52 weeks in weekly burn and budget guardrails.
              </p>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-border/50">
              <Button
                variant="outline"
                size="xs"
                type="button"
                onClick={() => {
                  setIsFormOpen(false);
                  setEditingCategory(null);
                }}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="xs"
                type="submit"
                data-testid="save-category-btn"
                disabled={saving}
                icon={
                  saving ? (
                    <RefreshCw className="w-3 h-3 animate-spin" />
                  ) : (
                    <Check className="w-3 h-3" />
                  )
                }
              >
                {editingCategory ? 'Update Category' : 'Save Category'}
              </Button>
            </div>
          </form>
        ) : (
          <>
            {activeItems.length > 0 && (
              <SearchInput
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder="Search base pillars or sub-categories..."
                variant="amber"
              />
            )}

            {loading && items.length === 0 ? (
              <LoadingState label="Loading categories..." variant="amber" />
            ) : filteredGroups.length === 0 && systemCats.length === 0 ? (
              <EmptyState
                title="No categories match your search."
                variant="dashed"
              />
            ) : (
              <div className="space-y-3 max-h-[42vh] sm:max-h-[50vh] overflow-y-auto pr-1">
                {filteredGroups.map(({ root, children }) => (
                  <div key={root.id} className="space-y-1.5">
                    {renderCategoryCard(root, false)}
                    {children.length > 0 && (
                      <div className="ml-3 pl-3 border-l border-border/70 space-y-1.5">
                        {children.map((child) => renderCategoryCard(child, true))}
                      </div>
                    )}
                  </div>
                ))}

                {systemCats.length > 0 && (
                  <div className="pt-2 border-t border-border/60 space-y-2">
                    <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      <Shield className="w-3 h-3 text-slate-500" />
                      <span>System Categories (Protected)</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {systemCats.map((sys) => (
                        <div
                          key={sys.id}
                          data-testid={`category-row-${toSlug(sys.name)}`}
                          className="p-2 rounded-lg bg-background/50 border border-border/60 flex items-center justify-between gap-2"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            {getCategoryIcon(sys.name)}
                            <div className="min-w-0">
                              <div className="text-xs font-medium text-slate-200 truncate">
                                {sys.name}
                              </div>
                              <div className="text-[10px] text-slate-400 font-mono">
                                {sys.transaction_count} txns
                              </div>
                            </div>
                          </div>
                          <StatusBadge variant="idle" label="System" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="pt-2 flex justify-end">
              <Button variant="outline" size="sm" onClick={onClose}>
                Done
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
};
