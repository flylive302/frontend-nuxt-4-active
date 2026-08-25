import { CACHE_TTL } from '~/constants/cache'
import { HOME_CAROUSEL_ROOM_COUNT } from '~/constants/carousel'
import { HOME_ROOMS_PER_PAGE } from '~/constants/room'
import type { RoomsResponse } from '~/types/room/room'
import type { InfiniteScrollPaginationMeta } from '~/types/ui/infinite-scroll'
import type { BootstrapRoom } from '~/types/user/bootstrap'
import { getRetryAfterSeconds, isTooManyRequestsError } from '~/utils/api/retry-policy'

/**
 * Thrown by the grid's page fetcher when rooms are currently rate-limited, or when
 * `fetchRooms` itself came back 429. Shaped like an `ofetch` error (`response.status`)
 * so `isTooManyRequestsError`/`roomsFetchErrorMessage` classify it the same as a real
 * network 429 — the grid never needs to tell the two apart.
 */
export class RoomsRateLimitedError extends Error {
  response = { status: 429 as const }

  constructor(message = 'Rooms requests are rate-limited') {
    super(message)
    this.name = 'RoomsRateLimitedError'
  }
}

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
  /**
   * Epoch ms when this payload resolved (home-room-feed/15). Optional so an
   * older cached payload without the tag reads as "age unknown" → refresh.
   */
  fetchedAt?: number
}

/** One page handed to the home grid. Shaped for `InfiniteScroll`'s fetcher contract. */
export interface HomeRoomsListPage {
  data: BootstrapRoom[]
  meta?: InfiniteScrollPaginationMeta
}

/**
 * Translates Laravel's nested snake-case pagination into the flat camelCase
 * shape `InfiniteScroll` reads.
 *
 * Without this the grid destructures `{page, perPage, total}` off an object
 * that only carries `{pagination, active_countries}`, gets three `undefined`s,
 * and stops after page 1 forever.
 *
 * The numbers are the server's, never the grid's own row count. The carousel
 * skims `HOME_CAROUSEL_ROOM_COUNT` rooms off page 1, so counting rendered rows
 * would understate the page and end the feed early; page offsets are unaffected
 * by that slice, since the backend still pages in whole `per_page` blocks
 * (page 1 = rooms 1–15, page 2 = 16–30 — no overlap, no gap).
 */
export function toScrollMeta(
  meta: RoomsResponse['meta'] | undefined
): InfiniteScrollPaginationMeta | undefined {
  const pagination = meta?.pagination
  if (!pagination) return undefined

  return {
    page: pagination.current_page,
    perPage: pagination.per_page,
    total: pagination.total,
  }
}

interface HomeRoomsListDeps {
  /** The payload currently on screen, or `null` before the first one resolves. */
  payload: () => HomeRoomsPayload | null
  /** Transport for page 2 and beyond. */
  fetchRooms: (params: { page: number; country?: string; per_page?: number }) => Promise<RoomsResponse>
  /**
   * True while an earlier 429 is still being honoured (home-room-feed/12). When set,
   * page 2+ requests no-op with `RoomsRateLimitedError` instead of touching the
   * network — "block further rooms requests until it elapses."
   */
  isRateLimited?: () => boolean
  /** Called when `fetchRooms` itself comes back 429, so the caller can record the wait. */
  onRateLimited?: (retryAfterSeconds: number | null) => void
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
        meta: toScrollMeta(payload?.res.meta),
      }
    }

    // home-room-feed/12: a 429 blocks further requests until `Retry-After`
    // elapses — no-op rather than fire another request into the same limiter.
    if (deps.isRateLimited?.()) {
      throw new RoomsRateLimitedError()
    }

    // home-room-feed/10: page size is sent explicitly so the offset arithmetic
    // is anchored to the frontend's constant, same as page 1's request.
    const params: { page: number; country?: string; per_page: number } = {
      page,
      per_page: HOME_ROOMS_PER_PAGE,
    }
    if (payload?.country) params.country = payload.country

    // Page 2+ carries the identical nested shape, so it needs the same
    // normalization — normalizing page 1 alone makes the grid load page 2 and
    // then stop again.
    try {
      const res = await deps.fetchRooms(params)
      return { data: res.data, meta: toScrollMeta(res.meta) }
    } catch (err) {
      // home-room-feed/13: propagate rather than swallow, so `InfiniteScroll`'s
      // existing `fetchError` branch fires instead of rendering a false "no
      // results" page. home-room-feed/12: on a 429, also record the wait.
      if (isTooManyRequestsError(err)) {
        deps.onRateLimited?.(getRetryAfterSeconds(err))
      }
      throw err
    }
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

/**
 * Whether the mount-time silent refresh should fire (home-room-feed/15).
 *
 * Every home mount used to pay two identical `/api/rooms?page=1` requests:
 * the `useAsyncData` fetch (or its cached replay) plus an unconditional
 * `refreshRooms()` in `onMounted`. The refresh only buys fresher participant
 * counts, so it is skipped while the payload on screen is younger than
 * `maxAgeMs` — a cold load's payload is milliseconds old and never needs it,
 * while returning home after time in a room still refreshes as before.
 *
 * - `null` payload → `false`: nothing painted, so there is nothing to refresh
 *   behind — the in-flight initial fetch is the freshness (pre-existing guard).
 * - Missing `fetchedAt` → `true`: age unknown, treat as stale.
 *
 * @param payload  the payload currently on screen, or `null`
 * @param now      current epoch ms (injected so the decision stays pure)
 * @param maxAgeMs freshness window, default `CACHE_TTL.HOME_ROOMS_PAYLOAD`
 */
export function shouldRefreshRoomsOnMount(
  payload: HomeRoomsPayload | null,
  now: number,
  maxAgeMs: number = CACHE_TTL.HOME_ROOMS_PAYLOAD
): boolean {
  if (!payload) return false
  if (payload.fetchedAt === undefined) return true
  return now - payload.fetchedAt >= maxAgeMs
}

/**
 * Whether the selected country chip has to be reset back to "All" because the
 * country it points at has dropped out of the active list — e.g. the last
 * room in that country closed between visits and a cookie-restored selection
 * now points at nothing.
 *
 * Every guard here exists to avoid clobbering a choice that is still valid:
 *
 * - `selectedCountry === ''` is already "All"; there is nothing to reset.
 * - `payloadCountry !== selectedCountry` means this payload belongs to a chip
 *   the user has since tapped away from — resolving it must not overwrite
 *   whatever the user picked after the request went out.
 * - An empty `activeCountries` means a failed or in-flight request, not a
 *   vanished country. Resetting on that would wipe a valid selection on a
 *   plain network blip.
 * - The membership check is case-insensitive because the backend lowercases
 *   country codes via `strtolower`, but nothing here should depend on that
 *   casing detail holding forever.
 *
 * @param payloadCountry  the country the resolved payload was fetched for
 * @param selectedCountry the chip currently selected (`''` = All)
 * @param activeCountries the response's `meta.active_countries`
 */
export function shouldResetStaleCountry(
  payloadCountry: string,
  selectedCountry: string,
  activeCountries: string[]
): boolean {
  if (!selectedCountry) return false
  if (payloadCountry !== selectedCountry) return false
  if (activeCountries.length === 0) return false

  const selectedLower = selectedCountry.toLowerCase()
  return !activeCountries.some((code) => code.toLowerCase() === selectedLower)
}
