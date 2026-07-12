// ========================================
// Profile Badges Composable
// ========================================

import type { Badge } from '~/types/progression/badge'
import { createLogger } from '~/utils/logger'

const log = createLogger('[useProfileBadges]')

/**
 * List of another user's active badges for the public profile tab.
 * Lazy: nothing is fetched until `ensureLoaded()`. Not paginated —
 * badge counts are small.
 *
 * @param signature - Reactive getter for the user's signature
 */
export function useProfileBadges(signature: MaybeRefOrGetter<string>) {
  const { api } = useApi()

  // ========================================
  // State
  // ========================================

  const items = ref<Badge[]>([])
  const loading = ref(false)
  const loaded = ref(false)

  // ========================================
  // Actions
  // ========================================

  /**
   * Fetch the user's active badges once (called on tab activation).
   */
  async function ensureLoaded(): Promise<void> {
    // GATE
    const sig = toValue(signature)
    if (!sig || loaded.value || loading.value) return

    // EXECUTE
    loading.value = true
    try {
      const response = await api<{ status: 'success'; data: Badge[] }>(
        `/users/profile/${sig}/badges`
      )
      items.value = response.data
      loaded.value = true
    } catch (err) {
      // REACT — non-fatal: tab shows empty state, log only
      log.warn('Failed to load badges', err)
    } finally {
      loading.value = false
    }
  }

  /**
   * Reset state (on signature change).
   */
  function reset(): void {
    items.value = []
    loading.value = false
    loaded.value = false
  }

  watch(() => toValue(signature), (newSig, oldSig) => {
    if (newSig !== oldSig) {
      reset()
    }
  })

  return {
    items: readonly(items),
    loading: readonly(loading),
    loaded: readonly(loaded),
    ensureLoaded,
    reset,
  }
}
