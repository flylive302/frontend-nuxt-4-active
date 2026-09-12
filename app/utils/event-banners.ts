import { CACHE_TTL } from '~/constants/cache'
import type { BannersApiResponse } from '~/types/banner'

/**
 * The `useAsyncData('event-banners')` payload (home-page-runtime-audit/2).
 * Mirrors `HomeRoomsPayload`: the response plus the time it resolved, so the
 * mount-time freshness check can decide whether a silent refresh is worth it.
 */
export interface EventBannersPayload {
  res: BannersApiResponse
  /**
   * Epoch ms when this payload resolved. Optional so an older cached payload
   * without the tag reads as "age unknown" → refresh.
   */
  fetchedAt?: number
}

/**
 * Whether the cached banners painted on mount are old enough to be worth a
 * silent background refresh. `false` with no payload — the in-flight initial
 * fetch is the freshness. A clock that went backwards reads as fresh, never
 * as a reason for an extra request.
 */
export function shouldRefreshBannersOnMount(
  payload: EventBannersPayload | null,
  now: number,
  maxAgeMs: number = CACHE_TTL.EVENT_BANNERS
): boolean {
  if (!payload) return false
  if (payload.fetchedAt === undefined) return true
  return now - payload.fetchedAt >= maxAgeMs
}
