import { describe, it, expect, vi } from 'vitest'
import { evaluateHasMore } from '../../app/utils/infinite-scroll-pagination'
import {
  RoomsRateLimitedError,
  createHomeRoomsListFetcher,
  isHomeCountrySettling,
  shouldRefreshRoomsOnMount,
  shouldResetStaleCountry,
  shouldReuseCachedRooms,
  toScrollMeta,
  type HomeRoomsPayload,
} from '../../app/utils/home-rooms-feed'
import { isTooManyRequestsError } from '../../app/utils/api/retry-policy'
import { HOME_CAROUSEL_ROOM_COUNT } from '../../app/constants/carousel'
import type { RoomsResponse } from '../../app/types/room/room'
import type { BootstrapRoom } from '../../app/types/user/bootstrap'

// Only `id` and `country` matter here; the rest of BootstrapRoom is irrelevant
// to paging and would only obscure the assertions.
function room(id: number, country: string): BootstrapRoom {
  return { id, country } as BootstrapRoom
}

/** `count` rooms all from `country`, with ids offset so countries never collide. */
function rooms(country: string, count: number, idBase: number): BootstrapRoom[] {
  return Array.from({ length: count }, (_, i) => room(idBase + i, country))
}

/**
 * `pagination` is parameterized because the page-2 assertions below would
 * otherwise pass against a meta that still claims `current_page: 1` — i.e. for
 * the wrong reason.
 */
function response(
  data: BootstrapRoom[],
  activeCountries: string[] = ['US', 'PK'],
  pagination: RoomsResponse['meta']['pagination'] = {
    current_page: 1,
    last_page: 3,
    per_page: 20,
    total: 60,
  }
): RoomsResponse {
  return {
    status: 'success',
    message: 'ok',
    data,
    meta: { pagination, active_countries: activeCountries },
  }
}

function payloadFor(country: string, idBase: number, count = 8): HomeRoomsPayload {
  return { country, res: response(rooms(country || 'ALL', count, idBase)) }
}

// Page 1 feeds the carousel first; only what's left reaches the grid.
const ALL_PAYLOAD = payloadFor('', 100)
const US_PAYLOAD = payloadFor('US', 200)
const PK_PAYLOAD = payloadFor('PK', 300)

const gridRowsOf = (p: HomeRoomsPayload) => p.res.data.slice(HOME_CAROUSEL_ROOM_COUNT)

describe('createHomeRoomsListFetcher', () => {
  it('serves page 1 from the payload on screen, past the carousel slice', async () => {
    const fetchRooms = vi.fn()
    const fetcher = createHomeRoomsListFetcher({ payload: () => US_PAYLOAD, fetchRooms })

    const page = await fetcher({ page: 1 })

    expect(page.data).toEqual(gridRowsOf(US_PAYLOAD))
    // Normalized, not the raw nested meta — that pass-through was the bug.
    expect(page.meta).toEqual({ page: 1, perPage: 20, total: 60 })
    expect(fetchRooms).not.toHaveBeenCalled() // page 1 is never a network call
  })

  it('serves an empty page 1 before any payload has resolved', async () => {
    const fetchRooms = vi.fn()
    const fetcher = createHomeRoomsListFetcher({ payload: () => null, fetchRooms })

    const page = await fetcher({ page: 1 })

    expect(page.data).toEqual([])
    expect(page.meta).toBeUndefined()
    expect(fetchRooms).not.toHaveBeenCalled()
  })

  // The bug this ticket fixes: the grid used to remount the instant a chip was
  // tapped, so page 1 re-seeded from the *previous* country's payload.
  it('resolves page 1 against the newly-loaded country, not the previously-loaded one', async () => {
    const fetchRooms = vi.fn()
    let selectedCountry = ''
    let loaded: HomeRoomsPayload | null = ALL_PAYLOAD
    const fetcher = createHomeRoomsListFetcher({ payload: () => loaded, fetchRooms })

    // User taps US. Nuxt keeps the previous payload on screen until the new one
    // resolves, so the grid must stay unmounted through this window...
    selectedCountry = 'US'
    expect(isHomeCountrySettling(selectedCountry, loaded!.country, 'pending')).toBe(true)
    expect(await fetcher({ page: 1 }).then((p) => p.data)).toEqual(gridRowsOf(ALL_PAYLOAD))

    // ...and only once the US payload lands does the grid remount and load page 1.
    loaded = US_PAYLOAD
    expect(isHomeCountrySettling(selectedCountry, loaded.country, 'success')).toBe(false)

    const page = await fetcher({ page: 1 })
    expect(page.data).toEqual(gridRowsOf(US_PAYLOAD))
    expect(page.data.every((r) => r.country === 'US')).toBe(true)
    expect(page.data.some((r) => r.country === 'ALL')).toBe(false)
  })

  it('sends the loaded country on page 2, even after the chip has moved on', async () => {
    const fetchRooms = vi.fn().mockResolvedValue(response(rooms('US', 20, 400)))
    // Payload is US; the user has since tapped PK but it has not resolved yet.
    const fetcher = createHomeRoomsListFetcher({ payload: () => US_PAYLOAD, fetchRooms })

    const page = await fetcher({ page: 2 })

    expect(fetchRooms).toHaveBeenCalledWith({ page: 2, country: 'US', per_page: 15 })
    expect(page.data.every((r) => r.country === 'US')).toBe(true)
  })

  it('keeps page 1 and page 2 on the same country across a switch', async () => {
    const fetchRooms = vi.fn().mockResolvedValue(response([]))
    let loaded: HomeRoomsPayload = PK_PAYLOAD
    const fetcher = createHomeRoomsListFetcher({ payload: () => loaded, fetchRooms })

    const page1 = await fetcher({ page: 1 })
    loaded = US_PAYLOAD // a country switch lands mid-scroll
    await fetcher({ page: 2 })

    const [params] = fetchRooms.mock.calls[0] as [{ page: number; country?: string }]
    // Page 2 follows the payload the grid is now keyed by — a grid keyed to US
    // is remounted and drops page1's PK rows, so the two can never interleave.
    expect(params.country).toBe(loaded.country)
    expect(page1.data.every((r) => r.country === 'PK')).toBe(true)
  })

  it('omits country on page 2 for the unfiltered list', async () => {
    const fetchRooms = vi.fn().mockResolvedValue(response([]))
    const fetcher = createHomeRoomsListFetcher({ payload: () => ALL_PAYLOAD, fetchRooms })

    await fetcher({ page: 2 })

    expect(fetchRooms).toHaveBeenCalledWith({ page: 2, per_page: 15 })
  })

  it('omits country on page 2 when no payload has resolved', async () => {
    const fetchRooms = vi.fn().mockResolvedValue(response([]))
    const fetcher = createHomeRoomsListFetcher({ payload: () => null, fetchRooms })

    await fetcher({ page: 2 })

    expect(fetchRooms).toHaveBeenCalledWith({ page: 2, per_page: 15 })
  })

  // Page 2 returns the backend payload raw, so it carries the identical nested
  // shape page 1 does. Normalizing only page 1 would let the grid load page 2
  // and then stop again — the same dead end, one page further down.
  it('normalizes the meta on page 2, not just page 1', async () => {
    const fetchRooms = vi.fn().mockResolvedValue(
      response(rooms('US', 20, 400), ['US', 'PK'], {
        current_page: 2,
        last_page: 3,
        per_page: 20,
        total: 60,
      })
    )
    const fetcher = createHomeRoomsListFetcher({ payload: () => US_PAYLOAD, fetchRooms })

    const page = await fetcher({ page: 2 })

    expect(page.meta).toEqual({ page: 2, perPage: 20, total: 60 })
  })

  it('hands the grid no meta at all when no payload has resolved', async () => {
    const fetcher = createHomeRoomsListFetcher({ payload: () => null, fetchRooms: vi.fn() })

    expect((await fetcher({ page: 1 })).meta).toBeUndefined()
  })
})

describe('createHomeRoomsListFetcher — 429 handling (home-room-feed/12, /13)', () => {
  function fetchError429(retryAfter?: string) {
    return {
      response: {
        status: 429,
        headers: { get: (name: string) => (name.toLowerCase() === 'retry-after' ? retryAfter ?? null : null) },
      },
    }
  }

  it('propagates a page 2+ 429 rather than returning an empty page', async () => {
    const err = fetchError429('20')
    const fetchRooms = vi.fn().mockRejectedValue(err)
    const fetcher = createHomeRoomsListFetcher({ payload: () => US_PAYLOAD, fetchRooms })

    await expect(fetcher({ page: 2 })).rejects.toBe(err)
  })

  it('propagates any page 2+ failure, not just 429', async () => {
    const err = new Error('boom')
    const fetchRooms = vi.fn().mockRejectedValue(err)
    const fetcher = createHomeRoomsListFetcher({ payload: () => US_PAYLOAD, fetchRooms })

    await expect(fetcher({ page: 2 })).rejects.toBe(err)
  })

  it('calls onRateLimited with the parsed Retry-After when fetchRooms 429s', async () => {
    const fetchRooms = vi.fn().mockRejectedValue(fetchError429('45'))
    const onRateLimited = vi.fn()
    const fetcher = createHomeRoomsListFetcher({ payload: () => US_PAYLOAD, fetchRooms, onRateLimited })

    await expect(fetcher({ page: 2 })).rejects.toBeDefined()

    expect(onRateLimited).toHaveBeenCalledWith(45)
  })

  it('does not call onRateLimited for a non-429 failure', async () => {
    const fetchRooms = vi.fn().mockRejectedValue(new Error('boom'))
    const onRateLimited = vi.fn()
    const fetcher = createHomeRoomsListFetcher({ payload: () => US_PAYLOAD, fetchRooms, onRateLimited })

    await expect(fetcher({ page: 2 })).rejects.toBeDefined()

    expect(onRateLimited).not.toHaveBeenCalled()
  })

  it('no-ops page 2+ while already rate-limited, without touching the network', async () => {
    const fetchRooms = vi.fn()
    const fetcher = createHomeRoomsListFetcher({
      payload: () => US_PAYLOAD,
      fetchRooms,
      isRateLimited: () => true,
    })

    const err = await fetcher({ page: 2 }).catch((e) => e)

    expect(err).toBeInstanceOf(RoomsRateLimitedError)
    expect(isTooManyRequestsError(err)).toBe(true) // classifies the same as a real 429
    expect(fetchRooms).not.toHaveBeenCalled()
  })

  it('proceeds normally once isRateLimited returns false again', async () => {
    const fetchRooms = vi.fn().mockResolvedValue(response(rooms('US', 20, 400)))
    const fetcher = createHomeRoomsListFetcher({
      payload: () => US_PAYLOAD,
      fetchRooms,
      isRateLimited: () => false,
    })

    const page = await fetcher({ page: 2 })

    expect(fetchRooms).toHaveBeenCalledOnce()
    expect(page.data).toHaveLength(20)
  })

  it('never gates page 1 on isRateLimited — page 1 is served from the payload, not the network', async () => {
    const isRateLimited = vi.fn().mockReturnValue(true)
    const fetchRooms = vi.fn()
    const fetcher = createHomeRoomsListFetcher({ payload: () => US_PAYLOAD, fetchRooms, isRateLimited })

    const page = await fetcher({ page: 1 })

    expect(page.data).toEqual(gridRowsOf(US_PAYLOAD))
    expect(fetchRooms).not.toHaveBeenCalled()
  })
})

describe('toScrollMeta', () => {
  it('flattens Laravel pagination into the shape InfiniteScroll reads', () => {
    const meta = response([], ['US'], {
      current_page: 2,
      last_page: 4,
      per_page: 15,
      total: 52,
    }).meta

    expect(toScrollMeta(meta)).toEqual({ page: 2, perPage: 15, total: 52 })
  })

  // The raw object carries `pagination` and `active_countries`; destructuring
  // `{page, perPage, total}` off it yields three undefineds, which is what made
  // the grid stop after one page.
  it('drops the keys InfiniteScroll does not read', () => {
    const normalized = toScrollMeta(response([]).meta)

    expect(Object.keys(normalized ?? {}).sort()).toEqual(['page', 'perPage', 'total'])
    expect(normalized).not.toHaveProperty('pagination')
    expect(normalized).not.toHaveProperty('active_countries')
  })

  it('is undefined when there is no meta or no pagination block', () => {
    expect(toScrollMeta(undefined)).toBeUndefined()
    expect(toScrollMeta({ active_countries: ['US'] } as RoomsResponse['meta'])).toBeUndefined()
  })

  // Backend per_page is 15 and the carousel takes 5 off page 1, so the grid
  // renders 10 rows for a 15-row page. Reporting 10 would make page 1 look
  // short and end the feed; the server's 15 keeps the offsets honest.
  it('reports the server page size, never the post-carousel row count', () => {
    const res = response(rooms('US', 15, 500), ['US'], {
      current_page: 1,
      last_page: 2,
      per_page: 15,
      total: 30,
    })

    const gridRows = res.data.slice(HOME_CAROUSEL_ROOM_COUNT)

    expect(gridRows).toHaveLength(15 - HOME_CAROUSEL_ROOM_COUNT)
    expect(toScrollMeta(res.meta)?.perPage).toBe(15)
  })
})

/**
 * The bug lived in the seam, not in either function: `toScrollMeta` and
 * `evaluateHasMore` are each fine alone, and the grid still stopped at page 1.
 * So walk a real Laravel payload through both, at the production page size,
 * with the carousel taking its slice — the exact composition that was broken.
 */
describe('paging the home grid end to end', () => {
  const PER_PAGE = 15 // backend RoomFilterDTO default; matches the grid's :per-page

  /** Drives the real fetcher + hasMore loop over a backend holding `total` rooms. */
  async function walkFeed(total: number) {
    const allRooms = rooms('US', total, 1000)
    const pageOf = (n: number) =>
      response(allRooms.slice((n - 1) * PER_PAGE, n * PER_PAGE), ['US'], {
        current_page: n,
        last_page: Math.max(1, Math.ceil(total / PER_PAGE)),
        per_page: PER_PAGE,
        total,
      })

    const fetchRooms = vi.fn(async ({ page }: { page: number }) => pageOf(page))
    const fetcher = createHomeRoomsListFetcher({
      payload: () => ({ country: 'US', res: pageOf(1) }),
      fetchRooms,
    })

    const rendered: BootstrapRoom[] = []
    let page = 1
    let hasMore = true

    // Mirrors InfiniteScroll.loadNextPage: fetch, append, re-evaluate, advance.
    while (hasMore && page <= 10) {
      const result = await fetcher({ page })
      rendered.push(...result.data)
      hasMore = evaluateHasMore(result, result.data, { page, perPage: PER_PAGE })
      page += 1
    }

    return { rendered, requests: page - 1, carouselRooms: allRooms.slice(0, HOME_CAROUSEL_ROOM_COUNT) }
  }

  it('reaches every room past the carousel, with no gap and no duplicate', async () => {
    for (const total of [16, 30, 31, 45]) {
      const { rendered, carouselRooms } = await walkFeed(total)

      const ids = rendered.map((r) => r.id)
      expect(new Set(ids).size, `total=${total} duplicated a room`).toBe(ids.length)
      // Everything the carousel didn't take must reach the grid, in order.
      expect(ids, `total=${total} skipped rooms`).toEqual(
        Array.from({ length: total - HOME_CAROUSEL_ROOM_COUNT }, (_, i) => 1000 + HOME_CAROUSEL_ROOM_COUNT + i)
      )
      expect(carouselRooms).toHaveLength(HOME_CAROUSEL_ROOM_COUNT)
    }
  })

  it('stops at the real end rather than paging forever', async () => {
    // ceil(total / 15) pages, and not one request beyond.
    expect((await walkFeed(16)).requests).toBe(2)
    expect((await walkFeed(30)).requests).toBe(2)
    expect((await walkFeed(31)).requests).toBe(3)
    expect((await walkFeed(45)).requests).toBe(3)
  })

  // The regression this ticket fixes: page 1 renders 10 rows for a 15-row page,
  // so any row-count-based check reads it as short and ends the feed here.
  it('does not mistake the carousel slice for the end of the list', async () => {
    const { rendered, requests } = await walkFeed(30)

    expect(requests).toBeGreaterThan(1)
    expect(rendered).toHaveLength(30 - HOME_CAROUSEL_ROOM_COUNT)
  })

  it('never asks for a second page when one page holds everything', async () => {
    for (const total of [8, 15]) {
      const { rendered, requests } = await walkFeed(total)

      expect(requests, `total=${total} fetched a needless page`).toBe(1)
      expect(rendered).toHaveLength(total - HOME_CAROUSEL_ROOM_COUNT)
    }
  })
})

describe('isHomeCountrySettling', () => {
  it('settles nothing on a cold load — there is no payload to be stale', () => {
    expect(isHomeCountrySettling('', null, 'pending')).toBe(true)
  })

  it('is false once the payload matches the chip', () => {
    expect(isHomeCountrySettling('US', 'US', 'success')).toBe(false)
    expect(isHomeCountrySettling('', '', 'success')).toBe(false)
  })

  it('is true while a tapped country has not resolved yet', () => {
    expect(isHomeCountrySettling('US', '', 'pending')).toBe(true)
    expect(isHomeCountrySettling('PK', 'US', 'pending')).toBe(true)
  })

  it('is true during a background refresh only if the country changed', () => {
    // `refreshRooms()` on mount re-fetches the same country — no skeleton.
    expect(isHomeCountrySettling('US', 'US', 'pending')).toBe(false)
  })

  it('never pins the skeleton on after a failed fetch', () => {
    expect(isHomeCountrySettling('US', '', 'error')).toBe(false)
    expect(isHomeCountrySettling('US', null, 'error')).toBe(false)
  })
})

describe('shouldReuseCachedRooms', () => {
  it('reuses the cached payload on the first paint — returning home must not flash a skeleton', () => {
    expect(shouldReuseCachedRooms('initial', false)).toBe(true)
  })

  // Nuxt labels every reactive-key change `cause: 'initial'` too, and a custom
  // `getCachedData` disables its cache purge — so without the painted flag, a
  // revisited country would resolve from a frozen snapshot and never refetch.
  it('refuses the cache once mounted, so a revisited country still hits the network', () => {
    expect(shouldReuseCachedRooms('initial', true)).toBe(false)
  })

  it('refuses the cache for every other cause', () => {
    for (const cause of ['watch', 'refresh:manual', 'refresh:hook']) {
      expect(shouldReuseCachedRooms(cause, false)).toBe(false)
      expect(shouldReuseCachedRooms(cause, true)).toBe(false)
    }
  })
})

describe('shouldResetStaleCountry', () => {
  it('resets when the selected country has dropped out of the active list', () => {
    expect(shouldResetStaleCountry('US', 'US', ['pk', 'ca'])).toBe(true)
  })

  it('does not reset on an empty active list — that is a failed/in-flight request, not a vanished country', () => {
    expect(shouldResetStaleCountry('US', 'US', [])).toBe(false)
  })

  it('does not reset when the chip is already on "All"', () => {
    expect(shouldResetStaleCountry('US', '', ['pk', 'ca'])).toBe(false)
  })

  it('does not reset when the payload belongs to a country the user has since tapped away from', () => {
    expect(shouldResetStaleCountry('PK', 'US', ['pk', 'ca'])).toBe(false)
  })

  it('matches active countries case-insensitively', () => {
    expect(shouldResetStaleCountry('US', 'US', ['us', 'pk'])).toBe(false)
  })
})

describe('shouldRefreshRoomsOnMount (home-room-feed/15)', () => {
  const NOW = 1_000_000
  const payloadAt = (fetchedAt?: number): HomeRoomsPayload =>
    ({ country: '', res: { data: [] } as unknown as RoomsResponse, fetchedAt })

  it('returns false with no payload — the in-flight initial fetch is the freshness', () => {
    expect(shouldRefreshRoomsOnMount(null, NOW)).toBe(false)
  })

  it('skips the refresh while the payload is younger than the max age (cold load)', () => {
    expect(shouldRefreshRoomsOnMount(payloadAt(NOW - 1), NOW, 15_000)).toBe(false)
    expect(shouldRefreshRoomsOnMount(payloadAt(NOW), NOW, 15_000)).toBe(false)
  })

  it('refreshes once the payload reaches the max age (returning from a room)', () => {
    expect(shouldRefreshRoomsOnMount(payloadAt(NOW - 15_000), NOW, 15_000)).toBe(true)
    expect(shouldRefreshRoomsOnMount(payloadAt(NOW - 60_000), NOW, 15_000)).toBe(true)
  })

  it('treats a payload without a fetchedAt tag as stale', () => {
    expect(shouldRefreshRoomsOnMount(payloadAt(undefined), NOW, 15_000)).toBe(true)
  })

  it('a clock that went backwards reads as fresh, not stale', () => {
    // Negative age < maxAge → skip; never fire an extra request off a clock skew.
    expect(shouldRefreshRoomsOnMount(payloadAt(NOW + 5_000), NOW, 15_000)).toBe(false)
  })
})
