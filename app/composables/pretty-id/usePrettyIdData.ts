/**
 * Data composable for the Choose / search side of the Pretty ID event.
 *
 * Queries only: `me`, the Choose list (length + tier filter) and the ID search.
 * Results land in `usePrettyIdStore`. Each load handles its own errors (toast +
 * log) and never throws, so callers may fire-and-forget.
 *
 * Staleness: a response is applied only if the query it answered is still the
 * one in the store, so a fast tier toggle never shows the previous tier's list.
 */

import { usePrettyIdApi } from '~/composables/pretty-id/usePrettyIdApi'
import { usePrettyIdToast } from '~/composables/pretty-id/usePrettyIdToast'
import { PRETTY_ID_ROUTES } from '~/constants/pretty-id'
import { usePrettyIdStore } from '~/stores/prettyId'
import type { PrettyIdLength, PrettyIdListQuery, PrettyIdTier } from '~/types/pretty-id'
import { toPrettyIdError } from '~/utils/pretty-id-error'
import { createLogger } from '~/utils/logger'

const log = createLogger('[PrettyIdData]')

export function usePrettyIdData() {
  const api = usePrettyIdApi()
  const store = usePrettyIdStore()
  const toast = usePrettyIdToast()

  function isCurrentQuery(query: PrettyIdListQuery): boolean {
    return store.listLength === query.length && store.listTier === query.tier
  }

  // ========================================
  // EXECUTE — queries
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

  /** Reloads the Choose list for the store's current length + tier. */
  async function loadList(): Promise<void> {
    const query: PrettyIdListQuery = { length: store.listLength, tier: store.listTier }
    store.setListLoading(true)
    try {
      const response = await api.list(query)
      // Stale: the filter changed while this was in flight. The newer load owns the flag.
      if (!isCurrentQuery(query)) return
      store.setList(response.items, response.total)
    } catch (err) {
      if (!isCurrentQuery(query)) return
      toast.error(toPrettyIdError(err).message)
      log.warn('Failed to load the ID list', { query, err })
    } finally {
      if (isCurrentQuery(query)) store.setListLoading(false)
    }
  }

  async function selectLength(length: PrettyIdLength): Promise<void> {
    store.setListLength(length)
    await loadList()
  }

  /** Re-selecting the active tier clears the filter. */
  async function toggleTier(tier: PrettyIdTier): Promise<void> {
    store.setListTier(store.listTier === tier ? null : tier)
    await loadList()
  }

  /** Looks the ID up and publishes it under `q`; a newer search wins. */
  async function runSearch(q: string): Promise<void> {
    store.setSearch(q, null)
    store.setSearching(true)
    try {
      const result = await api.search(q)
      if (store.searchQuery === q) store.setSearch(q, result)
    } catch (err) {
      if (store.searchQuery !== q) return
      toast.error(toPrettyIdError(err).message)
      log.warn('Search failed', { q, err })
    } finally {
      if (store.searchQuery === q) store.setSearching(false)
    }
  }

  // ========================================
  // GATE → navigate
  // ========================================

  /** Search box submit: validates, then opens the search page (which calls `runSearch`). */
  async function submitSearch(raw: string): Promise<void> {
    // GATE
    const q = raw.trim()
    if (q === '') {
      toast.error('Type an ID to search')
      return
    }
    // EXECUTE
    await navigateTo({ path: PRETTY_ID_ROUTES.search, query: { q } })
  }

  return { loadMe, loadList, selectLength, toggleTier, submitSearch, runSearch }
}
