/**
 * Literal Tailwind class lookups keyed by semantic colour.
 *
 * Tailwind v4 extracts class candidates from literal source text only. A
 * template literal like `text-${color}` produces no candidate, so the utility
 * is emitted only if some unrelated file happens to write it literally — and
 * disappears silently when that file changes (see `grid-cols-6`, 2026-09-12).
 *
 * Typed as `Record<Colors, string>` so adding a colour to `Colors` is a
 * typecheck failure here, not another missing style in production.
 */
import type { Colors } from '~/types/colors'

export const COLOR_TEXT_CLASS: Record<Colors, string> = {
  primary: 'text-primary',
  secondary: 'text-secondary',
  tertiary: 'text-tertiary',
  success: 'text-success',
  info: 'text-info',
  warning: 'text-warning',
  error: 'text-error',
}

export const COLOR_BORDER_CLASS: Record<Colors, string> = {
  primary: 'border-primary',
  secondary: 'border-secondary',
  tertiary: 'border-tertiary',
  success: 'border-success',
  info: 'border-info',
  warning: 'border-warning',
  error: 'border-error',
}

/** 10% tinted surface, e.g. a highlighted row or amount pill. */
export const COLOR_BG_10_CLASS: Record<Colors, string> = {
  primary: 'bg-primary/10',
  secondary: 'bg-secondary/10',
  tertiary: 'bg-tertiary/10',
  success: 'bg-success/10',
  info: 'bg-info/10',
  warning: 'bg-warning/10',
  error: 'bg-error/10',
}

/** Accent colours that carry a gradient bar (`SectionTitle`). */
export type AccentColor = Extract<Colors, 'primary' | 'secondary' | 'tertiary'>

/**
 * `from-X` + `to-X/10` pair for `SectionTitle`'s accent bar. Was built by
 * `replace('from-', 'to-') + '/10'` until 2026-09-15 — `to-primary/10` and
 * `to-secondary/10` were never in the production CSS.
 */
export const ACCENT_GRADIENT_CLASS: Record<AccentColor, string> = {
  primary: 'from-primary to-primary/10',
  secondary: 'from-secondary to-secondary/10',
  tertiary: 'from-tertiary to-tertiary/10',
}
