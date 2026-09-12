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
import { shouldRefreshBannersOnMount, type EventBannersPayload } from '~/utils/event-banners'
import type { Banner, BannersApiResponse } from '~/types/banner'

const log = createLogger('[EventBanners]')

export function useEventBanners() {
  const { data, pending, error, refresh } = useAsyncData<EventBannersPayload>(
    'event-banners',
    async () => {
      const res = await $fetch<BannersApiResponse>('/api/banners')
      // `fetchedAt` feeds the mount-time freshness check below.
      return { res, fetchedAt: Date.now() }
    },
    {
      // home-page-runtime-audit/2. Nuxt's default `getCachedData` returns
      // nothing after hydration in an `ssr: false` app, and with no custom one
      // it purges `payload.data[key]` when the last consumer unmounts. So every
      // return to home used to refetch and paint the strip from empty — two
      // layout shifts under the user's thumb. Serving the cached payload on
      // `'initial'` keeps the banners painted; `refresh()` (cause
      // `'refresh:manual'`) still hits the network.
      getCachedData: (key, nuxtApp, ctx) =>
        ctx.cause === 'initial'
          ? nuxtApp.payload.data[key] ?? nuxtApp.static.data[key]
          : undefined,
    },
  )

  // Silent refresh when the cached payload is older than the TTL. `data` keeps
  // the previous value while the refresh is in flight, so nothing repaints
  // from empty. No-op on a cold load: the initial fetch is the freshness.
  onMounted(() => {
    if (shouldRefreshBannersOnMount(data.value ?? null, Date.now())) void refresh()
  })

  const banners = computed<Banner[]>(() => {
    const items = data.value?.res.data
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
