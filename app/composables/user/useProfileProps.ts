// ========================================
// Profile Props Composable
// ========================================

import type { ProfilePropItem } from '~/types/user/user-profile'
import { createLogger } from '~/utils/logger'

const log = createLogger('[useProfileProps]')

interface UseProfilePropsOptions {
  /** Number of props per pagination page */
  perPage?: number
}

/**
 * Cursor-paginated list of another user's active props (entries or frames)
 * for the public profile tabs. Lazy: nothing is fetched until `ensureLoaded()`.
 *
 * @param signature - Reactive getter for the user's signature
 * @param type - Prop type to list ('entry_animation' | 'frame')
 */
export function useProfileProps(
  signature: MaybeRefOrGetter<string>,
  type: 'entry_animation' | 'frame',
  options: UseProfilePropsOptions = {}
) {
  const { api } = useApi()
  const { perPage = 20 } = options

  // ========================================
  // State
  // ========================================

  const items = ref<ProfilePropItem[]>([])
  const loading = ref(false)
  const hasMore = ref(true)
  const loaded = ref(false)
  const cursor = ref<string | null>(null)

  // ========================================
  // Actions
  // ========================================

  /**
   * Fetch the next page of props.
   */
  async function fetchMore(): Promise<void> {
    // GATE
    const sig = toValue(signature)
    if (!sig || loading.value || !hasMore.value) return

    // EXECUTE
    loading.value = true
    try {
      const params: Record<string, unknown> = { type, per_page: perPage }
      if (cursor.value) {
        params.cursor = cursor.value
      }

      const response = await api<{
        status: 'success'
        data: ProfilePropItem[]
        meta: { next_cursor: string | null; has_more: boolean }
      }>(`/users/profile/${sig}/props`, { params })

      items.value.push(...response.data)
      cursor.value = response.meta.next_cursor
      hasMore.value = response.meta.has_more
      loaded.value = true
    } catch (err) {
      // REACT — non-fatal: tab shows empty state, log only
      log.warn(`Failed to load ${type} props`, err)
    } finally {
      loading.value = false
    }
  }

  /**
   * Fetch the first page once (called on tab activation).
   */
  async function ensureLoaded(): Promise<void> {
    if (loaded.value || loading.value) return
    await fetchMore()
  }

  /**
   * Reset pagination state (on signature change).
   */
  function reset(): void {
    items.value = []
    loading.value = false
    hasMore.value = true
    loaded.value = false
    cursor.value = null
  }

  watch(() => toValue(signature), (newSig, oldSig) => {
    if (newSig !== oldSig) {
      reset()
    }
  })

  return {
    items: readonly(items),
    loading: readonly(loading),
    hasMore: readonly(hasMore),
    loaded: readonly(loaded),
    fetchMore,
    ensureLoaded,
    reset,
  }
}
