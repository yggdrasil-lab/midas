import React, { useState } from 'react';
import {
  ArrowRight,
  ArrowRightLeft,
  Car,
  CheckCircle2,
  Landmark,
  Pencil,
  Plus,
  Trash2,
  XCircle,
} from 'lucide-react';
import {
  Button,
  ConfirmActionBox,
  EmptyState,
  LoadingState,
} from '@yggdrasil-lab/ui';
import { CategorizationRule } from '../../types';
import { formatMoney } from '../../utils/format';

interface RulesListProps {
  rules: CategorizationRule[];
  loading: boolean;
  hasRules: boolean;
  isFormOpen: boolean;
  hasSearchQuery: boolean;
  onCreateClick: () => void;
  onEdit: (rule: CategorizationRule) => void;
  onToggle: (rule: CategorizationRule) => void;
  onDelete: (rule: CategorizationRule) => Promise<void>;
}

function formatAmountRange(min?: number | null, max?: number | null): string | null {
  const hasMin = min !== undefined && min !== null;
  const hasMax = max !== undefined && max !== null;
  if (!hasMin && !hasMax) return null;
  const fmt = (val: number) =>
    formatMoney(Number(val), {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  if (hasMin && hasMax) {
    return `${fmt(min)} - ${fmt(max)}`;
  }
  if (hasMin) {
    return `>= ${fmt(min)}`;
  }
  return `<= ${fmt(max as number)}`;
}

const CounterpartPill: React.FC<{ rule: CategorizationRule }> = ({ rule }) => {
  if (!rule.counterpart_account_name) return null;
  const catLower = rule.target_category.trim().toLowerCase();
  const isTransferTarget = catLower === 'transfers' || catLower === 'transfer';
  const pillColors = isTransferTarget
    ? 'bg-sky-500/10 text-sky-300 border-sky-500/25'
    : rule.direction === 'outflow'
      ? 'bg-amber-500/10 text-amber-300 border-amber-500/25'
      : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/25';
  const text = isTransferTarget
    ? rule.counterpart_account_name
    : rule.direction === 'outflow'
      ? `to ${rule.counterpart_account_name}`
      : `from ${rule.counterpart_account_name}`;

  return (
    <span
      data-testid={`rule-counterpart-pill-${rule.id}`}
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-medium ${pillColors}`}
      title={isTransferTarget ? 'Auto-mirrors linked transfer leg to counterpart account' : 'Counterpart account flow attribution'}
    >
      {isTransferTarget ? <ArrowRightLeft className="w-2.5 h-2.5 shrink-0" /> : <Landmark className="w-2.5 h-2.5 shrink-0" />}
      <span>{text}</span>
    </span>
  );
};

const LoanTargetBadge: React.FC<{ rule: CategorizationRule }> = ({ rule }) => {
  if (!rule.loan_name) return null;
  const isLent = rule.loan_type === 'lent';
  return (
    <span
      data-testid={`rule-loan-badge-${rule.id}`}
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-medium ${
        isLent ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/25' : 'bg-rose-500/10 text-rose-300 border-rose-500/25'
      }`}
      title={isLent ? 'Automatically links matching Debt & Loans transactions to this receivable loan' : 'Automatically links matching outflow transactions to this financing loan'}
    >
      {isLent ? <Landmark className="w-2.5 h-2.5 shrink-0" /> : <Car className="w-2.5 h-2.5 shrink-0" />}
      <span>{isLent ? `<-> ${rule.loan_name}` : `-> ${rule.loan_name}`}</span>
    </span>
  );
};

const RuleConditionStrip: React.FC<{ rule: CategorizationRule; rangeLabel: string | null }> = ({ rule, rangeLabel }) => (
  <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
    <span className="text-slate-400">If description</span>
    <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 font-mono border border-amber-500/20 text-[10px]">
      {rule.match_type}: &quot;{rule.description_pattern}&quot;
    </span>
    {rule.amount_equals != null && (
      <>
        <span className="text-slate-400">and amount is</span>
        <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 font-mono border border-amber-500/20 text-[10px]">
          {formatMoney(Number(rule.amount_equals), { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      </>
    )}
    {Boolean(rangeLabel) && (
      <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 font-mono border border-amber-500/20 text-[10px]" data-testid={`rule-range-badge-${rule.id}`}>
        {rangeLabel}
      </span>
    )}
    {Boolean(rule.direction) && (
      <span
        className={`px-1.5 py-0.5 rounded border text-[10px] font-medium ${
          rule.direction === 'outflow' ? 'bg-rose-500/10 text-rose-300 border-rose-500/20' : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
        }`}
        data-testid={`rule-direction-badge-${rule.id}`}
      >
        {rule.direction === 'outflow' ? 'Outflow' : 'Inflow'}
      </span>
    )}
    <ArrowRight className="w-3 h-3 text-slate-400" />
    <span className="text-slate-400">Set</span>
    <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-300 font-medium border border-emerald-500/20 text-[10px]">
      {rule.target_category}
    </span>
    <CounterpartPill rule={rule} />
    <LoanTargetBadge rule={rule} />
    {(rule.target_tags || []).map((tag) => (
      <span key={tag} className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20 text-[10px] font-medium">
        #{tag}
      </span>
    ))}
    {Boolean(rule.target_recurrence) && (
      <span className="px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-300 border border-sky-500/20 text-[10px] font-medium">
        {rule.target_recurrence}
      </span>
    )}
    {Boolean(rule.rename_merchant) && (
      <span className="text-slate-400">
        (rename: <span className="text-slate-200">&quot;{rule.rename_merchant}&quot;</span>)
      </span>
    )}
  </div>
);

const RuleRowCard: React.FC<{
  rule: CategorizationRule;
  isConfirming: boolean;
  isDeleting: boolean;
  onEdit: () => void;
  onToggle: () => void;
  onToggleConfirm: () => void;
  onCancelDelete: () => void;
  onConfirmDelete: () => Promise<void>;
}> = ({ rule, isConfirming, isDeleting, onEdit, onToggle, onToggleConfirm, onCancelDelete, onConfirmDelete }) => (
  <div
    data-testid={`rule-row-${rule.id}`}
    className={`p-3 bg-card/60 hover:bg-card/80 border rounded-xl space-y-2.5 transition-all ${
      rule.is_active ? 'border-border' : 'border-border/40 opacity-60'
    }`}
  >
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
      <div className="space-y-1.5 min-w-0">
        <div className="flex items-center space-x-2">
          <span className="text-xs font-semibold text-slate-100">{rule.name}</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 border border-slate-700">P{rule.priority}</span>
          {rule.match_count > 0 && (
            <span className="text-[10px] text-slate-400 font-mono">
              ({rule.match_count} {rule.match_count === 1 ? 'match' : 'matches'})
            </span>
          )}
        </div>
        <RuleConditionStrip rule={rule} rangeLabel={formatAmountRange(rule.min_amount, rule.max_amount)} />
      </div>
      <div className="flex items-center space-x-2 shrink-0 self-end sm:self-center">
        <button
          type="button"
          onClick={onToggle}
          className={`p-1 rounded-md text-xs transition-colors ${rule.is_active ? 'text-emerald-400 hover:text-emerald-300' : 'text-slate-500 hover:text-slate-400'}`}
          title={rule.is_active ? 'Disable Rule' : 'Enable Rule'}
        >
          {rule.is_active ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
        </button>
        <button type="button" onClick={onEdit} data-testid={`edit-rule-${rule.id}`} className="p-1 text-slate-400 hover:text-slate-200 transition-colors" title="Edit Rule">
          <Pencil className="w-3.5 h-3.5" />
        </button>
        <button type="button" onClick={onToggleConfirm} className="p-1 text-slate-400 hover:text-rose-400 transition-colors" title="Delete Rule">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
    {isConfirming && (
      <ConfirmActionBox
        variant="danger"
        title={`Delete rule "${rule.name}"?`}
        description="Historical transactions keep their current category, but future statements will no longer match this rule."
        confirmLabel="Delete Rule"
        cancelLabel="Cancel"
        loading={isDeleting}
        onCancel={onCancelDelete}
        onConfirm={onConfirmDelete}
      />
    )}
  </div>
);

/**
 * Displays configured categorization rules with inline enable/disable,
 * edit, and ConfirmActionBox-guarded deletion.
 */
export const RulesList: React.FC<RulesListProps> = ({
  rules, loading, hasRules, isFormOpen, hasSearchQuery, onCreateClick, onEdit, onToggle, onDelete,
}) => {
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  if (loading && !hasRules) return <LoadingState label="Loading rules..." variant="brand" />;
  if (rules.length === 0) {
    return (
      <EmptyState
        title={hasSearchQuery ? 'No categorization rules match your search query.' : 'No categorization rules configured yet.'}
        variant="dashed"
        action={!isFormOpen ? <Button variant="outline" size="xs" icon={<Plus className="w-3 h-3 text-amber-400" />} onClick={onCreateClick}>Create First Rule</Button> : undefined}
      />
    );
  }

  return (
    <div className="space-y-2.5 max-h-[50vh] overflow-y-auto pr-1">
      {rules.map((rule) => (
        <RuleRowCard
          key={rule.id}
          rule={rule}
          isConfirming={confirmDeleteId === rule.id}
          isDeleting={deletingId === rule.id}
          onEdit={() => onEdit(rule)}
          onToggle={() => onToggle(rule)}
          onToggleConfirm={() => setConfirmDeleteId(confirmDeleteId === rule.id ? null : rule.id)}
          onCancelDelete={() => setConfirmDeleteId(null)}
          onConfirmDelete={async () => {
            setDeletingId(rule.id);
            try { await onDelete(rule); setConfirmDeleteId(null); } finally { setDeletingId(null); }
          }}
        />
      ))}
    </div>
  );
};
