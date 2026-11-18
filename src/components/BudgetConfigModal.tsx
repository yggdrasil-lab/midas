import React, { useEffect, useState } from 'react';
import { Calculator, ChevronDown, ChevronUp, Plus, Sparkles, Target, Trash2 } from 'lucide-react';
import { AlertBanner, Button, EmptyState, Modal, SegmentedControl } from '@yggdrasil-lab/ui';
import { BUDGET_CATEGORY_CHOICES } from '../constants/categories';
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
  const [annualLimit, setAnnualLimit] = useState('');
  const [budgetPeriod, setBudgetPeriod] = useState<BudgetPeriod>('monthly');
  const [showBurnBreakdown, setShowBurnBreakdown] = useState(false);

  const syncFromRule = (r: BudgetRule) => {
    setCategory(r.category);
    setWeeklyLimit(String(r.weekly_limit));
    setMonthlyLimit(String(r.monthly_limit));
    const computedAnnual = r.annual_limit ?? Math.round(r.weekly_limit * 52 * 100) / 100;
    setAnnualLimit(String(computedAnnual));
    setBudgetPeriod(r.budget_period || 'monthly');
  };

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
          syncFromRule(found);
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
    setAnnualLimit(!isNaN(num) && num > 0 ? (num * 52).toFixed(2) : '');
  };

  const handleMonthlyChange = (val: string) => {
    setMonthlyLimit(val);
    const num = parseFloat(val);
    setWeeklyLimit(!isNaN(num) && num > 0 ? ((num * 12) / 52).toFixed(2) : '');
    setAnnualLimit(!isNaN(num) && num > 0 ? (num * 12).toFixed(2) : '');
  };

  const handleAnnualChange = (val: string) => {
    setAnnualLimit(val);
    const num = parseFloat(val);
    setWeeklyLimit(!isNaN(num) && num > 0 ? (num / 52).toFixed(2) : '');
    setMonthlyLimit(!isNaN(num) && num > 0 ? (num / 12).toFixed(2) : '');
  };

  const handleSave = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!category.trim()) {
      setError('Please select or enter a category name');
      return;
    }
    const w = parseFloat(weeklyLimit);
    const m = parseFloat(monthlyLimit);
    const a = parseFloat(annualLimit);
    if (isNaN(w) && isNaN(m) && isNaN(a)) {
      setError('Please provide a weekly, monthly, or annual budget limit');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await upsertBudgetRule(
        category.trim(),
        isNaN(w) ? undefined : w,
        isNaN(m) ? undefined : m,
        isNaN(a) ? undefined : a,
        budgetPeriod
      );
      setSuccessMsg(`Budget for ${category} saved (${budgetPeriod})!`);
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

  const handleToggleRulePeriod = async (rule: BudgetRule) => {
    const nextPeriod: BudgetPeriod = rule.budget_period === 'annual' ? 'monthly' : 'annual';
    setLoading(true);
    setError(null);
    try {
      await upsertBudgetRule(
        rule.category,
        rule.weekly_limit,
        rule.monthly_limit,
        rule.annual_limit ?? Math.round(rule.weekly_limit * 52 * 100) / 100,
        nextPeriod
      );
      setSuccessMsg(
        nextPeriod === 'annual'
          ? `${rule.category} spread over 52-week annual budget!`
          : `${rule.category} switched to ${nextPeriod} budget!`
      );
      await loadRules();
      onSuccess();
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to update budget period');
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
    syncFromRule(r);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Category Budget Guardrails">
      <div className="space-y-4">
        {error && <AlertBanner variant="error">{error}</AlertBanner>}
        {successMsg && <AlertBanner variant="success">{successMsg}</AlertBanner>}

        {avgBurnReport && (() => {
          const totalVar = avgBurnReport.variable_weekly_burn || 0;
          const variableCats = avgBurnReport.categories
            .filter((c) => c.variable_weekly_burn > 0)
            .sort((a, b) => b.variable_weekly_burn - a.variable_weekly_burn);
          const recurringItems = avgBurnReport.recurring_commitments ?? [];
          const getVarPct = (catVar: number, preset?: number) =>
            preset !== undefined
              ? preset
              : totalVar > 0
                ? Math.round((catVar / totalVar) * 1000) / 10
                : 0;

          return (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 space-y-2.5 text-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="space-y-0.5">
                  <div className="font-semibold text-amber-300">
                    {avgBurnReport.lookback_weeks}w Average Burn:{' '}
                    <span className="font-mono">
                      {formatMoney(avgBurnReport.effective_weekly_burn)}/wk
                    </span>
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

              {(variableCats.length > 0 || recurringItems.length > 0) && (
                <div className="pt-2 border-t border-amber-500/20 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-1.5">
                    <div className="flex flex-wrap items-center gap-1">
                      {variableCats.slice(0, 3).map((cat) => (
                        <button
                          key={cat.category}
                          type="button"
                          onClick={() => {
                            setCategory(cat.category);
                            setBudgetPeriod(cat.budget_period || 'monthly');
                            handleWeeklyChange(String(cat.average_weekly_burn));
                          }}
                          className="px-1.5 py-0.5 rounded bg-background/70 border border-border/70 hover:border-amber-500/40 text-[10px] text-slate-200 font-mono transition-colors"
                          title="Tap to populate budget rule"
                        >
                          {cat.category} {getVarPct(cat.variable_weekly_burn, cat.variable_percentage).toFixed(1)}%
                        </button>
                      ))}
                    </div>

                    <button
                      type="button"
                      data-testid="budget-burn-details-toggle"
                      onClick={() => setShowBurnBreakdown((prev) => !prev)}
                      className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-300 hover:text-amber-200 transition-colors"
                    >
                      <span>{showBurnBreakdown ? 'Hide details' : 'View % & fixed'}</span>
                      {showBurnBreakdown ? (
                        <ChevronUp className="w-3 h-3" />
                      ) : (
                        <ChevronDown className="w-3 h-3" />
                      )}
                    </button>
                  </div>

                  {showBurnBreakdown && (
                    <div className="space-y-2 max-h-44 overflow-y-auto pr-1 text-[11px]">
                      {variableCats.length > 0 && (
                        <div className="space-y-1">
                          <div className="text-[10px] uppercase tracking-wider text-slate-400">
                            Variable Share ({avgBurnReport.lookback_weeks}w avg)
                          </div>
                          {variableCats.map((cat) => (
                            <div
                              key={cat.category}
                              onClick={() => {
                                setCategory(cat.category);
                                setBudgetPeriod(cat.budget_period || 'monthly');
                                handleWeeklyChange(String(cat.average_weekly_burn));
                              }}
                              className="flex items-center justify-between gap-2 px-2 py-1 rounded bg-background/60 border border-border/60 hover:border-amber-500/40 cursor-pointer"
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
                                {cat.recurring_weekly_burn > 0
                                  ? ` + ${formatMoney(cat.recurring_weekly_burn)} fixed`
                                  : ''}
                                )
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                      {recurringItems.length > 0 && (
                        <div className="space-y-1">
                          <div className="text-[10px] uppercase tracking-wider text-slate-400">
                            Active Fixed Commitments ({recurringItems.length})
                          </div>
                          {recurringItems.map((item) => (
                            <div
                              key={`${item.transaction_id}-${item.merchant}`}
                              className="flex items-center justify-between gap-2 px-2 py-1 rounded bg-background/60 border border-border/60"
                            >
                              <span className="text-slate-200 truncate">
                                {item.merchant}{' '}
                                <span className="text-slate-400">({item.recurrence})</span>
                              </span>
                              <span className="font-mono text-sky-300 shrink-0">
                                {formatMoney(item.weekly_nzd)}/wk ({item.percentage_of_recurring.toFixed(1)}%)
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })()}

        <form
          onSubmit={handleSave}
          className="p-3.5 bg-card/60 rounded-xl border border-border space-y-3"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-300">
            <span className="font-semibold text-slate-200 flex items-center space-x-1.5">
              <Target className="w-3.5 h-3.5 text-amber-400" />
              <span>Target Budget Rule</span>
            </span>
            <span className="text-[11px] text-slate-400">Auto-converts weekly/monthly/annual</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 items-end">
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
              <label className="text-[10px] text-slate-400 block mb-1">Guardrail Cadence</label>
              <SegmentedControl<BudgetPeriod>
                idPrefix="budget-period-mode"
                fullWidth
                size="xs"
                variant="amber"
                value={budgetPeriod}
                onChange={setBudgetPeriod}
                options={[
                  { id: 'weekly', label: 'Weekly' },
                  { id: 'monthly', label: 'Monthly' },
                  { id: 'annual', label: 'Annual (52w)' },
                ]}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
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

            <div>
              <label className="text-[10px] text-slate-400 block mb-1">Annual Limit ($/yr)</label>
              <div className="relative">
                <span className="absolute left-2.5 top-1.5 text-xs text-slate-400">$</span>
                <input
                  type="number"
                  step="1"
                  placeholder="4000"
                  value={annualLimit}
                  onChange={(e) => handleAnnualChange(e.target.value)}
                  data-testid="budget-annual-limit-input"
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
              {rules.map((r) => {
                const isAnnual = r.budget_period === 'annual';
                const annualVal = r.annual_limit ?? Math.round(r.weekly_limit * 52 * 100) / 100;
                return (
                  <div
                    key={r.id}
                    className="flex items-center justify-between gap-2 p-2 rounded-lg bg-card/40 border border-border text-xs hover:border-slate-600 transition-colors cursor-pointer"
                    onClick={() => handleSelectRule(r)}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-slate-200 truncate">{r.category}</span>
                        {isAnnual && (
                          <span className="px-1.5 py-0.2 rounded bg-sky-500/15 border border-sky-500/30 text-[9px] text-sky-300 shrink-0">
                            52w Annual
                          </span>
                        )}
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
                          void handleToggleRulePeriod(r);
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
                          void handleDelete(r.id);
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

        <div className="flex justify-end pt-2 border-t border-border">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </Modal>
  );
};
