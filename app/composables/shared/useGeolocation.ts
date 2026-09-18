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
 * On native (no Nitro server) this skips the BFF route entirely and calls
 * geojs.io directly — there was never a FlyLive hop to repoint via
 * `~/utils/native-bff`, unlike `/api/rooms` and `/api/banners`.
 */
import { Capacitor } from '@capacitor/core';
import { NATIVE_GEOJS_COUNTRY_URL, NATIVE_GEOJS_TIMEOUT_MS } from '~/constants/nativeBff';
import { createLogger } from '~/utils/logger';

const log = createLogger('[Geolocation]');

export function useGeolocation() {
  // ========================================
  // Business Logic / Core Logic
  // ========================================

  /**
   * Detects the user's country based on their IP address.
   *
   * Web calls the internal `/api/detect-country` BFF route. Native has no
   * Nitro server to answer it, so it calls geojs.io directly with the same
   * timeout and shape remap (`{ country }` → uppercased ISO-2) the deleted
   * `native-api-shim.client.ts` used — including its never-throw contract: a
   * dead/slow geo API silently resolves to `null` there, same as here, so no
   * `log.warn` on that branch is deliberate, not an oversight.
   * @returns The ISO-2 country code if successful, or null if detection fails.
   */
  async function detectCountry(): Promise<string | null> {
    if (Capacitor.isNativePlatform()) {
      return $fetch<{ country: string | null }>(NATIVE_GEOJS_COUNTRY_URL, { timeout: NATIVE_GEOJS_TIMEOUT_MS })
        .then((res) => res?.country?.toUpperCase() ?? null)
        .catch(() => null)
    }

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