import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Calendar, Check, FolderTree, Pencil, Plus, RefreshCw, Shield, Trash2 } from 'lucide-react';
import {
  AlertBanner,
  Button,
  ConfirmActionBox,
  EmptyState,
  FormField,
  LoadingState,
  Modal,
  SearchInput,
  SegmentedControl,
  SelectInput,
  StatusBadge,
  TextInput,
} from '@yggdrasil-lab/ui';
import { getCategoryIcon } from '../constants/categoryIcons';
import { useCategories } from '../hooks/useCategories';
import { createCategory, deleteCategory, fetchCategories, updateCategory } from '../transport';
import { AmortizePeriod, CategoryItem } from '../types';

interface CategoryManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCategoriesChanged?: () => void;
}

type AmortizeSelection = 'none' | 'annual';

function toSlug(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

const CategoryDeleteConfirmBox: React.FC<{
  cat: CategoryItem;
  reassignChoices: CategoryItem[];
  reassignTarget: string;
  isDeleting: boolean;
  onReassignChange: (val: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}> = ({ cat, reassignChoices, reassignTarget, isDeleting, onReassignChange, onConfirm, onCancel }) => (
  <div data-testid="delete-category-confirm" className="mt-2.5">
    <ConfirmActionBox
      variant="danger"
      title={`Delete "${cat.name}"?`}
      confirmLabel="Confirm Delete"
      loading={isDeleting}
      onConfirm={onConfirm}
      onCancel={onCancel}
      description={
        <div className="space-y-2">
          <p>
            {cat.transaction_count} {cat.transaction_count === 1 ? 'transaction' : 'transactions'} and{' '}
            {cat.rule_count} {cat.rule_count === 1 ? 'rule' : 'rules'} will move to the target category below.
            {cat.child_count > 0 ? ` ${cat.child_count} nested sub-categories will become top-level base categories.` : ''}
          </p>
          <FormField label="Reassign records to">
            <SelectInput
              data-testid="delete-reassign-select"
              value={reassignTarget}
              onChange={(e) => onReassignChange(e.target.value)}
              variant="brand"
            >
              {reassignChoices.map((choice) => (
                <option key={choice.id} value={choice.name}>
                  {choice.parent_name ? `${choice.parent_name} > ${choice.name}` : choice.name}
                </option>
              ))}
            </SelectInput>
          </FormField>
        </div>
      }
    />
  </div>
);

const CategoryRowActions: React.FC<{
  cat: CategoryItem;
  slug: string;
  isAnnual: boolean;
  isToggling: boolean;
  onToggleAmortize: (cat: CategoryItem) => void;
  onEdit: (cat: CategoryItem) => void;
  onStartDelete: (cat: CategoryItem) => void;
}> = ({ cat, slug, isAnnual, isToggling, onToggleAmortize, onEdit, onStartDelete }) => (
  <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
    <button
      type="button"
      data-testid={`toggle-amortize-${slug}`}
      disabled={isToggling}
      onClick={() => onToggleAmortize(cat)}
      className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-[11px] font-medium transition-colors cursor-pointer ${
        isAnnual ? 'bg-amber-500/20 border-amber-500/40 text-amber-300' : 'bg-background/80 border-border text-slate-300 hover:border-amber-500/40 hover:text-amber-300'
      } ${isToggling ? 'opacity-60 cursor-wait' : ''}`}
    >
      <Calendar className="w-3 h-3" />
      <span>{isAnnual ? '52w On' : 'Spread 52w'}</span>
    </button>
    <button
      type="button"
      data-testid={`edit-category-${slug}`}
      aria-label={`Edit ${cat.name}`}
      onClick={() => onEdit(cat)}
      className="p-1.5 rounded-lg bg-background/80 border border-border text-slate-300 hover:text-amber-300 hover:border-amber-500/40 transition-colors cursor-pointer"
    >
      <Pencil className="w-3.5 h-3.5" />
    </button>
    <button
      type="button"
      data-testid={`delete-category-${slug}`}
      aria-label={`Delete ${cat.name}`}
      onClick={() => onStartDelete(cat)}
      className="p-1.5 rounded-lg bg-background/80 border border-border text-slate-300 hover:text-rose-300 hover:border-rose-500/40 transition-colors cursor-pointer"
    >
      <Trash2 className="w-3.5 h-3.5" />
    </button>
  </div>
);

const CategoryRowCard: React.FC<{
  cat: CategoryItem;
  isChild: boolean;
  isToggling: boolean;
  isConfirming: boolean;
  isDeleting: boolean;
  reassignChoices: CategoryItem[];
  reassignTarget: string;
  onReassignChange: (val: string) => void;
  onToggleAmortize: (cat: CategoryItem) => void;
  onEdit: (cat: CategoryItem) => void;
  onStartDelete: (cat: CategoryItem) => void;
  onConfirmDelete: (cat: CategoryItem) => void;
  onCancelDelete: () => void;
}> = ({
  cat, isChild, isToggling, isConfirming, isDeleting, reassignChoices,
  reassignTarget, onReassignChange, onToggleAmortize, onEdit,
  onStartDelete, onConfirmDelete, onCancelDelete,
}) => {
  const slug = toSlug(cat.name);
  const isAnnual = cat.amortize_period === 'annual';
  return (
    <div
      data-testid={`category-row-${slug}`}
      className={`p-2.5 rounded-xl border transition-colors ${
        isChild ? 'bg-background/70 border-border/70 hover:border-border' : 'bg-card/70 border-border hover:border-amber-500/30'
      }`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-start gap-2.5 min-w-0">
          <div className="p-1.5 rounded-lg bg-background border border-border/70 shrink-0 mt-0.5">{getCategoryIcon(cat.name)}</div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-semibold text-slate-100">{cat.name}</span>
              {isAnnual && <StatusBadge variant="info" size="xs" showDot={false} label="52w Annual" />}
              {cat.has_budget_rule && cat.weekly_limit !== null && (
                <StatusBadge variant="success" size="xs" showDot={false} label={`$${Math.round(cat.weekly_limit)}/wk`} className="font-mono" />
              )}
            </div>
            <div className="text-[10px] text-slate-400 font-mono mt-0.5 flex flex-wrap items-center gap-x-2">
              <span>{cat.transaction_count} {cat.transaction_count === 1 ? 'txn' : 'txns'}</span>
              <span>{cat.rule_count} {cat.rule_count === 1 ? 'rule' : 'rules'}</span>
              {!isChild && cat.child_count > 0 && <span>{cat.child_count} sub</span>}
            </div>
          </div>
        </div>
        <CategoryRowActions cat={cat} slug={slug} isAnnual={isAnnual} isToggling={isToggling} onToggleAmortize={onToggleAmortize} onEdit={onEdit} onStartDelete={onStartDelete} />
      </div>

      {isConfirming && (
        <CategoryDeleteConfirmBox
          cat={cat} reassignChoices={reassignChoices} reassignTarget={reassignTarget} isDeleting={isDeleting}
          onReassignChange={onReassignChange} onConfirm={() => onConfirmDelete(cat)} onCancel={onCancelDelete}
        />
      )}
    </div>
  );
};

const CategoryEditorForm: React.FC<{
  editingCategory: CategoryItem | null;
  draftName: string;
  draftParentId: string;
  draftAmortize: AmortizeSelection;
  rootBaseOptions: CategoryItem[];
  saving: boolean;
  onNameChange: (val: string) => void;
  onParentChange: (val: string) => void;
  onAmortizeChange: (val: AmortizeSelection) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
}> = ({
  editingCategory, draftName, draftParentId, draftAmortize, rootBaseOptions,
  saving, onNameChange, onParentChange, onAmortizeChange, onSubmit, onCancel,
}) => (
  <form
    data-testid="category-editor-form"
    onSubmit={onSubmit}
    className="p-3.5 bg-card/80 border border-amber-500/40 rounded-xl space-y-3"
  >
    <div className="flex items-center justify-between border-b border-border/60 pb-2">
      <span className="text-xs font-semibold text-amber-300 flex items-center space-x-1.5">
        <FolderTree className="w-3.5 h-3.5" />
        <span>{editingCategory ? `Edit Category: ${editingCategory.name}` : 'Create Spending Category'}</span>
      </span>
      <button type="button" onClick={onCancel} className="text-[11px] text-slate-400 hover:text-slate-200 cursor-pointer">
        Cancel
      </button>
    </div>

    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <FormField label="Category Name" required>
        <TextInput
          type="text"
          required
          maxLength={50}
          data-testid="category-name-input"
          placeholder="e.g. Coffee, Pet Care, Subscriptions"
          value={draftName}
          onChange={(e) => onNameChange(e.target.value)}
          variant="brand"
        />
      </FormField>

      <FormField
        label="Parent Base Class"
        hint={
          editingCategory && editingCategory.child_count > 0
            ? 'Move or remove nested sub-categories before nesting this base class.'
            : undefined
        }
      >
        <SelectInput
          data-testid="category-parent-select"
          value={draftParentId}
          disabled={Boolean(editingCategory && editingCategory.child_count > 0)}
          onChange={(e) => onParentChange(e.target.value)}
          variant="brand"
        >
          <option value="">Top-Level Base Category</option>
          {rootBaseOptions.map((root) => (
            <option key={root.id} value={String(root.id)}>
              {root.name}
            </option>
          ))}
        </SelectInput>
      </FormField>
    </div>

    <FormField
      label="Amortization & Burn Cadence"
      hint="52w Annual Spread averages occasional or seasonal expenses across 52 weeks in weekly burn and budget guardrails."
    >
      <SegmentedControl<AmortizeSelection>
        idPrefix="category-amortize-mode"
        fullWidth
        size="xs"
        variant="brand"
        value={draftAmortize}
        onChange={onAmortizeChange}
        options={[
          { id: 'none', label: 'Direct (Standard)' },
          { id: 'annual', label: '52w Annual Spread' },
        ]}
      />
    </FormField>

    <div className="flex items-center justify-end space-x-2 pt-2 border-t border-border/50">
      <Button variant="outline" size="xs" type="button" onClick={onCancel}>
        Cancel
      </Button>
      <Button
        variant="primary"
        size="xs"
        type="submit"
        data-testid="save-category-btn"
        disabled={saving}
        icon={saving ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
      >
        {editingCategory ? 'Update Category' : 'Save Category'}
      </Button>
    </div>
  </form>
);

const SystemCategoriesSection: React.FC<{ systemCats: CategoryItem[] }> = ({ systemCats }) => {
  if (systemCats.length === 0) return null;
  return (
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
                <div className="text-xs font-medium text-slate-200 truncate">{sys.name}</div>
                <div className="text-[10px] text-slate-400 font-mono">{sys.transaction_count} txns</div>
              </div>
            </div>
            <StatusBadge variant="idle" label="System" />
          </div>
        ))}
      </div>
    </div>
  );
};

function filterCategoryTree(activeItems: CategoryItem[], searchQuery: string) {
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
  const filteredGroups: Array<{ root: CategoryItem; children: CategoryItem[] }> = [];
  for (const root of roots) {
    const allChildren = childrenMap.get(root.id) || [];
    if (!q || root.name.toLowerCase().includes(q)) {
      filteredGroups.push({ root, children: allChildren });
      continue;
    }
    const matchingChildren = allChildren.filter((child) => child.name.toLowerCase().includes(q));
    if (matchingChildren.length > 0) filteredGroups.push({ root, children: matchingChildren });
  }
  const systemCats = activeItems.filter((c) => c.is_system && (!q || c.name.toLowerCase().includes(q)));
  return { filteredGroups, systemCats };
}

function useCategoryDeleteMutations(opts: {
  reassignTarget: string;
  activeItems: CategoryItem[];
  syncAll: () => Promise<void>;
  setters: {
    setError: (v: string | null) => void;
    setStatusMsg: (v: string | null) => void;
    setConfirmDeleteId: (v: number | null) => void;
    setReassignTarget: (v: string) => void;
    setDeletingId: (v: number | null) => void;
  };
}) {
  const { setters } = opts;

  const startDeleteFlow = (cat: CategoryItem) => {
    const fallback =
      cat.parent_name && opts.activeItems.some((c) => c.name === cat.parent_name && c.id !== cat.id)
        ? cat.parent_name
        : opts.activeItems.find((c) => c.name === 'General' && c.id !== cat.id)?.name ||
          opts.activeItems.find((c) => c.id !== cat.id)?.name || 'General';
    setters.setReassignTarget(fallback);
    setters.setConfirmDeleteId(cat.id);
    setters.setError(null);
    setters.setStatusMsg(null);
  };

  const handleConfirmDelete = async (cat: CategoryItem) => {
    setters.setDeletingId(cat.id);
    setters.setError(null);
    setters.setStatusMsg(null);
    try {
      const res = await deleteCategory(cat.id, opts.reassignTarget);
      setters.setConfirmDeleteId(null);
      setters.setStatusMsg(`Deleted "${res.deleted_name}" (reassigned ${res.transactions_reassigned} txns and ${res.rules_reassigned} rules to "${res.reassigned_to}")`);
      await opts.syncAll();
    } catch (err) {
      setters.setError(err instanceof Error ? err.message : 'Failed to delete category');
    } finally {
      setters.setDeletingId(null);
    }
  };

  return { startDeleteFlow, handleConfirmDelete };
}

function useCategoryMutations(opts: {
  editingCategory: CategoryItem | null;
  draftName: string;
  draftParentId: string;
  draftAmortize: AmortizeSelection;
  reassignTarget: string;
  activeItems: CategoryItem[];
  syncAll: () => Promise<void>;
  setters: {
    setError: (v: string | null) => void;
    setStatusMsg: (v: string | null) => void;
    setSaving: (v: boolean) => void;
    setIsFormOpen: (v: boolean) => void;
    setEditingCategory: (v: CategoryItem | null) => void;
    setTogglingId: (v: number | null) => void;
    setConfirmDeleteId: (v: number | null) => void;
    setReassignTarget: (v: string) => void;
    setDeletingId: (v: number | null) => void;
  };
}) {
  const { setters } = opts;

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = opts.draftName.trim();
    if (!cleaned) return setters.setError('Category name is required.');
    const parentId = opts.draftParentId ? Number(opts.draftParentId) : null;
    const amortizePeriod: AmortizePeriod = opts.draftAmortize === 'annual' ? 'annual' : null;
    setters.setSaving(true); setters.setError(null); setters.setStatusMsg(null);
    try {
      if (opts.editingCategory) {
        await updateCategory(opts.editingCategory.id, { name: cleaned, parent_id: opts.editingCategory.child_count > 0 ? opts.editingCategory.parent_id : parentId, amortize_period: amortizePeriod });
        setters.setStatusMsg(`Updated category "${cleaned}"`);
      } else {
        await createCategory({ name: cleaned, parent_id: parentId, amortize_period: amortizePeriod });
        setters.setStatusMsg(`Created category "${cleaned}"`);
      }
      setters.setIsFormOpen(false); setters.setEditingCategory(null);
      await opts.syncAll();
    } catch (err) {
      setters.setError(err instanceof Error ? err.message : 'Failed to save category');
    } finally { setters.setSaving(false); }
  };

  const handleToggleAmortize = async (cat: CategoryItem) => {
    const nextAmortize: AmortizePeriod = cat.amortize_period === 'annual' ? null : 'annual';
    setters.setTogglingId(cat.id); setters.setError(null); setters.setStatusMsg(null);
    try {
      await updateCategory(cat.id, { amortize_period: nextAmortize });
      setters.setStatusMsg(nextAmortize === 'annual' ? `Enabled 52w annual spread for "${cat.name}"` : `Disabled 52w annual spread for "${cat.name}"`);
      await opts.syncAll();
    } catch (err) {
      setters.setError(err instanceof Error ? err.message : 'Failed to update 52w spread setting');
    } finally { setters.setTogglingId(null); }
  };

  const deleteMutations = useCategoryDeleteMutations({ reassignTarget: opts.reassignTarget, activeItems: opts.activeItems, syncAll: opts.syncAll, setters });
  return { handleSaveCategory, handleToggleAmortize, ...deleteMutations };
}

function useCategoryManagerState(isOpen: boolean, onCategoriesChanged?: () => void) {
  const { refreshCategories } = useCategories();
  const [items, setItems] = useState<CategoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CategoryItem | null>(null);
  const [draftName, setDraftName] = useState('');
  const [draftParentId, setDraftParentId] = useState('');
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
      setItems(await fetchCategories());
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
      return;
    }
    setIsFormOpen(false);
    setEditingCategory(null);
    setConfirmDeleteId(null);
    setStatusMsg(null);
    setError(null);
    setSearchQuery('');
  }, [isOpen, loadLocalCategories]);

  const activeItems = useMemo(() => items.filter((c) => c.is_active), [items]);
  const syncAll = async () => {
    await loadLocalCategories();
    await refreshCategories();
    onCategoriesChanged?.();
  };
  const openForm = (cat: CategoryItem | null) => {
    setEditingCategory(cat);
    setDraftName(cat ? cat.name : '');
    setDraftParentId(cat && cat.parent_id !== null ? String(cat.parent_id) : '');
    setDraftAmortize(cat?.amortize_period === 'annual' ? 'annual' : 'none');
    setConfirmDeleteId(null);
    setStatusMsg(null);
    setError(null);
    setIsFormOpen(true);
  };
  const mutations = useCategoryMutations({
    editingCategory, draftName, draftParentId, draftAmortize, reassignTarget, activeItems, syncAll,
    setters: { setError, setStatusMsg, setSaving, setIsFormOpen, setEditingCategory, setTogglingId, setConfirmDeleteId, setReassignTarget, setDeletingId },
  });

  return {
    items, activeItems, loading, error, statusMsg, searchQuery, setSearchQuery,
    isFormOpen, setIsFormOpen, editingCategory, setEditingCategory, draftName, setDraftName,
    draftParentId, setDraftParentId, draftAmortize, setDraftAmortize, saving, togglingId,
    confirmDeleteId, setConfirmDeleteId, reassignTarget, setReassignTarget, deletingId, openForm, ...mutations,
  };
}

const CategoryTreeList: React.FC<{
  state: ReturnType<typeof useCategoryManagerState>;
  filteredGroups: Array<{ root: CategoryItem; children: CategoryItem[] }>;
  systemCats: CategoryItem[];
}> = ({ state: s, filteredGroups, systemCats }) => {
  const renderRow = (cat: CategoryItem, isChild: boolean) => (
    <CategoryRowCard
      key={cat.id} cat={cat} isChild={isChild} isToggling={s.togglingId === cat.id}
      isConfirming={s.confirmDeleteId === cat.id} isDeleting={s.deletingId === cat.id}
      reassignChoices={s.activeItems.filter((c) => c.id !== cat.id)} reassignTarget={s.reassignTarget}
      onReassignChange={s.setReassignTarget} onToggleAmortize={(c) => void s.handleToggleAmortize(c)}
      onEdit={(c) => s.openForm(c)} onStartDelete={s.startDeleteFlow}
      onConfirmDelete={(c) => void s.handleConfirmDelete(c)} onCancelDelete={() => s.setConfirmDeleteId(null)}
    />
  );

  if (s.loading && s.items.length === 0) return <LoadingState label="Loading categories..." variant="brand" />;
  if (filteredGroups.length === 0 && systemCats.length === 0) return <EmptyState title="No categories match your search." variant="dashed" />;

  return (
    <div className="space-y-3 max-h-[42vh] sm:max-h-[50vh] overflow-y-auto pr-1">
      {filteredGroups.map(({ root, children }) => (
        <div key={root.id} className="space-y-1.5">
          {renderRow(root, false)}
          {children.length > 0 && (
            <div className="ml-3 pl-3 border-l border-border/70 space-y-1.5">
              {children.map((child) => renderRow(child, true))}
            </div>
          )}
        </div>
      ))}
      <SystemCategoriesSection systemCats={systemCats} />
    </div>
  );
};

/**
 * Modal for creating, renaming, reparenting (2-level hierarchy), toggling 52-week
 * annual amortization, and safely deleting spending categories with record reassignment.
 */
export const CategoryManagerModal: React.FC<CategoryManagerModalProps> = ({
  isOpen,
  onClose,
  onCategoriesChanged,
}) => {
  const s = useCategoryManagerState(isOpen, onCategoriesChanged);
  const rootBaseOptions = useMemo(
    () => s.activeItems.filter((c) => !c.is_system && c.parent_id === null && c.id !== s.editingCategory?.id),
    [s.activeItems, s.editingCategory?.id]
  );
  const { filteredGroups, systemCats } = useMemo(
    () => filterCategoryTree(s.activeItems, s.searchQuery),
    [s.activeItems, s.searchQuery]
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Categories & Hierarchy"
      className="sm:max-w-2xl"
      footer={!s.isFormOpen ? <div className="flex justify-end"><Button variant="outline" size="sm" onClick={onClose}>Done</Button></div> : undefined}
    >
      <div className="space-y-3 sm:space-y-4">
        {!s.isFormOpen && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <p className="text-xs text-slate-300">Organize base pillars, nested sub-categories, and 52-week annual amortization rules.</p>
            <Button variant="primary" size="xs" data-testid="new-category-btn" icon={<Plus className="w-3.5 h-3.5" />} onClick={() => s.openForm(null)} className="shrink-0">
              New Category
            </Button>
          </div>
        )}
        {s.error && <AlertBanner variant="error">{s.error}</AlertBanner>}
        {s.statusMsg && <AlertBanner variant="success">{s.statusMsg}</AlertBanner>}
        {s.isFormOpen ? (
          <CategoryEditorForm
            editingCategory={s.editingCategory} draftName={s.draftName} draftParentId={s.draftParentId}
            draftAmortize={s.draftAmortize} rootBaseOptions={rootBaseOptions} saving={s.saving}
            onNameChange={s.setDraftName} onParentChange={s.setDraftParentId} onAmortizeChange={s.setDraftAmortize}
            onSubmit={(e) => void s.handleSaveCategory(e)} onCancel={() => { s.setIsFormOpen(false); s.setEditingCategory(null); }}
          />
        ) : (
          <>
            {s.activeItems.length > 0 && <SearchInput value={s.searchQuery} onChange={s.setSearchQuery} placeholder="Search base pillars or sub-categories..." variant="brand" />}
            <CategoryTreeList state={s} filteredGroups={filteredGroups} systemCats={systemCats} />
          </>
        )}
      </div>
    </Modal>
  );
};
