import React, { useEffect, useState } from 'react';
import { Calculator, Plus, Sparkles, Target, Trash2 } from 'lucide-react';
import { AlertBanner, Button, EmptyState, Modal } from '@yggdrasil-lab/ui';
import { BUDGET_CATEGORY_CHOICES } from '../constants/categories';
import {
  deleteBudgetRule,
  fetchAverageBurn,
  fetchBudgetRules,
  initDefaultBudgets,
  syncBudgetsFromBurn,
  upsertBudgetRule,
} from '../services/api';
import { AverageBurnReportResponse, BudgetRule } from '../types';
import { formatMoney } from '../utils/format';

interface BudgetConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialCategory?: string;
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
  const [rules, setRules] = useState<BudgetRule[]>([]);
  const [avgBurnReport, setAvgBurnReport] = useState<AverageBurnReportResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [category, setCategory] = useState(initialCategory || 'Groceries');
  const [weeklyLimit, setWeeklyLimit] = useState('');
  const [monthlyLimit, setMonthlyLimit] = useState('');

  const loadRules = async () => {
    setLoading(true);
    setError(null);
    try {
      const [res, burnReport] = await Promise.all([
        fetchBudgetRules(),
        fetchAverageBurn(12).catch(() => null),
      ]);
      setRules(res);
      setAvgBurnReport(burnReport);
      if (initialCategory) {
        const found = res.find(
          (r) => r.category.toLowerCase() === initialCategory.toLowerCase()
        );
        if (found) {
          setCategory(found.category);
          setWeeklyLimit(String(found.weekly_limit));
          setMonthlyLimit(String(found.monthly_limit));
        } else {
          setCategory(initialCategory);
        }
      }
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to load budgets');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadRules();
    }
  }, [isOpen, initialCategory]);

  const handleWeeklyChange = (val: string) => {
    setWeeklyLimit(val);
    const num = parseFloat(val);
    setMonthlyLimit(!isNaN(num) && num > 0 ? ((num * 52) / 12).toFixed(2) : '');
  };

  const handleMonthlyChange = (val: string) => {
    setMonthlyLimit(val);
    const num = parseFloat(val);
    setWeeklyLimit(!isNaN(num) && num > 0 ? ((num * 12) / 52).toFixed(2) : '');
  };

  const handleSave = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!category.trim()) {
      setError('Please select or enter a category name');
      return;
    }
    const w = parseFloat(weeklyLimit);
    const m = parseFloat(monthlyLimit);
    if (isNaN(w) && isNaN(m)) {
      setError('Please provide a weekly or monthly budget limit');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await upsertBudgetRule(category.trim(), isNaN(w) ? undefined : w, isNaN(m) ? undefined : m);
      setSuccessMsg(`Budget for ${category} saved!`);
      await loadRules();
      onSuccess();
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to save budget target');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    setLoading(true);
    setError(null);
    try {
      await deleteBudgetRule(id);
      await loadRules();
      onSuccess();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to delete budget target');
    } finally {
      setLoading(false);
    }
  };

  const handleSyncFromBurn = async () => {
    setLoading(true);
    setError(null);
    try {
      await syncBudgetsFromBurn(12);
      setSuccessMsg('Calculated category budgets from 12-week average burn!');
      await loadRules();
      onSuccess();
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error ? err.message : 'Failed to calculate budgets from average burn'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleInitDefaults = async () => {
    setLoading(true);
    setError(null);
    try {
      await initDefaultBudgets();
      setSuccessMsg('Initialized standard NZ baseline budgets!');
      await loadRules();
      onSuccess();
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to initialize default budgets');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectRule = (r: BudgetRule) => {
    setCategory(r.category);
    setWeeklyLimit(String(r.weekly_limit));
    setMonthlyLimit(String(r.monthly_limit));
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Category Budget Guardrails">
      <div className="space-y-4">
        {error && <AlertBanner variant="error">{error}</AlertBanner>}
        {successMsg && <AlertBanner variant="success">{successMsg}</AlertBanner>}

        {avgBurnReport && (
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
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
            <Button
              variant="amber"
              size="xs"
              loading={loading}
              icon={<Calculator className="w-3.5 h-3.5" />}
              onClick={handleSyncFromBurn}
              data-testid="sync-from-burn-btn"
            >
              Use Avg Burn
            </Button>
          </div>
        )}

        <form
          onSubmit={handleSave}
          className="p-3.5 bg-card/60 rounded-xl border border-border space-y-3"
        >
          <div className="flex items-center justify-between text-xs text-slate-300">
            <span className="font-semibold text-slate-200 flex items-center space-x-1.5">
              <Target className="w-3.5 h-3.5 text-amber-400" />
              <span>Target Budget Rule</span>
            </span>
            <span className="text-[11px] text-slate-400">Auto-converts weekly/monthly</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div>
              <label className="text-[10px] text-slate-400 block mb-1">Category</label>
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="Category"
                list="budget-categories"
                className="w-full px-2.5 py-1.5 bg-background border border-border rounded text-base sm:text-xs text-slate-100 focus:outline-none focus:border-amber-500"
              />
              <datalist id="budget-categories">
                {BUDGET_CATEGORY_CHOICES.map((cat) => (
                  <option key={cat} value={cat} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="text-[10px] text-slate-400 block mb-1">Weekly Limit ($/wk)</label>
              <div className="relative">
                <span className="absolute left-2.5 top-1.5 text-xs text-slate-400">$</span>
                <input
                  type="number"
                  step="1"
                  placeholder="200"
                  value={weeklyLimit}
                  onChange={(e) => handleWeeklyChange(e.target.value)}
                  className="w-full pl-6 pr-2.5 py-1.5 bg-background border border-border rounded text-base sm:text-xs text-slate-100 font-mono focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] text-slate-400 block mb-1">Monthly Limit ($/mo)</label>
              <div className="relative">
                <span className="absolute left-2.5 top-1.5 text-xs text-slate-400">$</span>
                <input
                  type="number"
                  step="1"
                  placeholder="867"
                  value={monthlyLimit}
                  onChange={(e) => handleMonthlyChange(e.target.value)}
                  className="w-full pl-6 pr-2.5 py-1.5 bg-background border border-border rounded text-base sm:text-xs text-slate-100 font-mono focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button
              type="submit"
              variant="amber"
              size="sm"
              loading={loading}
              icon={<Plus className="w-3.5 h-3.5" />}
            >
              Save Budget
            </Button>
          </div>
        </form>

        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
            <span>Configured Categories ({rules.length})</span>
            <div className="flex items-center gap-1.5">
              {!avgBurnReport && (
                <Button
                  variant="outline"
                  size="xs"
                  loading={loading}
                  icon={<Calculator className="w-3 h-3 text-amber-400" />}
                  onClick={handleSyncFromBurn}
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
                  onClick={handleInitDefaults}
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
              {rules.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between p-2 rounded-lg bg-card/40 border border-border text-xs hover:border-slate-600 transition-colors cursor-pointer"
                  onClick={() => handleSelectRule(r)}
                >
                  <div>
                    <span className="font-medium text-slate-200">{r.category}</span>
                    <span className="text-[10px] text-slate-400 ml-2">
                      {formatMoney(r.weekly_limit)}/wk · {formatMoney(r.monthly_limit)}/mo
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleDelete(r.id);
                    }}
                    className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                    title="Delete rule"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end pt-2 border-t border-border">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </Modal>
  );
};
