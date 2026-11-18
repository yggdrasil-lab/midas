import { formatCurrency, FormatCurrencyOptions } from '@yggdrasil-lab/ui';

/**
 * Formats an amount as localized currency while guarding against Intl RangeError
 * when minimumFractionDigits exceeds the default maximumFractionDigits (0).
 */
export function formatMoney(
  amount: number,
  options: FormatCurrencyOptions = {}
): string {
  const minDigits = options.minimumFractionDigits ?? 0;
  const maxDigits = Math.max(minDigits, options.maximumFractionDigits ?? minDigits);
  return formatCurrency(amount, {
    ...options,
    minimumFractionDigits: minDigits,
    maximumFractionDigits: maxDigits,
  });
}

/**
 * Formats a signed transaction amount with explicit + / - prefix and currency
 * suffix (e.g. "-$120.50 NZD", "+$500.00 USD").
 */
export function formatSignedTransactionAmount(
  amount: number,
  currency?: string,
  decimals = 2
): string {
  const numeric = Number(amount);
  const resolvedCurrency = currency?.trim() || 'NZD';
  const isBtc = resolvedCurrency.toUpperCase() === 'BTC';
  const formatted = formatMoney(numeric, {
    minimumFractionDigits: isBtc ? 2 : decimals,
    maximumFractionDigits: isBtc ? 8 : decimals,
    showPlusSign: true,
  });
  const prefixed = numeric === 0 ? `+${formatted}` : formatted;
  return `${prefixed} ${resolvedCurrency}`;
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
