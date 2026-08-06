/**
 * Event Banners Data Composable
 *
 * Fetches the event-banner carousel from the backend (via the Nitro `/api/banners`
 * BFF proxy — CF-cached, avoids CORS) and applies the ImageKit transform
 * client-side. Replaces the previously hardcoded `EVENT_BANNERS` constant.
 *
 * arch-allow-bare-fetch: `/api/banners` is a same-origin Nitro BFF route backed
 * by a SHARED Cloudflare edge cache (`server/api/banners.get.ts` — 300 s, fixed
 * cache key, no Vary). Reviewed under observability-audio-quality/12 and
 * deliberately NOT routed through `useApi()`: on a cache hit the request never
 * reaches Laravel, so there is nothing to correlate; on a miss, one user's
 * `X-Correlation-ID` would be stamped onto the response every other user gets
 * for the TTL. Attaching `Authorization` to a shared-cached request would be
 * worse still. This is an accepted, documented tracing gap — if the cache-fill
 * leg ever needs tracing, that is a SERVER-side header on the BFF's outbound
 * call, not a client header here.
 */
import { BANNER_BG_TR } from '~/constants/assets'
import { createLogger } from '~/utils/logger'
import type { Banner, BannersApiResponse } from '~/types/banner'

const log = createLogger('[EventBanners]')

export function useEventBanners() {
  const { data, pending, error } = useAsyncData('event-banners', () =>
    $fetch<BannersApiResponse>('/api/banners'),
  )

  const banners = computed<Banner[]>(() => {
    const items = data.value?.data
    if (!items || items.length === 0) {
      if (error.value) {
        log.warn('Failed to load event banners', error.value)
      }
      return []
    }

    return items.map((item) => ({
      id: item.id,
      banner: `${item.image_url}?${BANNER_BG_TR}`,
      navigateTo: item.navigate_to,
    }))
  })

  return {
    banners,
    pending,
    error,
  }
}
