// ========================================
// Event Banners — types
// ========================================
// Backend-driven event banner carousel (replaces the hardcoded
// EVENT_BANNERS constant). See app/composables/events/useEventBanners.ts.

/** Raw banner item as returned by the Laravel `/event-banners` endpoint. */
export interface BannerApiItem {
  id: number
  /** Bare ImageKit URL — no transform query string applied yet. */
  image_url: string
  navigate_to: string
  position: number
}

/** Full `/event-banners` API envelope, proxied through `/api/banners`. */
export interface BannersApiResponse {
  status: string
  message: string
  data: BannerApiItem[]
  meta?: Record<string, unknown>
}

/** Client-ready banner — `banner` already has the ImageKit transform applied. */
export interface Banner {
  id: number
  banner: string
  navigateTo: string
}
