/**
 * Currency Utility Functions
 * 
 * Utilities for parsing and formatting currency values returned from the backend.
 * Backend returns currency fields as strings to preserve decimal precision.
 */

/**
 * Parse a currency string to a number.
 * Returns 0 if the string is invalid or undefined.
 */
export function parseCurrency(value: string | undefined | null): number {
  if (!value) return 0;
  const parsed = parseFloat(value);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Format a currency value for display with abbreviations (e.g., "1.5M" for large values).
 */
export function formatCurrency(value: string | number | undefined | null): string {
  const num = typeof value === 'string' ? parseCurrency(value) : (value ?? 0);
  
  if (num >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(1)}M`;
  }
  if (num >= 1_000) {
    return `${(num / 1_000).toFixed(1)}K`;
  }
  return num.toFixed(0);
}

/**
 * Exact whole-coin amount with thousands separators ("1,234,567"). Never
 * abbreviated to K/M — used where the sender must see the real spendable
 * balance (lucky combo float, gift drawer). `en-US` is pinned so the
 * separator is the same on every device locale. Display-only: the input is
 * never rounded up, only truncated to a whole coin.
 */
export function formatCoins(value: string | number | undefined | null): string {
  const num = typeof value === 'string' ? parseCurrency(value) : (value ?? 0);
  return Math.trunc(num).toLocaleString('en-US');
}

/**
 * Format with full decimal precision for display.
 */
export function formatCurrencyPrecise(value: string | undefined | null): string {
  if (!value) return '0.00';
  const num = parseCurrency(value);
  return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 3 });
}

/**
 * Format XP value for display (typically whole numbers shown with abbreviations).
 */
export function formatXp(value: string | number | undefined | null): string {
  return formatCurrency(value);
}
