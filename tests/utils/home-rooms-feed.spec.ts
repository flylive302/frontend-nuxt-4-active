import { describe, it, expect, vi } from 'vitest'
import {
  createHomeRoomsListFetcher,
  isHomeCountrySettling,
  shouldReuseCachedRooms,
  type HomeRoomsPayload,
} from '../../app/utils/home-rooms-feed'
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

function response(data: BootstrapRoom[], activeCountries: string[] = ['US', 'PK']): RoomsResponse {
  return {
    status: 'success',
    message: 'ok',
    data,
    meta: {
      pagination: { current_page: 1, last_page: 3, per_page: 20, total: 60 },
      active_countries: activeCountries,
    },
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
    expect(page.meta).toBe(US_PAYLOAD.res.meta)
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

    expect(fetchRooms).toHaveBeenCalledWith({ page: 2, country: 'US' })
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

    expect(fetchRooms).toHaveBeenCalledWith({ page: 2 })
  })

  it('omits country on page 2 when no payload has resolved', async () => {
    const fetchRooms = vi.fn().mockResolvedValue(response([]))
    const fetcher = createHomeRoomsListFetcher({ payload: () => null, fetchRooms })

    await fetcher({ page: 2 })

    expect(fetchRooms).toHaveBeenCalledWith({ page: 2 })
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
