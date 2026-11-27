import { isRevolvingCreditAccount } from '../taxonomy';
import { Account, AssetSnapshot } from '../types';

export type CreditUtilizationSeverity = 'emerald' | 'amber' | 'rose';

export interface AccountCreditMetrics {
  account: Account;
  hasLimit: boolean;
  limitNative: number | null;
  limitNzd: number | null;
  owedNative: number;
  owedNzd: number;
  availableNative: number | null;
  availableNzd: number | null;
  utilizationPct: number | null;
  severity: CreditUtilizationSeverity;
  isCreditLine: boolean;
  isOverLimit: boolean;
}

export interface CreditBackstopSectionSummary {
  revolvingAccounts: AccountCreditMetrics[];
  configuredCount: number;
  totalLimitNzd: number;
  totalOwedNzd: number;
  totalAvailableNzd: number;
  utilizationPct: number;
  severity: CreditUtilizationSeverity;
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** Maps credit utilization percentage into emerald (<30%), amber (30-69.9%), or rose (>=70%). */
export function getCreditUtilizationSeverity(
  utilizationPct: number | null | undefined
): CreditUtilizationSeverity {
  if (utilizationPct === null || utilizationPct === undefined || !Number.isFinite(utilizationPct)) {
    return 'emerald';
  }
  if (utilizationPct >= 70) return 'rose';
  if (utilizationPct >= 30) return 'amber';
  return 'emerald';
}

/** Maps utilization severity to shared StatusBadge semantic variant. */
export function getCreditSeverityBadgeVariant(
  severity: CreditUtilizationSeverity
): 'success' | 'warning' | 'error' {
  if (severity === 'rose') return 'error';
  if (severity === 'amber') return 'warning';
  return 'success';
}

/** Maps utilization severity to Tailwind text color class. */
export function getCreditSeverityTextClass(severity: CreditUtilizationSeverity): string {
  if (severity === 'rose') return 'text-rose-400';
  if (severity === 'amber') return 'text-amber-400';
  return 'text-emerald-400';
}

function resolveCreditFxRate(account: Account, latestSnapshot?: AssetSnapshot | null): number {
  if ((account.currency || 'NZD').trim().toUpperCase() === 'NZD') {
    return 1;
  }
  if (account.credit_limit && account.credit_limit_nzd && account.credit_limit > 0) {
    return account.credit_limit_nzd / account.credit_limit;
  }
  const snapRate = Number(latestSnapshot?.exchange_rate);
  if (Number.isFinite(snapRate) && snapRate > 0 && snapRate !== 1) {
    return snapRate;
  }
  if (latestSnapshot && Number(latestSnapshot.balance) !== 0 && Number.isFinite(latestSnapshot.balance_nzd)) {
    const derived = Math.abs(Number(latestSnapshot.balance_nzd) / Number(latestSnapshot.balance));
    if (Number.isFinite(derived) && derived > 0) return derived;
  }
  return Number.isFinite(snapRate) && snapRate > 0 ? snapRate : 1;
}

function hasFreshServerTelemetry(
  account: Account,
  snapOwedNative: number | null
): boolean {
  const hasAll =
    account.credit_limit_nzd != null &&
    account.credit_owed_native != null &&
    account.credit_owed_nzd != null &&
    account.available_credit_native != null &&
    account.available_credit_nzd != null &&
    account.credit_utilization_pct != null;
  if (!hasAll) return false;
  if (snapOwedNative === null) return true;
  return Math.abs(snapOwedNative - Number(account.credit_owed_native)) <= 0.01;
}

function buildUnconfiguredMetrics(
  account: Account,
  isCreditLine: boolean,
  owedNative: number,
  owedNzd: number
): AccountCreditMetrics {
  return {
    account,
    hasLimit: false,
    limitNative: null,
    limitNzd: null,
    owedNative,
    owedNzd,
    availableNative: null,
    availableNzd: null,
    utilizationPct: null,
    severity: 'emerald',
    isCreditLine,
    isOverLimit: false,
  };
}

function buildServerMetrics(
  account: Account,
  limitNative: number,
  isCreditLine: boolean
): AccountCreditMetrics {
  const utilizationPct = Number(account.credit_utilization_pct);
  return {
    account,
    hasLimit: true,
    limitNative,
    limitNzd: Number(account.credit_limit_nzd),
    owedNative: Number(account.credit_owed_native),
    owedNzd: Number(account.credit_owed_nzd),
    availableNative: Number(account.available_credit_native),
    availableNzd: Number(account.available_credit_nzd),
    utilizationPct,
    severity: getCreditUtilizationSeverity(utilizationPct),
    isCreditLine,
    isOverLimit: utilizationPct > 100,
  };
}

/** Computes credit utilization and available headroom for a single credit card or credit line. */
export function computeAccountCreditMetrics(
  account: Account,
  latestSnapshot?: AssetSnapshot | null
): AccountCreditMetrics {
  const isCreditLine = (account.account_type || '').trim().toLowerCase() === 'credit_line';
  const limitNative =
    account.credit_limit != null && Number.isFinite(account.credit_limit) && account.credit_limit > 0
      ? Number(account.credit_limit)
      : null;
  const fxRate = resolveCreditFxRate(account, latestSnapshot);
  const snapOwedNative = latestSnapshot ? round2(Math.max(0, -Number(latestSnapshot.balance))) : null;
  const snapOwedNzd = latestSnapshot
    ? round2(Math.max(0, -Number(latestSnapshot.balance_nzd ?? Number(latestSnapshot.balance) * fxRate)))
    : null;

  if (limitNative === null) {
    return buildUnconfiguredMetrics(account, isCreditLine, snapOwedNative ?? 0, snapOwedNzd ?? 0);
  }
  if (hasFreshServerTelemetry(account, snapOwedNative)) {
    return buildServerMetrics(account, limitNative, isCreditLine);
  }

  const owedNative = snapOwedNative ?? round2(Number(account.credit_owed_native ?? 0));
  const owedNzd = snapOwedNzd ?? round2(owedNative * fxRate);
  const limitNzd = round2(limitNative * fxRate);
  const utilizationPct = round2((owedNative / limitNative) * 100);

  return {
    account,
    hasLimit: true,
    limitNative,
    limitNzd,
    owedNative,
    owedNzd,
    availableNative: round2(Math.max(0, limitNative - owedNative)),
    availableNzd: round2(Math.max(0, limitNzd - owedNzd)),
    utilizationPct,
    severity: getCreditUtilizationSeverity(utilizationPct),
    isCreditLine,
    isOverLimit: utilizationPct > 100,
  };
}

/** Aggregates section-level NZD credit backstop totals across active revolving credit accounts. */
export function buildCreditBackstopSummary(
  accounts: Account[],
  snapshotsByAccount: Record<number, AssetSnapshot[]>
): CreditBackstopSectionSummary {
  const revolvingAccounts = accounts
    .filter((acc) => acc.is_active !== false && isRevolvingCreditAccount(acc.account_type))
    .map((acc) => computeAccountCreditMetrics(acc, snapshotsByAccount[acc.id]?.[0]));

  let configuredCount = 0;
  let totalLimitNzd = 0;
  let totalOwedNzd = 0;
  let totalAvailableNzd = 0;

  for (const item of revolvingAccounts) {
    totalOwedNzd += item.owedNzd;
    if (item.hasLimit && item.limitNzd !== null && item.availableNzd !== null) {
      configuredCount += 1;
      totalLimitNzd += item.limitNzd;
      totalAvailableNzd += item.availableNzd;
    }
  }

  const roundedLimit = round2(totalLimitNzd);
  const roundedOwed = round2(totalOwedNzd);
  const roundedAvailable = round2(totalAvailableNzd);
  const utilizationPct = roundedLimit > 0 ? round2((roundedOwed / roundedLimit) * 100) : 0;

  return {
    revolvingAccounts,
    configuredCount,
    totalLimitNzd: roundedLimit,
    totalOwedNzd: roundedOwed,
    totalAvailableNzd: roundedAvailable,
    utilizationPct,
    severity: getCreditUtilizationSeverity(utilizationPct),
  };
}
