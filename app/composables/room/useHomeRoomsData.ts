/**
 * Home feed — initial room-list fetch (observability-audio-quality/12).
 *
 * This lived inline in `pages/(home)/index.vue` as a bare
 * `$fetch<RoomsResponse>('/api/rooms')`. Two reasons it moved:
 *
 * 1. Pages must not call the API directly (`architecture-check.sh`). It only
 *    passed because that check's pattern required `(` immediately after
 *    `$fetch`, so a generic call `$fetch<T>(...)` slipped through. The pattern
 *    is fixed now, and this call had to move with it.
 * 2. Data fetching belongs in a composable regardless.
 *
 * ⛔ This deliberately does NOT go through `useApi()`, and that is not an
 * oversight — see the marker below.
 *
 * arch-allow-bare-fetch: `/api/rooms` is a same-origin Nitro BFF route backed by
 * a SHARED Cloudflare edge cache (`server/api/rooms.get.ts` — 300 s, fixed cache
 * key, no Vary). Routing it through `useApi` would be actively wrong:
 *   • the response is served to every user, so a per-user `X-Correlation-ID`
 *     would either do nothing (cache hit never reaches Laravel) or stamp one
 *     user's identifier onto everyone's response for the TTL;
 *   • attaching `Authorization` would put a bearer token on a request whose
 *     response lands in a shared cache.
 * The cached hop is an accepted, documented tracing gap. If the cache-fill leg
 * ever needs tracing, that is a SERVER-side header on the BFF's own outbound
 * call — a different thing from per-user correlation. Do not "complete" this by
 * adding client headers here.
 *
 * Note the same page's infinite-scroll continuation DOES use `useApi` via
 * `useRoom().fetchRooms` — different endpoint, per-user and uncached. Both are
 * correct; they are not an inconsistency to reconcile.
 */
import type { RoomsResponse } from '~/types/room/room'

export function useHomeRoomsData() {
  /**
   * Fetches page 1 of the room list from the cached BFF route.
   *
   * @param country - ISO-2 country filter; empty string means "all countries".
   * @returns The room-list response for that country.
   */
  async function fetchCachedRooms(country: string): Promise<RoomsResponse> {
    const params: Record<string, string | number> = { page: 1 }
    if (country) {
      params.country = country
    }

    return await $fetch<RoomsResponse>('/api/rooms', { params })
  }

  return { fetchCachedRooms }
}
