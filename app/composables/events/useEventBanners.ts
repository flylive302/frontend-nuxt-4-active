/**
 * Event Banners Data Composable
 *
 * Fetches the event-banner carousel from the backend (via the Nitro `/api/banners`
 * BFF proxy — CF-cached, avoids CORS) and applies the ImageKit transform
 * client-side. Replaces the previously hardcoded `EVENT_BANNERS` constant.
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
