/**
 * Data composable for the Choose side of the Pretty ID event.
 *
 * Queries only: `me`, the browse list (tier + category, cursor-paged) and the
 * inline exact search. Results land in `usePrettyIdStore`. Each load handles its
 * own errors (toast + log) and never throws, so callers may fire-and-forget.
 *
 * Staleness: a response is applied only if the query it answered is still the
 * one in the store, so a fast tier / category toggle never shows the previous
 * query's list.
 */

import { usePrettyIdApi } from '~/composables/pretty-id/usePrettyIdApi'
import { usePrettyIdToast } from '~/composables/pretty-id/usePrettyIdToast'
import { usePrettyIdStore } from '~/stores/prettyId'
import type { PrettyIdCategory, PrettyIdTier } from '~/types/pretty-id'
import { toPrettyIdError } from '~/utils/pretty-id-error'
import { createLogger } from '~/utils/logger'

const log = createLogger('[PrettyIdData]')

const DIGITS_ONLY = /^\d+$/

export function usePrettyIdData() {
  const api = usePrettyIdApi()
  const store = usePrettyIdStore()
  const toast = usePrettyIdToast()

  function isCurrentList(tier: PrettyIdTier, category: PrettyIdCategory | null): boolean {
    return store.activeTier === tier && store.category === category
  }

  // ========================================
  // EXECUTE — me
  // ========================================

  async function loadMe(): Promise<void> {
    store.setMeLoading(true)
    try {
      store.setMe(await api.me())
      store.setMeFailed(false)
    } catch (err) {
      // With nothing loaded yet the shell shows a retry screen; a failed REFRESH
      // keeps the page up on the previous `me` and only toasts.
      if (store.me === null) store.setMeFailed(true)
      else toast.error(toPrettyIdError(err).message)
      log.warn('Failed to load me', err)
    } finally {
      store.setMeLoading(false)
    }
  }

  /** REACT to a refusal on a browse call: a locked tier means our `me` is stale. */
  function reactToBrowseError(err: unknown): void {
    const error = toPrettyIdError(err)
    toast.error(error.message)
    if (error.code === 'level_required') void loadMe()
  }

  // ========================================
  // EXECUTE — browse list
  // ========================================

  /** Reloads the first page for the store's active tier + category. Only a browsable tier has a list. */
  async function loadList(): Promise<void> {
    // GATE
    if (store.tierMode !== 'browse') {
      store.clearList()
      store.setListLoading(false)
      return
    }
    const tier = store.activeTier
    const category = store.category

    store.setListLoading(true)
    store.setListFailed(false)
    try {
      const response = await api.list({ tier, category })
      // Stale: the filter changed while this was in flight. The newer load owns the flag.
      if (!isCurrentList(tier, category)) return
      store.setList(response.items, response.total, response.next_cursor)
    } catch (err) {
      if (!isCurrentList(tier, category)) return
      store.setListFailed(true)
      reactToBrowseError(err)
      log.warn('Failed to load the ID list', { tier, category, err })
    } finally {
      if (isCurrentList(tier, category)) store.setListLoading(false)
    }
  }

  /** Appends the next page of the current list. */
  async function loadMore(): Promise<void> {
    // GATE
    const cursor = store.nextCursor
    if (cursor === null || store.tierMode !== 'browse' || store.isListLoading || store.isListLoadingMore) return
    const tier = store.activeTier
    const category = store.category

    store.setListLoadingMore(true)
    try {
      const response = await api.list({ tier, category, cursor })
      // Stale: the filter changed, or a refresh replaced the list this page continued.
      if (!isCurrentList(tier, category) || store.nextCursor !== cursor) return
      store.appendList(response.items, response.total, response.next_cursor)
    } catch (err) {
      if (!isCurrentList(tier, category)) return
      reactToBrowseError(err)
      log.warn('Failed to load more IDs', { tier, category, cursor, err })
    } finally {
      store.setListLoadingMore(false)
    }
  }

  /** Switching tier drops the filter, the search and the old list; the page reloads on the tier's new mode. */
  function selectTier(tier: PrettyIdTier): void {
    // GATE
    if (store.activeTier === tier) return
    // EXECUTE
    store.setActiveTier(tier)
    store.setCategory(null)
    store.setSearch('', 'idle')
    store.clearList()
  }

  /** Re-selecting the active category clears the filter. */
  async function toggleCategory(category: PrettyIdCategory): Promise<void> {
    store.setCategory(store.category === category ? null : category)
    await loadList()
  }

  // ========================================
  // EXECUTE — inline exact search
  // ========================================

  /**
   * Looks one number up inside the active tier. An empty box clears the search.
   * Anything that is not an available number of this tier's length is
   * `unavailable` — never says why (no owners). A newer search wins.
   */
  async function runSearch(raw: string): Promise<void> {
    // GATE
    const q = raw.trim()
    if (q === '') {
      store.setSearch('', 'idle')
      return
    }
    if (store.tierMode !== 'browse') return
    const tier = store.activeTier
    if (!DIGITS_ONLY.test(q) || q.length !== tier) {
      store.setSearch(q, 'unavailable')
      return
    }

    // EXECUTE
    store.setSearch(q, 'searching')
    const isCurrentSearch = (): boolean => store.searchQuery === q && store.activeTier === tier
    try {
      const response = await api.list({ tier, q })
      if (!isCurrentSearch()) return
      const hit = response.items.find(item => item.signature === q) ?? null
      store.setSearch(q, hit ? 'available' : 'unavailable', hit)
    } catch (err) {
      if (!isCurrentSearch()) return
      store.setSearch(q, 'failed')
      reactToBrowseError(err)
      log.warn('Search failed', { q, err })
    }
  }

  return { loadMe, loadList, loadMore, selectTier, toggleCategory, runSearch }
}

/**
 * Keeps the browse list loaded: it (re)loads whenever a browsable tier becomes
 * the active one — on entry once `me` has arrived, on a tier switch, and when a
 * refreshed `me` unlocks the tier. Call once, from the component that shows the list.
 */
export function useBrowseTierLoader(): void {
  const store = usePrettyIdStore()
  const { loadList } = usePrettyIdData()

  watch(
    () => store.browseTier,
    (tier) => {
      if (tier !== null) void loadList()
    },
    { immediate: true },
  )
}
