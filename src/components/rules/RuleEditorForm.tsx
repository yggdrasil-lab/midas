import React from 'react';
import { Check, RefreshCw, SlidersHorizontal } from 'lucide-react';
import { Button } from '@yggdrasil-lab/ui';
import { RECURRENCE_OPTIONS } from '../../constants/categories';
import { useCategories } from '../../hooks/useCategories';
import { RecurrenceType, RuleDirection } from '../../types';

export interface RuleFormDraft {
  name: string;
  descriptionPattern: string;
  matchType: 'contains' | 'exact' | 'starts_with';
  amountEquals: string;
  minAmount: string;
  maxAmount: string;
  direction: RuleDirection | '';
  targetCategory: string;
  targetTags: string;
  targetRecurrence: RecurrenceType | '';
  renameMerchant: string;
  priority: number;
  applyRetroactively: boolean;
}

export const DEFAULT_RULE_DRAFT: RuleFormDraft = {
  name: '',
  descriptionPattern: '',
  matchType: 'contains',
  amountEquals: '',
  minAmount: '',
  maxAmount: '',
  direction: '',
  targetCategory: 'General',
  targetTags: '',
  targetRecurrence: '',
  renameMerchant: '',
  priority: 10,
  applyRetroactively: true,
};

interface RuleEditorFormProps {
  draft: RuleFormDraft;
  isEditing: boolean;
  saving: boolean;
  onChange: (updater: (prev: RuleFormDraft) => RuleFormDraft) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
}

/**
 * Form for creating or updating an Outlook-style transaction categorization rule.
 */
export const RuleEditorForm: React.FC<RuleEditorFormProps> = ({
  draft,
  isEditing,
  saving,
  onChange,
  onSubmit,
  onCancel,
}) => {
  const { categoryNames } = useCategories();
  const selectableCategories =
    !draft.targetCategory || categoryNames.includes(draft.targetCategory)
      ? categoryNames
      : [draft.targetCategory, ...categoryNames];

  const updateField = <K extends keyof RuleFormDraft>(key: K, value: RuleFormDraft[K]) => {
    onChange((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <form
      onSubmit={onSubmit}
      className="p-3 bg-card/80 border border-amber-500/40 rounded-xl space-y-2.5 animate-in fade-in"
    >
      <div className="flex items-center justify-between border-b border-border/60 pb-2">
        <span className="text-xs font-semibold text-amber-300 flex items-center space-x-1.5">
          <SlidersHorizontal className="w-3.5 h-3.5" />
          <span>{isEditing ? 'Edit Rule' : 'Create Outlook-Style Rule'}</span>
        </span>
        <button
          type="button"
          onClick={onCancel}
          className="text-[11px] text-slate-400 hover:text-slate-200"
        >
          Cancel
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <div>
          <label className="text-[11px] text-slate-300 block mb-1">Rule Name</label>
          <input
            type="text"
            required
            placeholder="e.g. Regular Utilities Transfer"
            value={draft.name}
            onChange={(e) => updateField('name', e.target.value)}
            data-testid="rule-name-input"
            className="w-full text-xs px-2.5 py-1.5 bg-background border border-border rounded-lg text-slate-200 focus:outline-none focus:border-amber-500"
          />
        </div>

        <div>
          <label className="text-[11px] text-slate-300 block mb-1">
            Priority <span className="text-slate-400">(lower runs first)</span>
          </label>
          <input
            type="number"
            min="1"
            max="100"
            value={draft.priority}
            onChange={(e) => updateField('priority', parseInt(e.target.value, 10) || 10)}
            className="w-full text-xs px-2.5 py-1.5 bg-background border border-border rounded-lg text-slate-200 focus:outline-none focus:border-amber-500"
          />
        </div>

        <div>
          <label className="text-[11px] text-slate-300 block mb-1">Description Pattern</label>
          <input
            type="text"
            required
            placeholder="e.g. 12-0323 or WISE"
            value={draft.descriptionPattern}
            onChange={(e) => updateField('descriptionPattern', e.target.value)}
            data-testid="rule-pattern-input"
            className="w-full text-xs px-2.5 py-1.5 bg-background border border-border rounded-lg text-slate-200 focus:outline-none focus:border-amber-500 font-mono"
          />
        </div>

        <div>
          <label className="text-[11px] text-slate-300 block mb-1">Pattern Match Type</label>
          <select
            value={draft.matchType}
            onChange={(e) =>
              updateField('matchType', e.target.value as RuleFormDraft['matchType'])
            }
            className="w-full text-xs px-2.5 py-1.5 bg-background border border-border rounded-lg text-slate-200 focus:outline-none focus:border-amber-500"
          >
            <option value="contains">Contains</option>
            <option value="starts_with">Starts with</option>
            <option value="exact">Exact match</option>
          </select>
        </div>

        <div>
          <label className="text-[11px] text-slate-300 block mb-1">
            Exact Amount ($){' '}
            <span className="text-slate-400">(optional)</span>
          </label>
          <div className="relative">
            <span className="absolute left-2.5 top-1.5 text-xs text-slate-400">$</span>
            <input
              type="number"
              step="0.01"
              min="0"
              placeholder="e.g. 400.00"
              value={draft.amountEquals}
              onChange={(e) => updateField('amountEquals', e.target.value)}
              data-testid="rule-amount-equals-input"
              className="w-full text-xs pl-6 pr-2.5 py-1.5 bg-background border border-border rounded-lg text-slate-200 focus:outline-none focus:border-amber-500 font-mono"
            />
          </div>
        </div>

        <div>
          <label className="text-[11px] text-slate-300 block mb-1">
            Direction <span className="text-slate-400">(optional)</span>
          </label>
          <select
            aria-label="Direction"
            value={draft.direction}
            onChange={(e) =>
              updateField('direction', e.target.value as RuleFormDraft['direction'])
            }
            data-testid="rule-direction-select"
            className="w-full text-xs px-2.5 py-1.5 bg-background border border-border rounded-lg text-slate-200 focus:outline-none focus:border-amber-500"
          >
            <option value="">Any</option>
            <option value="outflow">Outflow</option>
            <option value="inflow">Inflow</option>
          </select>
        </div>

        <div className="sm:col-span-2 grid grid-cols-2 gap-2.5">
          <div>
            <label className="text-[11px] text-slate-300 block mb-1">
              Min Amount ($)
            </label>
            <div className="relative">
              <span className="absolute left-2.5 top-1.5 text-xs text-slate-400">$</span>
              <input
                type="number"
                step="0.01"
                min="0"
                aria-label="Min Amount ($)"
                placeholder="e.g. 30.00"
                value={draft.minAmount}
                onChange={(e) => updateField('minAmount', e.target.value)}
                data-testid="rule-min-amount-input"
                className="w-full text-xs pl-6 pr-2.5 py-1.5 bg-background border border-border rounded-lg text-slate-200 focus:outline-none focus:border-amber-500 font-mono"
              />
            </div>
          </div>

          <div>
            <label className="text-[11px] text-slate-300 block mb-1">
              Max Amount ($)
            </label>
            <div className="relative">
              <span className="absolute left-2.5 top-1.5 text-xs text-slate-400">$</span>
              <input
                type="number"
                step="0.01"
                min="0"
                aria-label="Max Amount ($)"
                placeholder="e.g. 29.99"
                value={draft.maxAmount}
                onChange={(e) => updateField('maxAmount', e.target.value)}
                data-testid="rule-max-amount-input"
                className="w-full text-xs pl-6 pr-2.5 py-1.5 bg-background border border-border rounded-lg text-slate-200 focus:outline-none focus:border-amber-500 font-mono"
              />
            </div>
          </div>
        </div>

        <div>
          <label className="text-[11px] text-slate-300 block mb-1">Target Category</label>
          <select
            value={draft.targetCategory}
            onChange={(e) => updateField('targetCategory', e.target.value)}
            data-testid="rule-category-select"
            className="w-full text-xs px-2.5 py-1.5 bg-background border border-border rounded-lg text-slate-200 focus:outline-none focus:border-amber-500"
          >
            {selectableCategories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-[11px] text-slate-300 block mb-1">
            Rename Merchant <span className="text-slate-400">(optional)</span>
          </label>
          <input
            type="text"
            placeholder="e.g. Power/Water Utilities"
            value={draft.renameMerchant}
            onChange={(e) => updateField('renameMerchant', e.target.value)}
            className="w-full text-xs px-2.5 py-1.5 bg-background border border-border rounded-lg text-slate-200 focus:outline-none focus:border-amber-500"
          />
        </div>

        <div>
          <label className="text-[11px] text-slate-300 block mb-1">
            Target Tags <span className="text-slate-400">(comma-separated)</span>
          </label>
          <input
            type="text"
            placeholder="e.g. gym, subscription"
            value={draft.targetTags}
            onChange={(e) => updateField('targetTags', e.target.value)}
            data-testid="rule-tags-input"
            className="w-full text-xs px-2.5 py-1.5 bg-background border border-border rounded-lg text-slate-200 focus:outline-none focus:border-amber-500 font-mono"
          />
        </div>

        <div>
          <label className="text-[11px] text-slate-300 block mb-1">
            Payment Frequency <span className="text-slate-400">(optional)</span>
          </label>
          <select
            value={draft.targetRecurrence}
            onChange={(e) =>
              updateField('targetRecurrence', e.target.value as RecurrenceType | '')
            }
            className="w-full text-xs px-2.5 py-1.5 bg-background border border-border rounded-lg text-slate-200 focus:outline-none focus:border-amber-500"
          >
            {RECURRENCE_OPTIONS.map((opt) => (
              <option key={opt.label} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="pt-1 flex items-center space-x-2">
        <input
          type="checkbox"
          id="apply_retroactively_check"
          checked={draft.applyRetroactively}
          onChange={(e) => updateField('applyRetroactively', e.target.checked)}
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
        <Button variant="outline" size="xs" onClick={onCancel} type="button">
          Cancel
        </Button>
        <Button
          variant="primary"
          size="xs"
          type="submit"
          disabled={saving}
          data-testid="save-rule-btn"
          icon={
            saving ? (
              <RefreshCw className="w-3 h-3 animate-spin" />
            ) : (
              <Check className="w-3 h-3" />
            )
          }
        >
          {isEditing ? 'Update Rule' : 'Save Rule'}
        </Button>
      </div>
    </form>
  );
};
