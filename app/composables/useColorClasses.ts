// ========================================
// Color Classes Composable
// ========================================

import type { Colors } from '~/types/colors'

/**
 * Pre-defined Tailwind color classes for semantic colors.
 * Uses static class names to avoid JIT compilation issues.
 */
export const COLOR_CLASSES: Record<Colors, {
  border: string
  gradient: string
  emphasis: string
}> = {
  primary:   { border: 'border-primary',   gradient: 'bg-primary/5',   emphasis: 'ring-1 ring-primary/40' },
  secondary: { border: 'border-secondary', gradient: 'bg-secondary/5', emphasis: 'ring-1 ring-secondary/40' },
  tertiary:  { border: 'border-tertiary',  gradient: 'bg-tertiary/5',  emphasis: 'ring-1 ring-tertiary/40' },
  success:   { border: 'border-success',   gradient: 'bg-success/5',   emphasis: 'ring-1 ring-success/40' },
  info:      { border: 'border-info',      gradient: 'bg-info/5',      emphasis: 'ring-1 ring-info/40' },
  warning:   { border: 'border-warning',   gradient: 'bg-warning/5',   emphasis: 'ring-1 ring-warning/40' },
  error:     { border: 'border-error',     gradient: 'bg-error/5',     emphasis: 'ring-1 ring-error/40' }
}

/**
 * Composable for accessing color-based Tailwind classes.
 * Provides reactive access to border, gradient, and emphasis classes.
 *
 * @param color - Reactive color value
 * @returns Object with computed class getters
 *
 * @example
 * ```ts
 * const { borderClass, gradientClass, emphasisClass } = useColorClasses(toRef(props, 'color'))
 * ```
 */
export function useColorClasses(color: Ref<Colors>) {
  const borderClass = computed(() => COLOR_CLASSES[color.value].border)
  const gradientClass = computed(() => COLOR_CLASSES[color.value].gradient)
  const emphasisClass = computed(() => COLOR_CLASSES[color.value].emphasis)

  return {
    borderClass,
    gradientClass,
    emphasisClass,
    /** Direct access to all classes for the current color */
    classes: computed(() => COLOR_CLASSES[color.value])
  }
}
