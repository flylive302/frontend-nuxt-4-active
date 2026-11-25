/**
 * Pretty ID / Rare ID signature text rules (pretty-id-step2 17).
 *
 * A signature is letters A–Z and digits 0–9 only. Input is case-insensitive and
 * always handled UPPERCASE ("abc" = "ABC"). Leading zeros are significant.
 */

/** Anything that is not an ASCII letter or digit. Checked BEFORE uppercasing so
 *  non-ASCII letters that fold to ASCII ("ß" → "SS", "ı" → "I") never sneak in. */
const NON_SIGNATURE_CHARS = /[^A-Za-z0-9]/g
const SIGNATURE_CHARS_ONLY = /^[A-Za-z0-9]+$/

/** Typing filter: drops every character outside A–Z / 0–9, uppercases, caps at `maxLength`. */
export function normalizeSignatureInput(raw: string, maxLength: number): string {
  return raw.replace(NON_SIGNATURE_CHARS, '').toUpperCase().slice(0, maxLength)
}

/** True when `raw` is non-empty and made only of ASCII letters and digits (any case). */
export function isSignatureText(raw: string): boolean {
  return SIGNATURE_CHARS_ONLY.test(raw)
}
