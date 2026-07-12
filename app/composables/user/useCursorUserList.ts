// ========================================
// Cursor User List Composable
// ========================================
// Role: Orchestrator (GATE → EXECUTE → REACT) generic over any cursor-paginated
// user list (followers, following, visitors, ...). Holds items/loading/cursor
// state + infinite-scroll wiring; the page supplies the fetchPage fn and reacts
// to 403 (restricted) vs other errors via the onError callback.

import { useInfiniteScroll } from '@vueuse/core'

export interface CursorPage<T> {
  data: T[]
  nextCursor: string | null
}

export type CursorFetchPage<T> = (cursor: string | null) => Promise<CursorPage<T>>
export type CursorNormalizeError = (err: unknown) => { status?: number, message: string }

export function useCursorUserList<T extends { id: number }>(
  fetchPage: CursorFetchPage<T>,
  normalizeError: CursorNormalizeError,
) {
  const items = ref<T[]>([]) as Ref<T[]>
  const loading = ref(false)
  const nextCursor = ref<string | null>(null)
  const initialized = ref(false)
  const accessRestricted = ref(false)
  const containerRef = ref<HTMLElement | null>(null)

  /**
   * Load the next page (or reset + load the first page).
   * onError is called for any non-403 failure so the page can toast with its
   * own copy ("Failed to load followers" vs "Failed to load viewers", etc).
   */
  async function load(reset = false, onError?: (message: string) => void): Promise<void> {
    if (loading.value || (!reset && !nextCursor.value && initialized.value)) return

    loading.value = true
    if (reset) {
      items.value = []
      nextCursor.value = null
      accessRestricted.value = false
    }

    try {
      const { data, nextCursor: nc } = await fetchPage(nextCursor.value)
      items.value.push(...data)
      nextCursor.value = nc
      initialized.value = true
    }
    catch (err: unknown) {
      const normalized = normalizeError(err)
      if (normalized.status === 403) {
        accessRestricted.value = true
      }
      else {
        onError?.(normalized.message)
      }
    }
    finally {
      loading.value = false
    }
  }

  useInfiniteScroll(
    containerRef,
    async () => {
      if (nextCursor.value && !loading.value) await load()
    },
    { distance: 200 },
  )

  return { items, loading, nextCursor, initialized, accessRestricted, containerRef, load }
}
