import type { InfiniteScrollPaginationMeta } from '~/types/ui/infinite-scroll'

/**
 * One page as a fetcher may return it: rows plus optional pagination, or bare rows.
 *
 * `Item` is unconstrained on purpose. The component narrows it to
 * `InfiniteScrollItem` because *rendering* needs an `id` for the scroller's
 * key-field; deciding whether another page exists does not, and demanding one
 * here would only force callers whose rows are real domain models (which cannot
 * satisfy an index signature) to cast at the seam.
 */
export type InfiniteScrollPayload<Item> =
  | { data: Item[]; meta?: InfiniteScrollPaginationMeta }
  | Item[]

/**
 * Whether another page exists after the one just loaded.
 *
 * Server counts win when the payload reports them: `page * perPage < total` is
 * exact, and unlike a row count it survives a consumer that slices rows off the
 * page before rendering (the home carousel skims the first five). Only when the
 * server reports no `total` do we fall back to "a full page came back, so there
 * is probably another".
 *
 * Every field is backstopped by `fallback` — the page and perPage the component
 * actually requested. A payload missing `perPage` used to make the full-page
 * comparison read `length >= undefined`, and a payload missing it *while*
 * reporting a total made the exact comparison read `NaN < total`. Both are
 * `false`, which halts the scroller permanently and looks identical to a real
 * end of list. Degrading to the requested values instead means a consumer that
 * forgets to normalize keeps paging rather than silently truncating.
 *
 * A payload that supplies all three fields is unaffected by the backstops.
 *
 * @param payload  what the fetcher returned
 * @param rows     the rows extracted from it
 * @param fallback the page/perPage this load was requested with
 */
export function evaluateHasMore<Item>(
  payload: InfiniteScrollPayload<Item>,
  rows: Item[],
  fallback: { page: number; perPage: number }
): boolean {
  if (Array.isArray(payload) || !payload.meta) {
    return rows.length >= fallback.perPage
  }

  const { page, perPage, total } = payload.meta
  const resolvedPage = page ?? fallback.page
  const resolvedPerPage = perPage ?? fallback.perPage

  if (typeof total === 'number') {
    return resolvedPage * resolvedPerPage < total
  }
  return rows.length >= resolvedPerPage
}
