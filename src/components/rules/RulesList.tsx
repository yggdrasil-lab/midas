import React, { useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
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

/**
 * Displays configured categorization rules with inline enable/disable,
 * edit, and ConfirmActionBox-guarded deletion.
 */
export const RulesList: React.FC<RulesListProps> = ({
  rules,
  loading,
  hasRules,
  isFormOpen,
  hasSearchQuery,
  onCreateClick,
  onEdit,
  onToggle,
  onDelete,
}) => {
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  if (loading && !hasRules) {
    return <LoadingState label="Loading rules..." variant="amber" />;
  }

  if (rules.length === 0) {
    return (
      <EmptyState
        title={
          hasSearchQuery
            ? 'No categorization rules match your search query.'
            : 'No categorization rules configured yet.'
        }
        variant="dashed"
        action={
          !isFormOpen ? (
            <Button
              variant="outline"
              size="xs"
              icon={<Plus className="w-3 h-3 text-amber-400" />}
              onClick={onCreateClick}
            >
              Create First Rule
            </Button>
          ) : undefined
        }
      />
    );
  }

  return (
    <div className="space-y-2.5 max-h-[50vh] overflow-y-auto pr-1">
      {rules.map((rule) => {
        const isConfirming = confirmDeleteId === rule.id;
        return (
          <div
            key={rule.id}
            className={`p-3 bg-card/60 hover:bg-card/80 border rounded-xl space-y-2.5 transition-all ${
              rule.is_active ? 'border-border' : 'border-border/40 opacity-60'
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
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

                <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                  <span className="text-slate-400">If description</span>
                  <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 font-mono border border-amber-500/20 text-[10px]">
                    {rule.match_type}: &quot;{rule.description_pattern}&quot;
                  </span>
                  {rule.amount_equals != null && (
                    <>
                      <span className="text-slate-400">and amount is</span>
                      <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 font-mono border border-amber-500/20 text-[10px]">
                        {formatMoney(Number(rule.amount_equals), {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
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
                      (rename:{' '}
                      <span className="text-slate-200">&quot;{rule.rename_merchant}&quot;</span>)
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center space-x-2 shrink-0 self-end sm:self-center">
                <button
                  type="button"
                  onClick={() => onToggle(rule)}
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
                  onClick={() => onEdit(rule)}
                  className="p-1 text-slate-400 hover:text-slate-200 transition-colors"
                  title="Edit Rule"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>

                <button
                  type="button"
                  onClick={() => setConfirmDeleteId(isConfirming ? null : rule.id)}
                  className="p-1 text-slate-400 hover:text-rose-400 transition-colors"
                  title="Delete Rule"
                >
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
                loading={deletingId === rule.id}
                onCancel={() => setConfirmDeleteId(null)}
                onConfirm={async () => {
                  setDeletingId(rule.id);
                  try {
                    await onDelete(rule);
                    setConfirmDeleteId(null);
                  } finally {
                    setDeletingId(null);
                  }
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
};
