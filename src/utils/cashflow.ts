import {
  CashflowDirection,
  CategorySpendingReport,
  PeriodType,
  SpendingBreakdownResponse,
  Transaction,
} from '../types';
import { getTransactionNzdAmount } from './format';

export interface CashflowPartition {
  actualTransactions: Transaction[];
  amortizedCommitments: Transaction[];
  excludedTransactions: Transaction[];
}

export interface CashflowSummaryMetrics {
  headlineTotal: number;
  itemCount: number;
  itemSubvalue?: string;
  thirdMetricLabel: string;
  thirdMetricValue: number;
  thirdMetricSubvalue?: string;
  actualVolume: number;
  amortizedVolume: number;
  excludedVolume: number;
  annualizedShareTotal: number;
}

/**
 * Returns true when the Reporting Window applies recurring commitment amortization
 * and 52-week annualized smoothing (`week`, `last_week`, `month`, `last_month`).
 */
export function isBudgetCadencePeriod(period: PeriodType): boolean {
  return (
    period === 'week' ||
    period === 'last_week' ||
    period === 'month' ||
    period === 'last_month'
  );
}

/**
 * Returns true when the Reporting Window uses weekly cadence (`week`, `last_week`).
 */
export function isWeeklyBudgetPeriod(period: PeriodType): boolean {
  return period === 'week' || period === 'last_week';
}

/**
 * Converts a 52-week annualized category total into its single-period share,
 * matching Plutus `spending_projection._inject_annual_category_smoothing`.
 */
export function getAnnualizedPeriodShare(
  annualTotalNzd: number,
  isWeekly: boolean
): number {
  const divisor = isWeekly ? 52 : 12;
  return Math.round((annualTotalNzd / divisor) * 100) / 100;
}

/**
 * Produces a deterministic identity key for non-amortized cashflow rows while
 * distinguishing active vs excluded partitions derived from the same parent transaction.
 */
export function getCashflowRegularRowKey(tx: Transaction): string {
  const excludedFlag = tx.excluded_from_period_budget ? '1' : '0';
  return `${tx.id}:${excludedFlag}:${tx.category}:${tx.amount}:${tx.notes ?? ''}`;
}

/**
 * Appends incoming page-2+ regular transactions onto existing non-amortized rows
 * without duplicating rows or re-adding amortized commitments.
 */
export function mergeCashflowRegularRows(
  existing: Transaction[],
  incoming: Transaction[]
): Transaction[] {
  const regularExisting = existing.filter((t) => !t.is_amortized_commitment);
  const seen = new Set(regularExisting.map(getCashflowRegularRowKey));
  const merged = [...regularExisting];
  for (const tx of incoming) {
    if (tx.is_amortized_commitment) continue;
    const key = getCashflowRegularRowKey(tx);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(tx);
  }
  return merged;
}

/**
 * Splits projected cashflow rows into actual period flows, amortized recurring
 * commitments, and items excluded from the active period budget.
 */
export function partitionCashflowTransactions(
  transactions: Transaction[]
): CashflowPartition {
  const actualTransactions: Transaction[] = [];
  const amortizedCommitments: Transaction[] = [];
  const excludedTransactions: Transaction[] = [];

  for (const tx of transactions) {
    if (tx.is_amortized_commitment) {
      amortizedCommitments.push(tx);
    } else if (tx.excluded_from_period_budget) {
      excludedTransactions.push(tx);
    } else {
      actualTransactions.push(tx);
    }
  }

  return { actualTransactions, amortizedCommitments, excludedTransactions };
}

/**
 * Case-insensitive substring filter across cashflow transaction fields and tags.
 */
export function matchesCashflowSearch(tx: Transaction, query: string): boolean {
  const q = query.trim().toLowerCase().replace(/^#+/, '');
  if (!q) return true;
  return (
    tx.merchant.toLowerCase().includes(q) ||
    tx.category.toLowerCase().includes(q) ||
    (tx.account_name || '').toLowerCase().includes(q) ||
    (tx.counterpart_account_name || '').toLowerCase().includes(q) ||
    (tx.loan_name || '').toLowerCase().includes(q) ||
    (tx.raw_description || '').toLowerCase().includes(q) ||
    (tx.recurrence || '').toLowerCase().includes(q) ||
    (tx.tags || []).some((tag) => tag.toLowerCase().includes(q))
  );
}

/**
 * Derives non-transfer, non-annual spending categories with positive outflow spend.
 */
export function deriveOutflowCategoryChips(
  breakdown: SpendingBreakdownResponse | null
): string[] {
  if (!breakdown) return [];
  return breakdown.categories
    .filter((c) => !c.is_transfer && c.budget_period !== 'annual' && c.total_spend > 0)
    .map((c) => c.category);
}

/**
 * Extracts distinct non-empty inflow categories sorted by total NZD volume descending.
 */
export function deriveInflowCategoryChips(transactions: Transaction[]): string[] {
  const totalsByCategory = new Map<string, number>();
  for (const tx of transactions) {
    if (tx.is_amortized_commitment || tx.excluded_from_period_budget) continue;
    const cat = (tx.category || '').trim();
    if (!cat) continue;
    totalsByCategory.set(cat, (totalsByCategory.get(cat) ?? 0) + getTransactionNzdAmount(tx));
  }
  return Array.from(totalsByCategory.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([category]) => category);
}

/**
 * Extracts non-transfer annualized categories (52-week smoothed) with positive spend.
 */
export function deriveAnnualizedCategories(
  breakdown: SpendingBreakdownResponse | null
): CategorySpendingReport[] {
  if (!breakdown) return [];
  return breakdown.categories.filter(
    (c) => !c.is_transfer && c.budget_period === 'annual' && c.total_spend > 0
  );
}

function buildThirdSummaryMetric(params: {
  activeFlow: CashflowDirection;
  isCadence: boolean;
  isWeekly: boolean;
  isFiltered: boolean;
  headlineTotal: number;
  totalCount: number;
  actualCount: number;
  amortizedCount: number;
  amortizedVolume: number;
  annualizedCount: number;
  annualizedShareTotal: number;
}): Pick<
  CashflowSummaryMetrics,
  'thirdMetricLabel' | 'thirdMetricValue' | 'thirdMetricSubvalue'
> {
  if (params.activeFlow !== 'outflow' || !params.isCadence) {
    const divisor = params.totalCount > 0 ? params.totalCount : params.actualCount;
    return {
      thirdMetricLabel: 'Avg / Item',
      thirdMetricValue: divisor > 0 ? params.headlineTotal / divisor : 0,
      thirdMetricSubvalue: 'NZD',
    };
  }
  const unit = params.isWeekly ? 'wk' : 'mo';
  const showAnnual = !params.isFiltered && params.annualizedCount > 0;
  let subvalue = `/${unit} share`;
  if (params.amortizedCount > 0 && showAnnual) {
    subvalue = `${params.amortizedCount} fixed + ${params.annualizedCount} 52w`;
  } else if (params.amortizedCount > 0) {
    subvalue = `${params.amortizedCount} fixed /${unit}`;
  } else if (showAnnual) {
    subvalue = `${params.annualizedCount} 52w /${unit}`;
  }
  return {
    thirdMetricLabel: 'Fixed & Annual',
    thirdMetricValue: params.amortizedVolume + params.annualizedShareTotal,
    thirdMetricSubvalue: subvalue,
  };
}

function resolveCashflowHeadlineTotal(params: {
  activeFlow: CashflowDirection;
  selectedCategory: string;
  breakdown: SpendingBreakdownResponse | null;
  actualVolume: number;
  amortizedVolume: number;
  annualizedShareTotal: number;
}): number {
  const isFiltered = params.selectedCategory !== 'ALL';
  if (!isFiltered && params.breakdown) {
    return params.activeFlow === 'inflow'
      ? params.breakdown.total_income
      : params.breakdown.total_spend;
  }
  if (!isFiltered) {
    return params.actualVolume + params.amortizedVolume + params.annualizedShareTotal;
  }
  if (params.activeFlow === 'outflow') {
    const targetLower = params.selectedCategory.toLowerCase();
    const matched = params.breakdown?.categories.find(
      (c) => c.category.toLowerCase() === targetLower
    );
    return matched ? matched.total_spend : params.actualVolume + params.amortizedVolume;
  }
  return params.actualVolume;
}

export interface ComputeCashflowSummaryParams {
  activeFlow: CashflowDirection;
  period: PeriodType;
  selectedCategory: string;
  totalCount: number;
  breakdown: SpendingBreakdownResponse | null;
  partition: CashflowPartition;
  annualizedCategories: CategorySpendingReport[];
}

/**
 * Computes the 3-card summary grid metrics and section subtotals for the
 * cashflow inspection dialog, matching Plutus spending projection semantics.
 */
export function computeCashflowSummary(
  params: ComputeCashflowSummaryParams
): CashflowSummaryMetrics {
  const { activeFlow, period, selectedCategory, totalCount, breakdown, partition, annualizedCategories } =
    params;
  const isCadence = isBudgetCadencePeriod(period);
  const isWeekly = isWeeklyBudgetPeriod(period);
  const isFiltered = selectedCategory !== 'ALL';

  const actualVolume = partition.actualTransactions.reduce((sum, tx) => sum + getTransactionNzdAmount(tx), 0);
  const amortizedVolume = partition.amortizedCommitments.reduce(
    (sum, tx) => sum + Math.abs(Number(tx.amortized_period_amount_nzd ?? 0)),
    0
  );
  const excludedVolume = partition.excludedTransactions.reduce((sum, tx) => sum + getTransactionNzdAmount(tx), 0);
  const annualizedShareTotal =
    activeFlow === 'outflow' && isCadence && !isFiltered
      ? annualizedCategories.reduce((sum, c) => sum + getAnnualizedPeriodShare(c.total_spend, isWeekly), 0)
      : 0;
  const headlineTotal = resolveCashflowHeadlineTotal({
    activeFlow, selectedCategory, breakdown, actualVolume, amortizedVolume, annualizedShareTotal,
  });
  const third = buildThirdSummaryMetric({
    activeFlow, isCadence, isWeekly, isFiltered, headlineTotal, totalCount,
    actualCount: partition.actualTransactions.length,
    amortizedCount: partition.amortizedCommitments.length,
    amortizedVolume,
    annualizedCount: annualizedCategories.length,
    annualizedShareTotal,
  });
  const itemSubvalue =
    partition.amortizedCommitments.length > 0 ? `+ ${partition.amortizedCommitments.length} fixed` : undefined;

  return {
    headlineTotal, itemCount: totalCount, itemSubvalue, ...third,
    actualVolume, amortizedVolume, excludedVolume, annualizedShareTotal,
  };
}
