import type { InfiniteScrollItem } from '~/types/ui/infinite-scroll'

/**
 * Drops incoming rows whose `id` is already in the list (home-room-feed/09).
 *
 * The home feed's page 1 and page 2+ ride different transports with different
 * freshness — page 1 may come from a ~30s edge cache while page 2+ is always
 * live — and the listing is offset-paginated over a ranking that moves
 * (`trending_score`, recomputed every 60s). A room that climbs between the two
 * requests can therefore appear in both pages. This filter makes the duplicate
 * impossible to render; the symmetric miss (a room that *fell* between pages)
 * is accepted as bounded staleness and self-heals on the next refresh.
 *
 * Duplicate ids are not only cosmetic: the grid's cells are keyed by `id`, so a
 * repeated id breaks Vue's keyed reconciliation inside the virtual scroller.
 *
 * Order-preserving; first occurrence wins (existing rows always beat incoming).
 * Duplicates *within* one incoming page are dropped too.
 *
 * ⚠️ `hasMore` arithmetic must keep using the RAW incoming page length — the
 * server sent a full page whether or not some rows were already on screen.
 *
 * @param existing rows already rendered
 * @param incoming the page just fetched
 */
export function excludeExistingItems<Item extends InfiniteScrollItem>(
  existing: readonly Item[],
  incoming: readonly Item[]
): Item[] {
  const seen = new Set<InfiniteScrollItem['id']>()
  for (const item of existing) seen.add(item.id)

  const fresh: Item[] = []
  for (const item of incoming) {
    if (seen.has(item.id)) continue
    seen.add(item.id)
    fresh.push(item)
  }
  return fresh
}
