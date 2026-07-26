import { HOME_CAROUSEL_ROOM_COUNT } from '~/constants/carousel'
import type { RoomsResponse } from '~/types/room/room'
import type { BootstrapRoom } from '~/types/user/bootstrap'

/**
 * A resolved home-rooms fetch, tagged with the country it was fetched for.
 *
 * The tag has to travel *inside* the payload rather than in a sibling ref:
 * `useAsyncData`'s `getCachedData` short-circuits the handler entirely on a
 * cache hit, so anything the handler assigns on the side goes stale exactly
 * when it matters.
 *
 * `country` is `''` for the unfiltered ("All") list.
 */
export interface HomeRoomsPayload {
  country: string
  res: RoomsResponse
}

/** One page handed to the home grid. Shaped for `InfiniteScroll`'s fetcher contract. */
export interface HomeRoomsListPage {
  data: BootstrapRoom[]
  meta?: RoomsResponse['meta']
}

interface HomeRoomsListDeps {
  /** The payload currently on screen, or `null` before the first one resolves. */
  payload: () => HomeRoomsPayload | null
  /** Transport for page 2 and beyond. */
  fetchRooms: (params: { page: number; country?: string }) => Promise<RoomsResponse>
}

/**
 * Builds the home grid's page fetcher.
 *
 * Both pages read their country from the payload on screen, never from the
 * chip the user just tapped:
 *
 * - Page 1 is sliced out of that same payload object, so the rows and the
 *   country label the grid is keyed by are physically incapable of disagreeing.
 * - Page 2+ sends that payload's country, so a country switch that lands
 *   mid-scroll can't interleave rows from two countries.
 */
export function createHomeRoomsListFetcher(
  deps: HomeRoomsListDeps
): (context: { page: number }) => Promise<HomeRoomsListPage> {
  return async ({ page }) => {
    const payload = deps.payload()

    if (page === 1) {
      return {
        data: payload?.res.data?.slice(HOME_CAROUSEL_ROOM_COUNT) ?? [],
        meta: payload?.res.meta,
      }
    }

    const params: { page: number; country?: string } = { page }
    if (payload?.country) params.country = payload.country

    const res = await deps.fetchRooms(params)
    return { data: res.data, meta: res.meta }
  }
}

/**
 * Whether a `useAsyncData` resolution may be served from the cached payload
 * instead of the network. Only this page instance's very first paint may.
 *
 * The guard is not optional. Nuxt tags *every* reactive-key change with
 * `cause: 'initial'` — there is no cause that distinguishes "first mount" from
 * "user switched country" — and supplying a custom `getCachedData` also turns
 * off Nuxt's purge of `payload.data[key]`. So without `hasPainted`, tapping
 * back to a country visited earlier in the session resolves synchronously from
 * a frozen snapshot and never refetches again: stale participant counts and
 * closed rooms, for the rest of the session.
 *
 * @param cause      the `cause` Nuxt passes to `getCachedData`
 * @param hasPainted whether this page instance has already mounted once
 */
export function shouldReuseCachedRooms(cause: string, hasPainted: boolean): boolean {
  return cause === 'initial' && !hasPainted
}

/**
 * True while the rooms on screen belong to a country the user is no longer
 * looking at — the window between tapping a chip and its payload resolving.
 *
 * Nuxt seeds a newly-keyed `useAsyncData` slot with the *previous* key's data,
 * so this window is real on every chip tap and `status === 'pending'` alone
 * cannot detect it (the payload is non-null the whole time). Render the
 * skeleton through it, or the user taps US and keeps seeing PK rooms for a beat.
 *
 * An errored fetch never settles, so it must not pin the skeleton on forever.
 * Nuxt resets `data` to the default (`undefined`) on error, so this falls
 * through to the empty state — the same thing a failed load showed before this
 * predicate existed. An endless skeleton would be strictly worse.
 *
 * @param selectedCountry the chip the user has tapped (`''` = All)
 * @param loadedCountry   the country the on-screen payload was fetched for, `null` if none yet
 * @param status          the `useAsyncData` status for the current country
 */
export function isHomeCountrySettling(
  selectedCountry: string,
  loadedCountry: string | null,
  status: 'idle' | 'pending' | 'success' | 'error'
): boolean {
  if (status === 'error') return false
  return loadedCountry !== selectedCountry
}
