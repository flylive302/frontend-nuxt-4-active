/**
 * Nuxt UI Type Extensions
 *
 * Extends Nuxt UI's color types to include custom theme colors.
 * This eliminates the need for `as any` casts when using custom colors.
 */

/**
 * Custom application colors used across the UI.
 * These extend the default Nuxt UI color palette.
 */
export type AppColor =
  | 'primary'
  | 'secondary'
  | 'tertiary'
  | 'info'
  | 'success'
  | 'warning'
  | 'error'
  | 'neutral'

/**
 * Status colors for coin request states
 */
export type StatusColor = 'primary' | 'success' | 'error' | 'warning' | 'neutral' | 'info'
