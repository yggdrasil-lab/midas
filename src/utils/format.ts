import { formatCurrency } from '@yggdrasil-lab/ui';
import { formatAccountTypeLabel } from '../constants/categories';
import { Account } from '../types';

/**
 * Re-exports shared clamped currency formatter under Midas's legacy `formatMoney` name.
 */
export const formatMoney = formatCurrency;

const CRYPTO_CURRENCIES = new Set(['BTC', 'ETH', 'SOL', 'USDC', 'USDT']);

/**
 * Returns true if the currency code represents a supported crypto asset.
 */
export function isCryptoCurrency(currency?: string | null): boolean {
  return CRYPTO_CURRENCIES.has((currency?.trim() || '').toUpperCase());
}

/**
 * Formats a signed transaction amount with explicit + / - prefix and currency
 * suffix (e.g. "-$120.50 NZD", "+$500.00 USD", "+0.04884012 BTC").
 */
export function formatSignedTransactionAmount(
  amount: number,
  currency?: string,
  decimals = 2
): string {
  const numeric = Number(amount);
  const resolvedCurrency = currency?.trim() || 'NZD';
  const isCrypto = isCryptoCurrency(resolvedCurrency);
  const formatted = formatMoney(numeric, {
    currency: isCrypto ? '' : '$',
    minimumFractionDigits: isCrypto ? 2 : decimals,
    maximumFractionDigits: isCrypto ? 8 : decimals,
    showPlusSign: true,
  });
  const prefixed = numeric === 0 ? `+${formatted}` : formatted;
  return `${prefixed} ${resolvedCurrency}`;
}

/**
 * Formats a transfer/miner fee cleanly for both fiat (2dp with $) and crypto
 * (up to 8dp without $).
 */
export function formatTransactionFee(
  feeAmount: number,
  currency?: string,
  exact = false
): string {
  const numeric = Math.abs(Number(feeAmount) || 0);
  const resolvedCurrency = (currency?.trim() || 'NZD').toUpperCase();
  const isCrypto = isCryptoCurrency(resolvedCurrency);
  const formatted = formatMoney(numeric, {
    currency: isCrypto ? '' : '$',
    minimumFractionDigits: isCrypto ? 2 : exact ? 2 : 0,
    maximumFractionDigits: isCrypto ? 8 : 2,
  });
  return `${formatted} ${resolvedCurrency}`;
}

/**
 * Returns the absolute NZD-normalized transaction amount using exchange_rate when foreign currency.
 */
export function getTransactionNzdAmount(tx: {
  amount: number;
  currency?: string | null;
  exchange_rate?: number | null;
}): number {
  const absAmount = Math.abs(Number(tx.amount) || 0);
  const currencyCode = (tx.currency || 'NZD').trim().toUpperCase();
  const rate = Number(tx.exchange_rate);
  if (currencyCode !== 'NZD' && Number.isFinite(rate) && rate > 0) {
    return absAmount * rate;
  }
  return absAmount;
}

/**
 * Formats an NZD Reporting Currency equivalent label (e.g. "NZD $6,820.40").
 */
export function formatNzdEquivalent(amount: number): string {
  const formatted = formatMoney(Number(amount) || 0, {
    currency: '$',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `NZD ${formatted}`;
}

/**
 * Formats an account's subtitle ("Institution • Type • X.X% p.a.") across
 * Account cards and inspection modals.
 */
export function formatAccountSubtitle(account: Account): string {
  const typeLabel = formatAccountTypeLabel(account.account_type);
  const showReturn =
    account.expected_annual_return > 0 &&
    (account.tier === 'growth' || account.account_type === 'private_note');
  const returnHint = showReturn
    ? ` • ${(account.expected_annual_return * 100).toFixed(1)}% p.a.`
    : '';
  return account.institution
    ? `${account.institution} • ${typeLabel}${returnHint}`
    : `${typeLabel}${returnHint}`;
}

/**
 * Formats cumulative earnings as a 1dp percentage of principal with
 * IEEE-754 half-up tie-breaking (e.g. 5015 / 10000 -> "50.2").
 */
export function formatPrincipalRecoveredPct(earned: number, principal: number): string | null {
  if (!Number.isFinite(earned) || !Number.isFinite(principal) || principal <= 0) {
    return null;
  }
  return (Math.round(((earned * 1000) / principal) + 1e-9) / 10).toFixed(1);
}
