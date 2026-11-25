import React, { useEffect, useState } from 'react';
import { Play, Plus } from 'lucide-react';
import { AlertBanner, Button, Modal, SearchInput } from '@yggdrasil-lab/ui';
import {
  applyAllRules,
  createRule,
  deleteRule,
  fetchAccounts,
  fetchLoans,
  fetchRules,
  updateRule,
} from '../transport';
import { parseRuleTagsCsv } from '../ledger';
import { Account, CategorizationRule, CategorizationRuleCreate, LoanItem } from '../types';
import { DEFAULT_RULE_DRAFT, RuleEditorForm, RuleFormDraft } from './rules/RuleEditorForm';
import { RulesList } from './rules/RulesList';

interface RulesManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRulesApplied?: () => void;
  prefillRule?: Partial<CategorizationRuleCreate> | null;
}

function draftFromPrefill(prefill: Partial<CategorizationRuleCreate>): RuleFormDraft {
  return {
    name: prefill.name || '',
    descriptionPattern: prefill.description_pattern || '',
    matchType: prefill.match_type || 'contains',
    amountEquals: prefill.amount_equals != null ? String(prefill.amount_equals) : '',
    minAmount: prefill.min_amount != null ? String(prefill.min_amount) : '',
    maxAmount: prefill.max_amount != null ? String(prefill.max_amount) : '',
    direction: prefill.direction || '',
    targetCategory: prefill.target_category || 'General',
    targetTags: (prefill.target_tags || []).join(', '),
    targetRecurrence: prefill.target_recurrence || '',
    renameMerchant: prefill.rename_merchant || '',
    counterpartAccountId: prefill.counterpart_account_id != null ? String(prefill.counterpart_account_id) : '',
    loanId: prefill.loan_id != null ? String(prefill.loan_id) : '',
    priority: prefill.priority || 10,
    applyRetroactively: prefill.apply_retroactively !== false,
  };
}

function draftFromRule(rule: CategorizationRule): RuleFormDraft {
  return {
    name: rule.name,
    descriptionPattern: rule.description_pattern,
    matchType: rule.match_type,
    amountEquals: rule.amount_equals != null ? String(rule.amount_equals) : '',
    minAmount: rule.min_amount != null ? String(rule.min_amount) : '',
    maxAmount: rule.max_amount != null ? String(rule.max_amount) : '',
    direction: rule.direction || '',
    targetCategory: rule.target_category,
    targetTags: (rule.target_tags || []).join(', '),
    targetRecurrence: rule.target_recurrence || '',
    renameMerchant: rule.rename_merchant || '',
    counterpartAccountId: rule.counterpart_account_id != null ? String(rule.counterpart_account_id) : '',
    loanId: rule.loan_id != null ? String(rule.loan_id) : '',
    priority: rule.priority,
    applyRetroactively: true,
  };
}

function buildRulePayload(
  draft: RuleFormDraft,
  setError: (msg: string | null) => void
): CategorizationRuleCreate | null {
  if (!draft.name.trim() || !draft.descriptionPattern.trim() || !draft.targetCategory.trim()) {
    setError('Rule name, description pattern, and target category are required.');
    return null;
  }
  const num = parseFloat(draft.amountEquals.trim());
  const minNum = draft.minAmount.trim() !== '' ? parseFloat(draft.minAmount.trim()) : NaN;
  const maxNum = draft.maxAmount.trim() !== '' ? parseFloat(draft.maxAmount.trim()) : NaN;
  const parsedMin = !isNaN(minNum) ? Math.abs(minNum) : null;
  const parsedMax = !isNaN(maxNum) ? Math.abs(maxNum) : null;
  if (parsedMin !== null && parsedMax !== null && parsedMin > parsedMax) {
    setError('Min amount must be less than or equal to max amount.');
    return null;
  }

  const counterpartNum = draft.counterpartAccountId.trim() !== '' ? parseInt(draft.counterpartAccountId.trim(), 10) : NaN;
  const loanIdNum = draft.loanId.trim() !== '' ? parseInt(draft.loanId.trim(), 10) : NaN;

  return {
    name: draft.name.trim(),
    description_pattern: draft.descriptionPattern.trim(),
    match_type: draft.matchType,
    amount_equals: !isNaN(num) && num > 0 ? Math.abs(num) : null,
    min_amount: parsedMin,
    max_amount: parsedMax,
    direction: draft.direction || null,
    target_category: draft.targetCategory.trim(),
    target_tags: parseRuleTagsCsv(draft.targetTags),
    target_recurrence: draft.targetRecurrence || null,
    rename_merchant: draft.renameMerchant.trim() || null,
    counterpart_account_id: !isNaN(counterpartNum) ? counterpartNum : null,
    loan_id: !isNaN(loanIdNum) ? loanIdNum : null,
    priority: draft.priority,
    apply_retroactively: draft.applyRetroactively,
  };
}

function useRuleMutations(opts: {
  draft: RuleFormDraft;
  editingRuleId: number | null;
  loadRules: () => Promise<void>;
  onRulesApplied?: () => void;
  setters: {
    setRules: React.Dispatch<React.SetStateAction<CategorizationRule[]>>;
    setError: (v: string | null) => void;
    setStatusMsg: (v: string | null) => void;
    setIsSaving: (v: boolean) => void;
    setIsFormOpen: (v: boolean) => void;
    setEditingRuleId: (v: number | null) => void;
    setIsApplyingAll: (v: boolean) => void;
  };
}) {
  const { setters } = opts;

  const handleSaveRule = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = buildRulePayload(opts.draft, setters.setError);
    if (!payload) return;
    setters.setIsSaving(true); setters.setError(null); setters.setStatusMsg(null);
    try {
      if (opts.editingRuleId) {
        await updateRule(opts.editingRuleId, payload);
        setters.setStatusMsg(`Updated rule "${payload.name}"`);
      } else {
        await createRule({ ...payload, is_active: true });
        setters.setStatusMsg(`Created rule "${payload.name}"`);
      }
      setters.setIsFormOpen(false);
      setters.setEditingRuleId(null);
      await opts.loadRules();
      opts.onRulesApplied?.();
    } catch (err) {
      setters.setError(err instanceof Error ? err.message : 'Failed to save categorization rule');
    } finally { setters.setIsSaving(false); }
  };

  const handleToggleRule = async (rule: CategorizationRule) => {
    setters.setError(null);
    try {
      await updateRule(rule.id, { is_active: !rule.is_active });
      setters.setRules((prev) => prev.map((r) => (r.id === rule.id ? { ...r, is_active: !rule.is_active } : r)));
      setters.setStatusMsg(`Rule "${rule.name}" is now ${!rule.is_active ? 'active' : 'inactive'}`);
      opts.onRulesApplied?.();
    } catch (err) { setters.setError(err instanceof Error ? err.message : 'Failed to toggle rule state'); }
  };

  const handleDeleteRule = async (rule: CategorizationRule) => {
    setters.setError(null);
    try {
      await deleteRule(rule.id);
      setters.setRules((prev) => prev.filter((r) => r.id !== rule.id));
      setters.setStatusMsg(`Deleted rule "${rule.name}"`);
      opts.onRulesApplied?.();
    } catch (err) { setters.setError(err instanceof Error ? err.message : 'Failed to delete rule'); }
  };

  const handleApplyAll = async () => {
    setters.setIsApplyingAll(true); setters.setError(null); setters.setStatusMsg(null);
    try {
      const res = await applyAllRules();
      const itemNote = res.receipt_items_updated !== undefined ? ` and ${res.receipt_items_updated} of ${res.receipt_items_evaluated ?? 0} receipt items` : '';
      setters.setStatusMsg(`Evaluated ${res.evaluated} transactions (${res.updated} updated)${itemNote}.`);
      await opts.loadRules();
      opts.onRulesApplied?.();
    } catch (err) {
      setters.setError(err instanceof Error ? err.message : 'Failed to run categorization rules');
    } finally { setters.setIsApplyingAll(false); }
  };

  return { handleSaveRule, handleToggleRule, handleDeleteRule, handleApplyAll };
}

function useRulesManagerState(
  isOpen: boolean,
  prefillRule: Partial<CategorizationRuleCreate> | null | undefined,
  onRulesApplied?: () => void
) {
  const [rules, setRules] = useState<CategorizationRule[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loans, setLoans] = useState<LoanItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingRuleId, setEditingRuleId] = useState<number | null>(null);
  const [draft, setDraft] = useState<RuleFormDraft>(DEFAULT_RULE_DRAFT);
  const [isSaving, setIsSaving] = useState(false);
  const [isApplyingAll, setIsApplyingAll] = useState(false);

  const loadRules = async () => {
    setLoading(true);
    setError(null);
    try {
      const [rulesRes, accountsRes, loansRes] = await Promise.all([fetchRules(), fetchAccounts(), fetchLoans().catch(() => null)]);
      setRules(rulesRes); setAccounts(accountsRes); setLoans(loansRes?.loans || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load categorization rules');
    } finally { setLoading(false); }
  };

  useEffect(() => {
    if (isOpen) {
      void loadRules();
      if (prefillRule) { setDraft(draftFromPrefill(prefillRule)); setEditingRuleId(null); setIsFormOpen(true); }
      return;
    }
    setIsFormOpen(false); setEditingRuleId(null); setStatusMsg(null);
  }, [isOpen, prefillRule]);

  const mutations = useRuleMutations({
    draft, editingRuleId, loadRules, onRulesApplied,
    setters: { setRules, setError, setStatusMsg, setIsSaving, setIsFormOpen, setEditingRuleId, setIsApplyingAll },
  });

  return {
    rules, accounts, loans, loading, error, statusMsg, setStatusMsg,
    searchQuery, setSearchQuery, isFormOpen, setIsFormOpen, editingRuleId, setEditingRuleId,
    draft, setDraft, isSaving, isApplyingAll, ...mutations,
  };
}

function matchesRuleSearch(r: CategorizationRule, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    r.name.toLowerCase().includes(q) ||
    r.description_pattern.toLowerCase().includes(q) ||
    r.target_category.toLowerCase().includes(q) ||
    Boolean(r.direction?.toLowerCase().includes(q)) ||
    Boolean(r.rename_merchant?.toLowerCase().includes(q)) ||
    Boolean(r.counterpart_account_name?.toLowerCase().includes(q)) ||
    Boolean(r.loan_name?.toLowerCase().includes(q))
  );
}

const RulesManagerToolbar: React.FC<{
  hasRules: boolean;
  isApplyingAll: boolean;
  onNewRule: () => void;
  onApplyAll: () => void;
}> = ({ hasRules, isApplyingAll, onNewRule, onApplyAll }) => (
  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
    <p className="text-xs text-slate-300">
      Define custom pattern and amount rules to automatically categorize transactions and rename merchants.
    </p>
    <div className="flex items-center space-x-2 shrink-0">
      <Button variant="primary" size="xs" icon={<Plus className="w-3.5 h-3.5" />} onClick={onNewRule}>
        New Rule
      </Button>
      <Button variant="outline" size="xs" icon={<Play className={`w-3.5 h-3.5 text-amber-400 ${isApplyingAll ? 'animate-spin' : ''}`} />} onClick={onApplyAll} disabled={isApplyingAll || !hasRules}>
        Run Rules
      </Button>
    </div>
  </div>
);

/**
 * Modal for creating, editing, toggling, deleting, and running Outlook-style
 * categorization rules across transactions.
 */
export const RulesManagerModal: React.FC<RulesManagerModalProps> = ({ isOpen, onClose, onRulesApplied, prefillRule }) => {
  const s = useRulesManagerState(isOpen, prefillRule, onRulesApplied);
  const filteredRules = s.rules.filter((r) => matchesRuleSearch(r, s.searchQuery));

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Outlook-Style Categorization Rules"
      footer={<div className="flex justify-end"><Button variant="outline" size="sm" onClick={onClose}>Done</Button></div>}
    >
      <div className="space-y-4">
        {!s.isFormOpen && (
          <RulesManagerToolbar
            hasRules={s.rules.length > 0}
            isApplyingAll={s.isApplyingAll}
            onNewRule={() => { s.setEditingRuleId(null); s.setDraft(DEFAULT_RULE_DRAFT); s.setIsFormOpen(true); s.setStatusMsg(null); }}
            onApplyAll={() => void s.handleApplyAll()}
          />
        )}
        {s.error && <AlertBanner variant="error">{s.error}</AlertBanner>}
        {s.statusMsg && <AlertBanner variant="success">{s.statusMsg}</AlertBanner>}
        {s.isFormOpen && (
          <RuleEditorForm
            draft={s.draft} accounts={s.accounts} loans={s.loans} isEditing={Boolean(s.editingRuleId)} saving={s.isSaving}
            onChange={s.setDraft} onSubmit={(e) => void s.handleSaveRule(e)} onCancel={() => { s.setIsFormOpen(false); s.setEditingRuleId(null); }}
          />
        )}
        {s.rules.length > 0 && !s.isFormOpen && (
          <SearchInput value={s.searchQuery} onChange={s.setSearchQuery} placeholder="Search rules by pattern, category, or merchant..." variant="brand" />
        )}
        <RulesList
          rules={filteredRules} loading={s.loading} hasRules={s.rules.length > 0} isFormOpen={s.isFormOpen} hasSearchQuery={Boolean(s.searchQuery.trim())}
          onCreateClick={() => { s.setEditingRuleId(null); s.setDraft(DEFAULT_RULE_DRAFT); s.setIsFormOpen(true); s.setStatusMsg(null); }}
          onEdit={(rule) => { s.setEditingRuleId(rule.id); s.setDraft(draftFromRule(rule)); s.setIsFormOpen(true); s.setStatusMsg(null); }}
          onToggle={s.handleToggleRule} onDelete={s.handleDeleteRule}
        />
      </div>
    </Modal>
  );
};
