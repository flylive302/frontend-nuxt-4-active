/**
 * Search-page composable: runs the ID search for the page's `?q=` and runs it
 * again whenever `?q=` changes (a new search, back/forward). An empty query is
 * skipped — there is nothing to look up.
 *
 * The result lands in `usePrettyIdStore` (`searchQuery` / `searchResult` /
 * `isSearching`), exactly as for any other `runSearch` caller.
 */

import { toValue, watch, type MaybeRefOrGetter } from 'vue'
import { usePrettyIdData } from '~/composables/pretty-id/usePrettyIdData'

export function usePrettyIdSearchPage(query: MaybeRefOrGetter<string>): void {
  const { runSearch } = usePrettyIdData()

  watch(
    () => toValue(query),
    (q) => {
      if (q === '') return
      void runSearch(q)
    },
    { immediate: true },
  )
}
