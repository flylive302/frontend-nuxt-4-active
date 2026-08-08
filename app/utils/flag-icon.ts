/**
 * Country flag resolution (ADR 0027).
 *
 * Flags are STATIC FILES under `public/flags/<code>.svg`, generated from
 * @iconify-json/flag by `scripts/generate-flags.mjs`. They are deliberately NOT
 * Iconify icon names: the name used to be built at runtime
 * (`i-flag-${code}-4x3`) from 245 country codes, which no static scan can see,
 * so @nuxt/icon bundled none of them and fetched every flag from
 * api.iconify.design. Bundling them instead costs 416 KB brotli in an eagerly
 * imported chunk — paid by every session. Static files are lazy.
 *
 * ⚠️ Prefer the `<CountryFlag :code="…" />` component over calling this
 * directly; it owns the <img> / fallback-<UIcon> fork.
 */

/** Country codes with no matching flag. MUST match `scripts/generate-flags.mjs`. */
const INVALID_FLAG_CODES = new Set(['an'])

/** Country-data code -> flag-file code. MUST match `scripts/generate-flags.mjs`. */
const CODE_REMAP: Record<string, string> = { uk: 'gb' }

/**
 * Fallback icon shown when the code is missing, has no flag, or the file 404s.
 * This is a real Iconify icon name (bundled), not a flag file — which is why
 * CountryFlag has two render paths.
 */
export const DEFAULT_FLAG_ICON = 'i-lucide-earth'

/** Normalize a country code; returns null when it cannot name a flag. */
export function normalizeCountryCode(code: string | null | undefined): string | null {
  const normalized = (code ?? '').toLowerCase().trim()
  if (!normalized || normalized === 'undefined' || normalized === 'null') return null
  if (INVALID_FLAG_CODES.has(normalized)) return null
  return CODE_REMAP[normalized] ?? normalized
}

/**
 * Map a country code to its flag SVG URL; safe for null/undefined/blank codes.
 *
 * @returns The public path, or null when the caller should render
 *          {@link DEFAULT_FLAG_ICON} instead.
 */
export function getFlagSrc(code: string | null | undefined): string | null {
  const normalized = normalizeCountryCode(code)
  return normalized ? `/flags/${normalized}.svg` : null
}
