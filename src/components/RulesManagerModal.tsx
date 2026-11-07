import React, { useEffect, useState } from 'react';
import {
  SlidersHorizontal,
  Plus,
  Trash2,
  Pencil,
  Play,
  Check,
  RefreshCw,
  ArrowRight,
  Search,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { Modal, Button, AlertBanner } from '@yggdrasil-lab/ui';
import { CategorizationRule, CategorizationRuleCreate } from '../types';
import {
  fetchRules,
  createRule,
  updateRule,
  deleteRule,
  applyAllRules,
} from '../services/api';

interface RulesManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRulesApplied?: () => void;
  prefillRule?: Partial<CategorizationRuleCreate> | null;
}

const CATEGORY_OPTIONS = [
  'Groceries',
  'Food',
  'Transport',
  'Utilities',
  'Health',
  'Leisure',
  'Insurance',
  'Travel',
  'Housing',
  'Transfers',
  'Income',
  'General',
];

export const RulesManagerModal: React.FC<RulesManagerModalProps> = ({
  isOpen,
  onClose,
  onRulesApplied,
  prefillRule,
}) => {
  const [rules, setRules] = useState<CategorizationRule[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Form state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingRuleId, setEditingRuleId] = useState<number | null>(null);
  const [formName, setFormName] = useState('');
  const [formPattern, setFormPattern] = useState('');
  const [formMatchType, setFormMatchType] = useState<'contains' | 'exact' | 'starts_with'>('contains');
  const [formAmountEquals, setFormAmountEquals] = useState<string>('');
  const [formTargetCategory, setFormTargetCategory] = useState('General');
  const [formRenameMerchant, setFormRenameMerchant] = useState('');
  const [formPriority, setFormPriority] = useState<number>(10);
  const [formApplyRetroactively, setFormApplyRetroactively] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isApplyingAll, setIsApplyingAll] = useState(false);

  const loadRules = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchRules();
      setRules(res);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to load categorization rules');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadRules();
      if (prefillRule) {
        setFormName(prefillRule.name || '');
        setFormPattern(prefillRule.description_pattern || '');
        setFormMatchType(prefillRule.match_type || 'contains');
        setFormAmountEquals(
          prefillRule.amount_equals !== undefined && prefillRule.amount_equals !== null
            ? String(prefillRule.amount_equals)
            : ''
        );
        setFormTargetCategory(prefillRule.target_category || 'General');
        setFormRenameMerchant(prefillRule.rename_merchant || '');
        setFormPriority(prefillRule.priority || 10);
        setFormApplyRetroactively(prefillRule.apply_retroactively !== false);
        setEditingRuleId(null);
        setIsFormOpen(true);
      }
    } else {
      setIsFormOpen(false);
      setEditingRuleId(null);
      setStatusMsg(null);
    }
  }, [isOpen, prefillRule]);

  const handleOpenCreateForm = () => {
    setEditingRuleId(null);
    setFormName('');
    setFormPattern('');
    setFormMatchType('contains');
    setFormAmountEquals('');
    setFormTargetCategory('General');
    setFormRenameMerchant('');
    setFormPriority(10);
    setFormApplyRetroactively(true);
    setIsFormOpen(true);
    setStatusMsg(null);
  };

  const handleOpenEditForm = (rule: CategorizationRule) => {
    setEditingRuleId(rule.id);
    setFormName(rule.name);
    setFormPattern(rule.description_pattern);
    setFormMatchType(rule.match_type);
    setFormAmountEquals(rule.amount_equals != null ? String(rule.amount_equals) : '');
    setFormTargetCategory(rule.target_category);
    setFormRenameMerchant(rule.rename_merchant || '');
    setFormPriority(rule.priority);
    setFormApplyRetroactively(true);
    setIsFormOpen(true);
    setStatusMsg(null);
  };

  const handleCancelForm = () => {
    setIsFormOpen(false);
    setEditingRuleId(null);
  };

  const handleSaveRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formPattern.trim() || !formTargetCategory.trim()) {
      setError('Rule name, description pattern, and target category are required.');
      return;
    }

    setIsSaving(true);
    setError(null);
    setStatusMsg(null);

    const parsedAmt = formAmountEquals.trim() !== '' ? Math.abs(parseFloat(formAmountEquals)) : null;

    try {
      if (editingRuleId) {
        await updateRule(editingRuleId, {
          name: formName.trim(),
          description_pattern: formPattern.trim(),
          match_type: formMatchType,
          amount_equals: parsedAmt,
          target_category: formTargetCategory.trim(),
          rename_merchant: formRenameMerchant.trim() || null,
          priority: formPriority,
          apply_retroactively: formApplyRetroactively,
        });
        setStatusMsg(`Updated rule "${formName.trim()}"`);
      } else {
        await createRule({
          name: formName.trim(),
          description_pattern: formPattern.trim(),
          match_type: formMatchType,
          amount_equals: parsedAmt,
          target_category: formTargetCategory.trim(),
          rename_merchant: formRenameMerchant.trim() || null,
          priority: formPriority,
          is_active: true,
          apply_retroactively: formApplyRetroactively,
        });
        setStatusMsg(`Created rule "${formName.trim()}"`);
      }

      setIsFormOpen(false);
      setEditingRuleId(null);
      await loadRules();
      if (onRulesApplied) onRulesApplied();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to save categorization rule');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleRule = async (rule: CategorizationRule) => {
    setError(null);
    try {
      await updateRule(rule.id, {
        is_active: !rule.is_active,
      });
      setRules((prev) =>
        prev.map((r) => (r.id === rule.id ? { ...r, is_active: !rule.is_active } : r))
      );
      setStatusMsg(`Rule "${rule.name}" is now ${!rule.is_active ? 'active' : 'inactive'}`);
      if (onRulesApplied) onRulesApplied();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to toggle rule state');
    }
  };

  const handleDeleteRule = async (rule: CategorizationRule) => {
    if (!confirm(`Are you sure you want to delete rule "${rule.name}"?`)) {
      return;
    }
    setError(null);
    try {
      await deleteRule(rule.id);
      setRules((prev) => prev.filter((r) => r.id !== rule.id));
      setStatusMsg(`Deleted rule "${rule.name}"`);
      if (onRulesApplied) onRulesApplied();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to delete rule');
    }
  };

  const handleApplyAll = async () => {
    setIsApplyingAll(true);
    setError(null);
    setStatusMsg(null);
    try {
      const res = await applyAllRules();
      setStatusMsg(`Evaluated ${res.evaluated} transactions; updated ${res.updated}.`);
      await loadRules();
      if (onRulesApplied) onRulesApplied();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to run categorization rules');
    } finally {
      setIsApplyingAll(false);
    }
  };

  const filteredRules = rules.filter((r) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      r.name.toLowerCase().includes(q) ||
      r.description_pattern.toLowerCase().includes(q) ||
      r.target_category.toLowerCase().includes(q) ||
      (r.rename_merchant && r.rename_merchant.toLowerCase().includes(q))
    );
  });

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Outlook-Style Categorization Rules"
    >
      <div className="space-y-4">
        {/* Description & Action Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <p className="text-xs text-slate-300">
            Define custom pattern and amount rules to automatically categorize transactions and rename merchants.
          </p>
          <div className="flex items-center space-x-2 shrink-0">
            {!isFormOpen && (
              <Button
                variant="primary"
                size="xs"
                icon={<Plus className="w-3.5 h-3.5" />}
                onClick={handleOpenCreateForm}
              >
                New Rule
              </Button>
            )}
            <Button
              variant="outline"
              size="xs"
              icon={
                <Play
                  className={`w-3.5 h-3.5 text-amber-400 ${isApplyingAll ? 'animate-spin' : ''}`}
                />
              }
              onClick={handleApplyAll}
              disabled={isApplyingAll || rules.length === 0}
            >
              Run Rules
            </Button>
          </div>
        </div>

        {error && <AlertBanner variant="error">{error}</AlertBanner>}
        {statusMsg && (
          <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-xs text-emerald-300 flex items-center space-x-2 animate-in fade-in">
            <Check className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
            <span>{statusMsg}</span>
          </div>
        )}

        {/* Create / Edit Rule Form */}
        {isFormOpen && (
          <form
            onSubmit={handleSaveRule}
            className="p-3.5 bg-card/80 border border-amber-500/40 rounded-xl space-y-3 animate-in fade-in"
          >
            <div className="flex items-center justify-between border-b border-border/60 pb-2">
              <span className="text-xs font-semibold text-amber-300 flex items-center space-x-1.5">
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>{editingRuleId ? 'Edit Rule' : 'Create Outlook-Style Rule'}</span>
              </span>
              <button
                type="button"
                onClick={handleCancelForm}
                className="text-[11px] text-slate-400 hover:text-slate-200"
              >
                Cancel
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Rule Name */}
              <div>
                <label className="text-[11px] text-slate-300 block mb-1">Rule Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Regular Utilities Transfer"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full text-xs px-2.5 py-1.5 bg-background border border-border rounded-lg text-slate-200 focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Priority */}
              <div>
                <label className="text-[11px] text-slate-300 block mb-1">
                  Priority <span className="text-slate-400">(lower runs first)</span>
                </label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={formPriority}
                  onChange={(e) => setFormPriority(parseInt(e.target.value) || 10)}
                  className="w-full text-xs px-2.5 py-1.5 bg-background border border-border rounded-lg text-slate-200 focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Description Pattern */}
              <div>
                <label className="text-[11px] text-slate-300 block mb-1">Description Pattern</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 12-0323-0895056 or WISE TFR"
                  value={formPattern}
                  onChange={(e) => setFormPattern(e.target.value)}
                  className="w-full text-xs px-2.5 py-1.5 bg-background border border-border rounded-lg text-slate-200 focus:outline-none focus:border-amber-500 font-mono"
                />
              </div>

              {/* Match Type */}
              <div>
                <label className="text-[11px] text-slate-300 block mb-1">Pattern Match Type</label>
                <select
                  value={formMatchType}
                  onChange={(e) =>
                    setFormMatchType(e.target.value as 'contains' | 'exact' | 'starts_with')
                  }
                  className="w-full text-xs px-2.5 py-1.5 bg-background border border-border rounded-lg text-slate-200 focus:outline-none focus:border-amber-500"
                >
                  <option value="contains">Contains (substring anywhere)</option>
                  <option value="starts_with">Starts with (begins with)</option>
                  <option value="exact">Exact match</option>
                </select>
              </div>

              {/* Optional Amount condition */}
              <div>
                <label className="text-[11px] text-slate-300 block mb-1">
                  Exact Amount Match <span className="text-slate-400">(optional)</span>
                </label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1.5 text-xs text-slate-400">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="e.g. 400.00 (leave empty for any amount)"
                    value={formAmountEquals}
                    onChange={(e) => setFormAmountEquals(e.target.value)}
                    className="w-full text-xs pl-6 pr-2.5 py-1.5 bg-background border border-border rounded-lg text-slate-200 focus:outline-none focus:border-amber-500 font-mono"
                  />
                </div>
              </div>

              {/* Target Category */}
              <div>
                <label className="text-[11px] text-slate-300 block mb-1">Target Category</label>
                <select
                  value={formTargetCategory}
                  onChange={(e) => setFormTargetCategory(e.target.value)}
                  className="w-full text-xs px-2.5 py-1.5 bg-background border border-border rounded-lg text-slate-200 focus:outline-none focus:border-amber-500"
                >
                  {CATEGORY_OPTIONS.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              {/* Rename Merchant */}
              <div className="sm:col-span-2">
                <label className="text-[11px] text-slate-300 block mb-1">
                  Rename Merchant Display <span className="text-slate-400">(optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Power and Water Utilities (leave empty to keep original)"
                  value={formRenameMerchant}
                  onChange={(e) => setFormRenameMerchant(e.target.value)}
                  className="w-full text-xs px-2.5 py-1.5 bg-background border border-border rounded-lg text-slate-200 focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            {/* Retroactive Checkbox */}
            <div className="pt-1 flex items-center space-x-2">
              <input
                type="checkbox"
                id="apply_retroactively_check"
                checked={formApplyRetroactively}
                onChange={(e) => setFormApplyRetroactively(e.target.checked)}
                className="rounded border-border text-amber-500 focus:ring-amber-500"
              />
              <label
                htmlFor="apply_retroactively_check"
                className="text-[11px] text-slate-300 cursor-pointer"
              >
                Apply immediately to historical transactions matching this rule
              </label>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-border/50">
              <Button variant="outline" size="xs" onClick={handleCancelForm} type="button">
                Cancel
              </Button>
              <Button
                variant="primary"
                size="xs"
                type="submit"
                disabled={isSaving}
                icon={isSaving ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
              >
                {editingRuleId ? 'Update Rule' : 'Save Rule'}
              </Button>
            </div>
          </form>
        )}

        {/* Search Bar */}
        {rules.length > 0 && !isFormOpen && (
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search rules by pattern, category, or merchant..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-xs pl-8 pr-3 py-1.5 bg-card/60 border border-border rounded-lg text-slate-200 focus:outline-none focus:border-amber-500"
            />
          </div>
        )}

        {/* Rules List */}
        {loading && !rules.length ? (
          <div className="py-8 flex flex-col items-center justify-center space-y-2 text-slate-400 text-xs">
            <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
            <span>Loading rules...</span>
          </div>
        ) : filteredRules.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400 bg-card/30 rounded-xl border border-border/50 space-y-2">
            <p>
              {searchQuery
                ? 'No categorization rules match your search query.'
                : 'No categorization rules configured yet.'}
            </p>
            {!isFormOpen && (
              <Button
                variant="outline"
                size="xs"
                icon={<Plus className="w-3 h-3 text-amber-400" />}
                onClick={handleOpenCreateForm}
              >
                Create First Rule
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-2.5 max-h-[50vh] overflow-y-auto pr-1">
            {filteredRules.map((rule) => {
              return (
                <div
                  key={rule.id}
                  className={`p-3 bg-card/60 hover:bg-card/80 border rounded-xl transition-all ${
                    rule.is_active ? 'border-border' : 'border-border/40 opacity-60'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    {/* Left: Name, conditions, target action */}
                    <div className="space-y-1.5 min-w-0">
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-semibold text-slate-100">{rule.name}</span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 border border-slate-700">
                          P{rule.priority}
                        </span>
                        {rule.match_count > 0 && (
                          <span className="text-[10px] text-slate-400 font-mono">
                            ({rule.match_count} {rule.match_count === 1 ? 'match' : 'matches'})
                          </span>
                        )}
                      </div>

                      {/* Conditions chip row */}
                      <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                        <span className="text-slate-400">If description</span>
                        <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 font-mono border border-amber-500/20 text-[10px]">
                          {rule.match_type}: "{rule.description_pattern}"
                        </span>
                        {rule.amount_equals != null && (
                          <>
                            <span className="text-slate-400">and amount is</span>
                            <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 font-mono border border-amber-500/20 text-[10px]">
                              ${Number(rule.amount_equals).toFixed(2)}
                            </span>
                          </>
                        )}
                        <ArrowRight className="w-3 h-3 text-slate-400" />
                        <span className="text-slate-400">Set</span>
                        <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-300 font-medium border border-emerald-500/20 text-[10px]">
                          {rule.target_category}
                        </span>
                        {rule.rename_merchant && (
                          <span className="text-slate-400">
                            (rename: <span className="text-slate-200">"{rule.rename_merchant}"</span>)
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Right: Toggle, Edit, Delete */}
                    <div className="flex items-center space-x-2 shrink-0 self-end sm:self-center">
                      <button
                        type="button"
                        onClick={() => handleToggleRule(rule)}
                        className={`p-1 rounded-md text-xs transition-colors ${
                          rule.is_active
                            ? 'text-emerald-400 hover:text-emerald-300'
                            : 'text-slate-500 hover:text-slate-400'
                        }`}
                        title={rule.is_active ? 'Disable Rule' : 'Enable Rule'}
                      >
                        {rule.is_active ? (
                          <CheckCircle2 className="w-4 h-4" />
                        ) : (
                          <XCircle className="w-4 h-4" />
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleOpenEditForm(rule)}
                        className="p-1 text-slate-400 hover:text-slate-200 transition-colors"
                        title="Edit Rule"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteRule(rule)}
                        className="p-1 text-slate-400 hover:text-rose-400 transition-colors"
                        title="Delete Rule"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
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
