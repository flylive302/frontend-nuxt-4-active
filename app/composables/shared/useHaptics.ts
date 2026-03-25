// ========================================
// Haptics Composable
// ========================================

// ========================================
// Types
// ========================================

/** Built-in haptic presets provided by web-haptics */
type HapticPresetName = 'success' | 'nudge' | 'error' | 'buzz'

// ========================================
// Composable
// ========================================

/**
 * SSR-safe composable for triggering haptic feedback on mobile devices.
 * Wraps `web-haptics/vue` with client-only guards for Nuxt compatibility.
 *
 * @example
 * ```vue
 * <script setup lang="ts">
 * const { haptic } = useHaptics()
 * </script>
 *
 * <template>
 *   <UButton @click="haptic('success')">Send Gift</UButton>
 * </template>
 * ```
 */
export function useHaptics() {
  // ========================================
  // State
  // ========================================

  const isHapticsSupported = ref(false)

  // Lazy-loaded trigger/cancel from web-haptics (client-only)
  let _trigger: ((input?: string | number | number[]) => Promise<void> | undefined) | null = null
  let _cancel: (() => void) | null = null

  // ========================================
  // Initialization (Client Only)
  // ========================================

  if (import.meta.client) {
    import('web-haptics').then(({ WebHaptics }) => {
      const haptics = new WebHaptics()
      _trigger = (input) => haptics.trigger(input)
      _cancel = () => haptics.cancel()
      isHapticsSupported.value = WebHaptics.isSupported
    })
  }

  // ========================================
  // Public API
  // ========================================

  /**
   * Trigger haptic feedback with a named preset.
   * No-ops silently on server or unsupported devices.
   */
  function haptic(preset: HapticPresetName): void {
    _trigger?.(preset)
  }

  /**
   * Trigger haptic feedback with a custom vibration pattern.
   * Pattern values are durations in ms: [vibrate, pause, vibrate, pause, ...].
   * No-ops silently on server or unsupported devices.
   */
  function hapticPattern(pattern: number[]): void {
    _trigger?.(pattern)
  }

  /**
   * Cancel any ongoing haptic vibration.
   */
  function cancelHaptic(): void {
    _cancel?.()
  }

  // ========================================
  // Return
  // ========================================

  return {
    haptic,
    hapticPattern,
    cancelHaptic,
    isHapticsSupported: readonly(isHapticsSupported),
  }
}
