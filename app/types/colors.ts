/**
 * Centralized color type definitions for the application
 * 
 * These colors correspond to the semantic colors defined in app.config.ts:
 * - primary: pink
 * - secondary: purple
 * - tertiary: amber
 * - info: sky
 * - success: emerald
 * - warning: yellow
 * - error: red
 */

/**
 * Semantic color values used throughout the application
 * These are the standard semantic colors that components accept
 */
export type Colors = 'primary' | 'secondary' | 'tertiary' | 'success' | 'info' | 'warning' | 'error'

/**
 * Extended color type that includes neutral
 * Use this when neutral is also a valid option
 */
export type ExtendedColors = Colors | 'neutral'

/**
 * Nuxt UI color prop values (Tailwind color names)
 * These are the actual Tailwind color names that Nuxt UI components accept
 */
export type NuxtUIColor = 'primary' | 'gray' | 'black' | 'white' | 'red' | 'orange' | 'yellow' | 'green' | 'emerald' | 'teal' | 'cyan' | 'blue' | 'indigo' | 'violet' | 'purple' | 'pink' | 'rose' | 'sky' | 'amber' | 'neutral'

/**
 * Maps semantic Colors (including ExtendedColors) to Nuxt UI color prop values
 * This mapping matches app.config.ts exactly:
 * - primary → pink (configured in app.config.ts)
 * - secondary → purple (configured in app.config.ts)
 * - tertiary → amber (configured in app.config.ts)
 * - success → emerald (configured in app.config.ts)
 * - info → sky (configured in app.config.ts)
 * - warning → yellow (configured in app.config.ts)
 * - error → red (configured in app.config.ts)
 * - neutral → neutral (configured in app.config.ts)
 * 
 * Note: Since semantic colors are configured in app.config.ts, you can often use
 * them directly with Nuxt UI components. This map is for cases where you need
 * the raw Tailwind color name.
 */
export const COLORS_TO_NUXT_UI: Record<ExtendedColors, NuxtUIColor> = {
  primary: 'pink',
  secondary: 'purple',
  tertiary: 'amber',
  success: 'emerald',
  info: 'sky',
  warning: 'yellow',
  error: 'red',
  neutral: 'neutral'
} as const