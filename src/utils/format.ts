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
  const formatted = formatMoney(numeric, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    showPlusSign: true,
  });
  const prefixed = numeric === 0 ? `+${formatted}` : formatted;
  const resolvedCurrency = currency?.trim() || 'NZD';
  return `${prefixed} ${resolvedCurrency}`;
}
