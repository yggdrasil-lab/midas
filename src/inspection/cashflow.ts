import { isTransferCategory } from '../taxonomy';
import {
  Account,
  CashflowDirection,
  CategorySpendingReport,
  PeriodType,
  SpendingBreakdownResponse,
  TagCategoryBreakdownItem,
  TagSpendingSummaryItem,
  Transaction,
} from '../types';
import { getTransactionNzdAmount } from '../utils/format';
import {
  AccountCashflowSummary,
  CashflowPartition,
  CashflowSummaryMetrics,
  ComputeCashflowSummaryParams,
  TagStatsSummary,
} from './types';

/**
 * Returns true when the reporting window applies recurring commitment amortization
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
 * Returns true when the reporting window uses weekly cadence (`week`, `last_week`).
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
 * Partitions inspection transactions into active period flows, amortized recurring
 * commitments, and rows excluded from the active period budget.
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

function formatCadenceSubvalue(
  unit: 'wk' | 'mo',
  amortizedCount: number,
  annualizedCount: number,
  showAnnual: boolean
): string {
  if (amortizedCount > 0 && showAnnual) {
    return `${amortizedCount} fixed + ${annualizedCount} 52w`;
  }
  if (amortizedCount > 0) return `${amortizedCount} fixed /${unit}`;
  if (showAnnual) return `${annualizedCount} 52w /${unit}`;
  return `/${unit} share`;
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
  return {
    thirdMetricLabel: 'Fixed + 52w',
    thirdMetricValue: params.amortizedVolume + params.annualizedShareTotal,
    thirdMetricSubvalue: formatCadenceSubvalue(
      unit,
      params.amortizedCount,
      params.annualizedCount,
      showAnnual
    ),
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

  const actualVolume = partition.actualTransactions.reduce(
    (sum, tx) => sum + getTransactionNzdAmount(tx),
    0
  );
  const amortizedVolume = partition.amortizedCommitments.reduce(
    (sum, tx) => sum + Math.abs(Number(tx.amortized_period_amount_nzd ?? 0)),
    0
  );
  const excludedVolume = partition.excludedTransactions.reduce(
    (sum, tx) => sum + getTransactionNzdAmount(tx),
    0
  );
  const annualizedShareTotal =
    activeFlow === 'outflow' && isCadence && !isFiltered
      ? annualizedCategories.reduce(
          (sum, c) => sum + getAnnualizedPeriodShare(c.total_spend, isWeekly),
          0
        )
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
    partition.amortizedCommitments.length > 0
      ? `+ ${partition.amortizedCommitments.length} fixed`
      : undefined;

  return {
    headlineTotal, itemCount: totalCount, itemSubvalue, ...third,
    actualVolume, amortizedVolume, excludedVolume, annualizedShareTotal,
  };
}

/**
 * Aggregates spend, income, and transfers for an inspected account without
 * double-counting unlinked counterpart rows owned by another account.
 */
export function computeAccountCashflow(
  collapsed: Transaction[],
  account: Account | null
): AccountCashflowSummary {
  let totalSpend = 0;
  let totalIncome = 0;
  let totalTransfers = 0;
  for (const tx of collapsed) {
    if (account && tx.account_id !== account.id) continue;
    if (isTransferCategory(tx.category, tx)) {
      totalTransfers += Math.abs(tx.amount);
    } else if (tx.amount < 0) {
      totalSpend += Math.abs(tx.amount);
    } else if (tx.amount > 0) {
      totalIncome += tx.amount;
    }
  }
  return { totalSpend, totalIncome, totalTransfers };
}

/**
 * Computes spend totals and per-category breakdown pills for a tag inspection scope.
 */
export function computeTagStats(
  loading: boolean,
  transactionsCount: number,
  summary: TagSpendingSummaryItem | null,
  expenseTransactions: Transaction[]
): TagStatsSummary {
  if (loading && transactionsCount === 0 && summary) {
    return {
      totalSpend: summary.total_spend,
      txCount: summary.transaction_count,
      categories: summary.categories,
    };
  }
  const totalSpend = expenseTransactions.reduce(
    (sum, tx) => sum + getTransactionNzdAmount(tx),
    0
  );
  const roundedTotal = Math.round(totalSpend * 100) / 100;
  const byCat = new Map<string, { spend: number; count: number }>();

  for (const tx of expenseTransactions) {
    const cat = (tx.category || 'General').trim() || 'General';
    const entry = byCat.get(cat) || { spend: 0, count: 0 };
    entry.spend += getTransactionNzdAmount(tx);
    entry.count += 1;
    byCat.set(cat, entry);
  }
  const categories: TagCategoryBreakdownItem[] = Array.from(byCat.entries())
    .map(([category, data]) => ({
      category,
      total_spend: Math.round(data.spend * 100) / 100,
      transaction_count: data.count,
      percentage: roundedTotal > 0 ? Math.round((data.spend / roundedTotal) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.total_spend - a.total_spend || a.category.localeCompare(b.category));
  return { totalSpend: roundedTotal, txCount: expenseTransactions.length, categories };
}
