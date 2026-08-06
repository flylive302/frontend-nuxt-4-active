/**
 * Composable for handling geolocation-related functionality.
 * Provides methods to detect the user's country.
 *
 * arch-allow-bare-fetch: `/api/detect-country` never reaches the FlyLive API at
 * all. The Nitro route (`server/api/detect-country.ts`) answers from
 * Cloudflare's own `cf-ipcountry` request header, falling back to the
 * third-party geojs.io only outside CF. Reviewed under
 * observability-audio-quality/12: there is no FlyLive API call on this path, so
 * there is no correlation identifier to propagate. Routing it through
 * `useApi()` would attach a bearer token to a call that leaves for a
 * third party. Not a gap to close — a call that was never ours to trace.
 */
import { createLogger } from '~/utils/logger';

const log = createLogger('[Geolocation]');

export function useGeolocation() {
  // ========================================
  // Business Logic / Core Logic
  // ========================================

  /**
   * Detects the user's country based on their IP address.
   * Calls the internal API endpoint `/api/detect-country`.
   * @returns The ISO-2 country code if successful, or null if detection fails.
   */
  async function detectCountry(): Promise<string | null> {
    try {
      const { country_code } = await $fetch<{ country_code: string | null }>('/api/detect-country')
      return country_code
    } catch (error) {
      log.warn('Failed to detect country', error)
      return null
    }
  }

  return {
    detectCountry,
  }
}