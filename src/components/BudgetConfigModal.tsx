import React, { useEffect, useState } from 'react';
import { Calculator, Plus, Sparkles, Target, Trash2 } from 'lucide-react';
import {
  AlertBanner,
  Button,
  CollapsibleSection,
  EmptyState,
  FormField,
  Modal,
  SegmentedControl,
  StatusBadge,
  TextInput,
} from '@yggdrasil-lab/ui';
import { useCategories } from '../hooks/useCategories';
import {
  deleteBudgetRule,
  fetchAverageBurn,
  fetchBudgetRules,
  initDefaultBudgets,
  syncBudgetsFromBurn,
  upsertBudgetRule,
} from '../services/api';
import { AverageBurnReportResponse, BudgetPeriod, BudgetRule } from '../types';
import { formatMoney } from '../utils/format';

interface BudgetConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialCategory?: string;
}

const AvgBurnDetailsList: React.FC<{
  avgBurnReport: AverageBurnReportResponse;
  variableCats: AverageBurnReportResponse['categories'];
  recurringItems: NonNullable<AverageBurnReportResponse['recurring_commitments']>;
  getVarPct: (catVar: number, preset?: number) => number;
  onPopulateCategory: (cat: string, period: BudgetPeriod, weeklyBurn: number) => void;
}> = ({ avgBurnReport, variableCats, recurringItems, getVarPct, onPopulateCategory }) => (
  <CollapsibleSection variant="inline" title="View % & fixed" className="pt-1 border-t-0">
    <div className="space-y-2 max-h-44 overflow-y-auto pr-1 text-[11px]">
      {variableCats.length > 0 && (
        <div className="space-y-1">
          <div className="text-[10px] uppercase tracking-wider text-slate-400">
            Variable Share ({avgBurnReport.lookback_weeks}w avg)
          </div>
          {variableCats.map((cat) => (
            <button
              key={cat.category}
              type="button"
              onClick={() => onPopulateCategory(cat.category, cat.budget_period || 'monthly', cat.average_weekly_burn)}
              className="w-full text-left flex items-center justify-between gap-2 px-2 py-1 rounded bg-background/60 border border-border/60 hover:border-amber-500/40 cursor-pointer"
            >
              <span className="text-slate-200 truncate">
                {cat.category}
                {cat.budget_period === 'annual' ? ' (52w)' : ''}
              </span>
              <span className="font-mono text-slate-300 shrink-0">
                <span className="text-amber-300">
                  {getVarPct(cat.variable_weekly_burn, cat.variable_percentage).toFixed(1)}%
                </span>{' '}
                ({formatMoney(cat.variable_weekly_burn)}/wk
                {cat.recurring_weekly_burn > 0 ? ` + ${formatMoney(cat.recurring_weekly_burn)} fixed` : ''})
              </span>
            </button>
          ))}
        </div>
      )}

      {recurringItems.length > 0 && (
        <div className="space-y-1">
          <div className="text-[10px] uppercase tracking-wider text-slate-400">
            Active Fixed Commitments ({recurringItems.length})
          </div>
          {recurringItems.map((item) => (
            <div key={`${item.transaction_id}-${item.merchant}`} className="flex items-center justify-between gap-2 px-2 py-1 rounded bg-background/60 border border-border/60">
              <span className="text-slate-200 truncate">
                {item.merchant} <span className="text-slate-400">({item.recurrence})</span>
              </span>
              <span className="font-mono text-sky-300 shrink-0">
                {formatMoney(item.weekly_nzd)}/wk ({item.percentage_of_recurring.toFixed(1)}%)
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  </CollapsibleSection>
);

const AvgBurnSummaryCard: React.FC<{
  avgBurnReport: AverageBurnReportResponse;
  loading: boolean;
  onSyncFromBurn: () => void;
  onPopulateCategory: (cat: string, period: BudgetPeriod, weeklyBurn: number) => void;
}> = ({ avgBurnReport, loading, onSyncFromBurn, onPopulateCategory }) => {
  const totalVar = avgBurnReport.variable_weekly_burn || 0;
  const variableCats = avgBurnReport.categories
    .filter((c) => c.variable_weekly_burn > 0)
    .sort((a, b) => b.variable_weekly_burn - a.variable_weekly_burn);
  const recurringItems = avgBurnReport.recurring_commitments ?? [];
  const getVarPct = (catVar: number, preset?: number) =>
    preset !== undefined ? preset : totalVar > 0 ? Math.round((catVar / totalVar) * 1000) / 10 : 0;

  return (
    <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 space-y-2.5 text-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="space-y-0.5">
          <div className="font-semibold text-amber-300">
            {avgBurnReport.lookback_weeks}w Average Burn:{' '}
            <span className="font-mono">{formatMoney(avgBurnReport.effective_weekly_burn)}/wk</span>
          </div>
          <div className="text-[11px] text-slate-300 font-mono">
            {formatMoney(avgBurnReport.recurring_weekly_burn)}/wk recurring +{' '}
            {formatMoney(avgBurnReport.variable_weekly_burn)}/wk variable
          </div>
        </div>
        <Button variant="amber" size="xs" loading={loading} icon={<Calculator className="w-3.5 h-3.5" />} onClick={onSyncFromBurn} data-testid="sync-from-burn-btn">
          Use Avg Burn
        </Button>
      </div>

      {(variableCats.length > 0 || recurringItems.length > 0) && (
        <div className="pt-2 border-t border-amber-500/20 space-y-2">
          <div className="flex flex-wrap items-center gap-1">
            {variableCats.slice(0, 3).map((cat) => (
              <button
                key={cat.category}
                type="button"
                onClick={() => onPopulateCategory(cat.category, cat.budget_period || 'monthly', cat.average_weekly_burn)}
                className="px-1.5 py-0.5 rounded bg-background/70 border border-border/70 hover:border-amber-500/40 text-[10px] text-slate-200 font-mono transition-colors"
                title="Tap to populate budget rule"
              >
                {cat.category} {getVarPct(cat.variable_weekly_burn, cat.variable_percentage).toFixed(1)}%
              </button>
            ))}
          </div>
          <AvgBurnDetailsList
            avgBurnReport={avgBurnReport}
            variableCats={variableCats}
            recurringItems={recurringItems}
            getVarPct={getVarPct}
            onPopulateCategory={onPopulateCategory}
          />
        </div>
      )}
    </div>
  );
};

const BudgetTargetForm: React.FC<{
  category: string;
  budgetPeriod: BudgetPeriod;
  weeklyLimit: string;
  monthlyLimit: string;
  annualLimit: string;
  budgetCategoryNames: string[];
  loading: boolean;
  onCategoryChange: (val: string) => void;
  onBudgetPeriodChange: (period: BudgetPeriod) => void;
  onWeeklyChange: (val: string) => void;
  onMonthlyChange: (val: string) => void;
  onAnnualChange: (val: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}> = (props) => (
  <form onSubmit={props.onSubmit} className="p-3.5 bg-card/60 rounded-xl border border-border space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-300">
      <span className="font-semibold text-slate-200 flex items-center space-x-1.5">
        <Target className="w-3.5 h-3.5 text-amber-400" />
        <span>Target Budget Rule</span>
      </span>
      <span className="text-[11px] text-slate-400">Auto-converts weekly/monthly/annual</span>
    </div>

    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 items-end">
      <FormField label="Category">
        <TextInput
          type="text"
          value={props.category}
          onChange={(e) => props.onCategoryChange(e.target.value)}
          placeholder="Category"
          list="budget-categories"
          variant="amber"
        />
        <datalist id="budget-categories">
          {props.budgetCategoryNames.map((cat) => (
            <option key={cat} value={cat} />
          ))}
        </datalist>
      </FormField>

      <FormField label="Guardrail Cadence">
        <SegmentedControl<BudgetPeriod>
          idPrefix="budget-period-mode"
          fullWidth
          size="xs"
          variant="amber"
          value={props.budgetPeriod}
          onChange={props.onBudgetPeriodChange}
          options={[
            { id: 'weekly', label: 'Weekly' },
            { id: 'monthly', label: 'Monthly' },
            { id: 'annual', label: 'Annual (52w)' },
          ]}
        />
      </FormField>
    </div>

    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
      <FormField label="Weekly Limit ($/wk)">
        <TextInput
          type="number"
          step="1"
          placeholder="200"
          value={props.weeklyLimit}
          onChange={(e) => props.onWeeklyChange(e.target.value)}
          leftIcon={<span className="text-xs">$</span>}
          variant="amber"
          className="font-mono"
        />
      </FormField>

      <FormField label="Monthly Limit ($/mo)">
        <TextInput
          type="number"
          step="1"
          placeholder="867"
          value={props.monthlyLimit}
          onChange={(e) => props.onMonthlyChange(e.target.value)}
          leftIcon={<span className="text-xs">$</span>}
          variant="amber"
          className="font-mono"
        />
      </FormField>

      <FormField label="Annual Limit ($/yr)">
        <TextInput
          type="number"
          step="1"
          placeholder="4000"
          value={props.annualLimit}
          onChange={(e) => props.onAnnualChange(e.target.value)}
          data-testid="budget-annual-limit-input"
          leftIcon={<span className="text-xs">$</span>}
          variant="amber"
          className="font-mono"
        />
      </FormField>
    </div>

    <div className="flex justify-end gap-2 pt-1">
      <Button type="submit" variant="amber" size="sm" loading={props.loading} icon={<Plus className="w-3.5 h-3.5" />}>
        Save Budget
      </Button>
    </div>
  </form>
);

const ConfiguredBudgetRulesList: React.FC<{
  rules: BudgetRule[];
  hasAvgBurnReport: boolean;
  loading: boolean;
  onSyncFromBurn: () => void;
  onInitDefaults: () => void;
  onSelectRule: (rule: BudgetRule) => void;
  onToggleRulePeriod: (rule: BudgetRule) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}> = ({
  rules, hasAvgBurnReport, loading, onSyncFromBurn, onInitDefaults,
  onSelectRule, onToggleRulePeriod, onDelete,
}) => (
  <div className="space-y-2">
    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
      <span>Configured Categories ({rules.length})</span>
      <div className="flex items-center gap-1.5">
        {!hasAvgBurnReport && (
          <Button
            variant="outline"
            size="xs"
            loading={loading}
            icon={<Calculator className="w-3 h-3 text-amber-400" />}
            onClick={onSyncFromBurn}
            className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
            data-testid="sync-from-burn-btn"
          >
            Auto-Calculate Avg Burn
          </Button>
        )}
        {rules.length === 0 && (
          <Button
            variant="outline"
            size="xs"
            loading={loading}
            icon={<Sparkles className="w-3 h-3 text-amber-400" />}
            onClick={onInitDefaults}
            className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
          >
            Load NZ Baseline
          </Button>
        )}
      </div>
    </div>

    {rules.length === 0 ? (
      <EmptyState
        title="No category budgets set yet"
        description='Click "Use Avg Burn" to derive limits from actual spend or "Load NZ Baseline" for starter targets.'
        variant="dashed"
      />
    ) : (
      <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1">
        {rules.map((r) => {
          const isAnnual = r.budget_period === 'annual';
          const annualVal = r.annual_limit ?? Math.round(r.weekly_limit * 52 * 100) / 100;
          return (
            <div
              key={r.id}
              className="flex items-center justify-between gap-2 p-2 rounded-lg bg-card/40 border border-border text-xs hover:border-slate-600 transition-colors cursor-pointer"
              onClick={() => onSelectRule(r)}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-medium text-slate-200 truncate">{r.category}</span>
                  {isAnnual && <StatusBadge variant="info" size="xs" showDot={false} label="52w Annual" />}
                </div>
                <div className="text-[10px] text-slate-400 font-mono">
                  {formatMoney(r.weekly_limit)}/wk · {formatMoney(r.monthly_limit)}/mo · {formatMoney(annualVal)}/yr
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  data-testid={`rule-toggle-annual-${r.category.toLowerCase().replace(/\s+/g, '-')}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    void onToggleRulePeriod(r);
                  }}
                  className={`px-1.5 py-0.5 rounded border text-[10px] transition-colors ${
                    isAnnual
                      ? 'border-sky-500/30 bg-sky-500/15 text-sky-300 hover:bg-sky-500/25'
                      : 'border-border/70 text-slate-400 hover:text-amber-300 hover:border-amber-500/40'
                  }`}
                  title="Toggle 52-week annual budget spread"
                >
                  {isAnnual ? '52w On' : 'Spread 52w'}
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    void onDelete(r.id);
                  }}
                  className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                  title="Delete rule"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    )}
  </div>
);

function convertRateFields(source: 'weekly' | 'monthly' | 'annual', val: string) {
  const num = parseFloat(val);
  const valid = !isNaN(num) && num > 0;
  if (source === 'weekly') {
    return {
      weekly: val,
      monthly: valid ? ((num * 52) / 12).toFixed(2) : '',
      annual: valid ? (num * 52).toFixed(2) : '',
    };
  }
  if (source === 'monthly') {
    return {
      weekly: valid ? ((num * 12) / 52).toFixed(2) : '',
      monthly: val,
      annual: valid ? (num * 12).toFixed(2) : '',
    };
  }
  return {
    weekly: valid ? (num / 52).toFixed(2) : '',
    monthly: valid ? (num / 12).toFixed(2) : '',
    annual: val,
  };
}

function useBudgetMutations(
  loadRules: () => Promise<void>,
  onSuccess: () => void,
  setLoading: (v: boolean) => void,
  setError: (v: string | null) => void,
  setSuccessMsg: (v: string | null) => void
) {
  return async (fn: () => Promise<void>, fallbackErr: string, msg?: string) => {
    setLoading(true);
    setError(null);
    try {
      await fn();
      if (msg) {
        setSuccessMsg(msg);
        setTimeout(() => setSuccessMsg(null), 3000);
      }
      await loadRules();
      onSuccess();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : fallbackErr);
    } finally {
      setLoading(false);
    }
  };
}

function useBudgetConfigState(isOpen: boolean, initialCategory: string | undefined, onSuccess: () => void) {
  const [rules, setRules] = useState<BudgetRule[]>([]);
  const [avgBurnReport, setAvgBurnReport] = useState<AverageBurnReportResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [category, setCategory] = useState(initialCategory || 'Groceries');
  const [weeklyLimit, setWeeklyLimit] = useState('');
  const [monthlyLimit, setMonthlyLimit] = useState('');
  const [annualLimit, setAnnualLimit] = useState('');
  const [budgetPeriod, setBudgetPeriod] = useState<BudgetPeriod>('monthly');

  const syncFromRule = (r: BudgetRule) => {
    setCategory(r.category);
    setWeeklyLimit(String(r.weekly_limit));
    setMonthlyLimit(String(r.monthly_limit));
    setAnnualLimit(String(r.annual_limit ?? Math.round(r.weekly_limit * 52 * 100) / 100));
    setBudgetPeriod(r.budget_period || 'monthly');
  };

  const loadRules = async () => {
    setLoading(true);
    setError(null);
    try {
      const [res, burnReport] = await Promise.all([fetchBudgetRules(), fetchAverageBurn(12).catch(() => null)]);
      setRules(res);
      setAvgBurnReport(burnReport);
      if (initialCategory) {
        const found = res.find((r) => r.category.toLowerCase() === initialCategory.toLowerCase());
        if (found) syncFromRule(found);
        else setCategory(initialCategory);
      }
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to load budgets');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) void loadRules();
  }, [isOpen, initialCategory]);

  const runMutation = useBudgetMutations(loadRules, onSuccess, setLoading, setError, setSuccessMsg);
  const applyRate = (source: 'weekly' | 'monthly' | 'annual', val: string) => {
    const next = convertRateFields(source, val);
    setWeeklyLimit(next.weekly);
    setMonthlyLimit(next.monthly);
    setAnnualLimit(next.annual);
  };

  const handleSave = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!category.trim()) return setError('Please select or enter a category name');
    const [w, m, a] = [parseFloat(weeklyLimit), parseFloat(monthlyLimit), parseFloat(annualLimit)];
    if (isNaN(w) && isNaN(m) && isNaN(a)) return setError('Please provide a weekly, monthly, or annual budget limit');
    await runMutation(
      () => upsertBudgetRule(category.trim(), isNaN(w) ? undefined : w, isNaN(m) ? undefined : m, isNaN(a) ? undefined : a, budgetPeriod).then(() => undefined),
      'Failed to save budget target',
      `Budget for ${category} saved (${budgetPeriod})!`
    );
  };

  return {
    rules, avgBurnReport, loading, error, successMsg, category, setCategory,
    weeklyLimit, monthlyLimit, annualLimit, budgetPeriod, setBudgetPeriod, syncFromRule,
    handleWeeklyChange: (val: string) => applyRate('weekly', val),
    handleMonthlyChange: (val: string) => applyRate('monthly', val),
    handleAnnualChange: (val: string) => applyRate('annual', val),
    handleSave,
    handleToggleRulePeriod: (rule: BudgetRule) => {
      const nextPeriod: BudgetPeriod = rule.budget_period === 'annual' ? 'monthly' : 'annual';
      const annualVal = rule.annual_limit ?? Math.round(rule.weekly_limit * 52 * 100) / 100;
      return runMutation(
        () => upsertBudgetRule(rule.category, rule.weekly_limit, rule.monthly_limit, annualVal, nextPeriod).then(() => undefined),
        'Failed to update budget period',
        nextPeriod === 'annual' ? `${rule.category} spread over 52-week annual budget!` : `${rule.category} switched to ${nextPeriod} budget!`
      );
    },
    handleDelete: (id: number) => runMutation(() => deleteBudgetRule(id).then(() => undefined), 'Failed to delete budget target'),
    handleSyncFromBurn: () => runMutation(() => syncBudgetsFromBurn(12).then(() => undefined), 'Failed to calculate budgets from average burn', 'Calculated category budgets from 12-week average burn!'),
    handleInitDefaults: () => runMutation(() => initDefaultBudgets().then(() => undefined), 'Failed to initialize default budgets', 'Initialized standard NZ baseline budgets!'),
  };
}

/**
 * Modal for configuring weekly/monthly spending budget guardrails per category
 * or auto-calculating limits from trailing average weekly burn.
 */
export const BudgetConfigModal: React.FC<BudgetConfigModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialCategory,
}) => {
  const { budgetCategoryNames } = useCategories();
  const s = useBudgetConfigState(isOpen, initialCategory, onSuccess);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Category Budget Guardrails"
      footer={
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Done
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {s.error && <AlertBanner variant="error">{s.error}</AlertBanner>}
        {s.successMsg && <AlertBanner variant="success">{s.successMsg}</AlertBanner>}

        {s.avgBurnReport && (
          <AvgBurnSummaryCard
            avgBurnReport={s.avgBurnReport}
            loading={s.loading}
            onSyncFromBurn={() => void s.handleSyncFromBurn()}
            onPopulateCategory={(cat, period, weeklyBurn) => {
              s.setCategory(cat);
              s.setBudgetPeriod(period);
              s.handleWeeklyChange(String(weeklyBurn));
            }}
          />
        )}

        <BudgetTargetForm
          category={s.category}
          budgetPeriod={s.budgetPeriod}
          weeklyLimit={s.weeklyLimit}
          monthlyLimit={s.monthlyLimit}
          annualLimit={s.annualLimit}
          budgetCategoryNames={budgetCategoryNames}
          loading={s.loading}
          onCategoryChange={s.setCategory}
          onBudgetPeriodChange={s.setBudgetPeriod}
          onWeeklyChange={s.handleWeeklyChange}
          onMonthlyChange={s.handleMonthlyChange}
          onAnnualChange={s.handleAnnualChange}
          onSubmit={(e) => void s.handleSave(e)}
        />

        <ConfiguredBudgetRulesList
          rules={s.rules}
          hasAvgBurnReport={Boolean(s.avgBurnReport)}
          loading={s.loading}
          onSyncFromBurn={() => void s.handleSyncFromBurn()}
          onInitDefaults={() => void s.handleInitDefaults()}
          onSelectRule={s.syncFromRule}
          onToggleRulePeriod={s.handleToggleRulePeriod}
          onDelete={s.handleDelete}
        />
      </div>
    </Modal>
  );
};
