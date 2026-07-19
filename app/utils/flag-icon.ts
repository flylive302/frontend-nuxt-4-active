/** Country codes with no matching icon in the flag set */
const INVALID_FLAG_CODES = new Set(['an'])

/** Fallback shown when the code is missing or has no flag icon */
export const DEFAULT_FLAG_ICON = 'i-lucide-earth'

/** Map a country code to its flag icon name; safe for null/undefined/blank codes */
export function getFlagIcon(code: string | null | undefined): string {
  const normalized = (code ?? '').toLowerCase().trim()
  if (!normalized || normalized === 'undefined' || normalized === 'null') return DEFAULT_FLAG_ICON
  if (INVALID_FLAG_CODES.has(normalized)) return DEFAULT_FLAG_ICON
  const flagCode = normalized === 'uk' ? 'gb' : normalized
  return `i-flag-${flagCode}-4x3`
}
