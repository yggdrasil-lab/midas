import React, { useEffect, useState } from 'react';
import { Check, Play, Plus } from 'lucide-react';
import { AlertBanner, Button, Modal, SearchInput } from '@yggdrasil-lab/ui';
import {
  applyAllRules,
  createRule,
  deleteRule,
  fetchAccounts,
  fetchLoans,
  fetchRules,
  updateRule,
} from '../services/api';
import { Account, CategorizationRule, CategorizationRuleCreate, LoanItem } from '../types';
import {
  DEFAULT_RULE_DRAFT,
  RuleEditorForm,
  RuleFormDraft,
} from './rules/RuleEditorForm';
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
    amountEquals:
      prefill.amount_equals !== undefined && prefill.amount_equals !== null
        ? String(prefill.amount_equals)
        : '',
    minAmount:
      prefill.min_amount !== undefined && prefill.min_amount !== null
        ? String(prefill.min_amount)
        : '',
    maxAmount:
      prefill.max_amount !== undefined && prefill.max_amount !== null
        ? String(prefill.max_amount)
        : '',
    direction: prefill.direction || '',
    targetCategory: prefill.target_category || 'General',
    targetTags: (prefill.target_tags || []).join(', '),
    targetRecurrence: prefill.target_recurrence || '',
    renameMerchant: prefill.rename_merchant || '',
    counterpartAccountId:
      prefill.counterpart_account_id !== undefined && prefill.counterpart_account_id !== null
        ? String(prefill.counterpart_account_id)
        : '',
    loanId:
      prefill.loan_id !== undefined && prefill.loan_id !== null
        ? String(prefill.loan_id)
        : '',
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
    counterpartAccountId:
      rule.counterpart_account_id != null ? String(rule.counterpart_account_id) : '',
    loanId: rule.loan_id != null ? String(rule.loan_id) : '',
    priority: rule.priority,
    applyRetroactively: true,
  };
}

/**
 * Modal for creating, editing, toggling, deleting, and running Outlook-style
 * categorization rules across transactions.
 */
export const RulesManagerModal: React.FC<RulesManagerModalProps> = ({
  isOpen,
  onClose,
  onRulesApplied,
  prefillRule,
}) => {
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
      const [rulesRes, accountsRes, loansRes] = await Promise.all([
        fetchRules(),
        fetchAccounts(),
        fetchLoans().catch(() => null),
      ]);
      setRules(rulesRes);
      setAccounts(accountsRes);
      setLoans(loansRes?.loans || []);
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
        setDraft(draftFromPrefill(prefillRule));
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
    setDraft(DEFAULT_RULE_DRAFT);
    setIsFormOpen(true);
    setStatusMsg(null);
  };

  const handleOpenEditForm = (rule: CategorizationRule) => {
    setEditingRuleId(rule.id);
    setDraft(draftFromRule(rule));
    setIsFormOpen(true);
    setStatusMsg(null);
  };

  const handleSaveRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.name.trim() || !draft.descriptionPattern.trim() || !draft.targetCategory.trim()) {
      setError('Rule name, description pattern, and target category are required.');
      return;
    }

    const num = parseFloat(draft.amountEquals.trim());
    const parsedAmt = !isNaN(num) && num > 0 ? Math.abs(num) : null;
    const rawMin = draft.minAmount.trim();
    const rawMax = draft.maxAmount.trim();
    const minNum = rawMin !== '' ? parseFloat(rawMin) : NaN;
    const maxNum = rawMax !== '' ? parseFloat(rawMax) : NaN;
    const parsedMin = !isNaN(minNum) ? Math.abs(minNum) : null;
    const parsedMax = !isNaN(maxNum) ? Math.abs(maxNum) : null;

    if (parsedMin !== null && parsedMax !== null && parsedMin > parsedMax) {
      setError('Min amount must be less than or equal to max amount.');
      return;
    }

    setIsSaving(true);
    setError(null);
    setStatusMsg(null);

    const parsedTags = draft.targetTags
      .split(',')
      .map((t) => t.trim().toLowerCase().replace(/^#+/, '').replace(/\s+/g, '-'))
      .filter(Boolean);
    const rawCounterpart = draft.counterpartAccountId.trim();
    const counterpartNum = rawCounterpart !== '' ? parseInt(rawCounterpart, 10) : NaN;
    const parsedCounterpart = !isNaN(counterpartNum) ? counterpartNum : null;
    const rawLoanId = draft.loanId.trim();
    const loanIdNum = rawLoanId !== '' ? parseInt(rawLoanId, 10) : NaN;
    const parsedLoanId = !isNaN(loanIdNum) ? loanIdNum : null;
    const payload: CategorizationRuleCreate = {
      name: draft.name.trim(),
      description_pattern: draft.descriptionPattern.trim(),
      match_type: draft.matchType,
      amount_equals: parsedAmt,
      min_amount: parsedMin,
      max_amount: parsedMax,
      direction: draft.direction || null,
      target_category: draft.targetCategory.trim(),
      target_tags: Array.from(new Set(parsedTags)),
      target_recurrence: draft.targetRecurrence || null,
      rename_merchant: draft.renameMerchant.trim() || null,
      counterpart_account_id: parsedCounterpart,
      loan_id: parsedLoanId,
      priority: draft.priority,
      apply_retroactively: draft.applyRetroactively,
    };

    try {
      if (editingRuleId) {
        await updateRule(editingRuleId, payload);
        setStatusMsg(`Updated rule "${payload.name}"`);
      } else {
        await createRule({ ...payload, is_active: true });
        setStatusMsg(`Created rule "${payload.name}"`);
      }
      setIsFormOpen(false);
      setEditingRuleId(null);
      await loadRules();
      onRulesApplied?.();
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
      await updateRule(rule.id, { is_active: !rule.is_active });
      setRules((prev) =>
        prev.map((r) => (r.id === rule.id ? { ...r, is_active: !rule.is_active } : r))
      );
      setStatusMsg(`Rule "${rule.name}" is now ${!rule.is_active ? 'active' : 'inactive'}`);
      onRulesApplied?.();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to toggle rule state');
    }
  };

  const handleDeleteRule = async (rule: CategorizationRule) => {
    setError(null);
    try {
      await deleteRule(rule.id);
      setRules((prev) => prev.filter((r) => r.id !== rule.id));
      setStatusMsg(`Deleted rule "${rule.name}"`);
      onRulesApplied?.();
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
      const itemNote =
        res.receipt_items_updated !== undefined
          ? ` and ${res.receipt_items_updated} of ${res.receipt_items_evaluated ?? 0} receipt items`
          : '';
      setStatusMsg(
        `Evaluated ${res.evaluated} transactions (${res.updated} updated)${itemNote}.`
      );
      await loadRules();
      onRulesApplied?.();
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
      (r.direction && r.direction.toLowerCase().includes(q)) ||
      (r.rename_merchant && r.rename_merchant.toLowerCase().includes(q)) ||
      (r.counterpart_account_name && r.counterpart_account_name.toLowerCase().includes(q)) ||
      (r.loan_name && r.loan_name.toLowerCase().includes(q))
    );
  });

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Outlook-Style Categorization Rules">
      <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
        {!isFormOpen && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <p className="text-xs text-slate-300">
              Define custom pattern and amount rules to automatically categorize transactions and rename merchants.
            </p>
            <div className="flex items-center space-x-2 shrink-0">
              <Button
                variant="primary"
                size="xs"
                icon={<Plus className="w-3.5 h-3.5" />}
                onClick={handleOpenCreateForm}
              >
                New Rule
              </Button>
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
        )}

        {error && <AlertBanner variant="error">{error}</AlertBanner>}
        {statusMsg && (
          <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-xs text-emerald-300 flex items-center space-x-2 animate-in fade-in">
            <Check className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
            <span>{statusMsg}</span>
          </div>
        )}

        {isFormOpen && (
          <RuleEditorForm
            draft={draft}
            accounts={accounts}
            loans={loans}
            isEditing={Boolean(editingRuleId)}
            saving={isSaving}
            onChange={setDraft}
            onSubmit={handleSaveRule}
            onCancel={() => {
              setIsFormOpen(false);
              setEditingRuleId(null);
            }}
          />
        )}

        {rules.length > 0 && !isFormOpen && (
          <SearchInput
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search rules by pattern, category, or merchant..."
            variant="amber"
          />
        )}

        <RulesList
          rules={filteredRules}
          loading={loading}
          hasRules={rules.length > 0}
          isFormOpen={isFormOpen}
          hasSearchQuery={Boolean(searchQuery.trim())}
          onCreateClick={handleOpenCreateForm}
          onEdit={handleOpenEditForm}
          onToggle={handleToggleRule}
          onDelete={handleDeleteRule}
        />

        <div className="pt-2 flex justify-end">
          <Button variant="outline" size="sm" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </Modal>
  );
};
