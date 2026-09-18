import { Capacitor } from '@capacitor/core'
import { NATIVE_BFF_BANNERS_PATH, NATIVE_BFF_ROOMS_PATH } from '~/constants/nativeBff'

/**
 * Resolves a same-origin Nitro BFF route to the URL a caller should actually
 * request, for the current platform.
 *
 * WHY this exists: the native shell (Capacitor) bundles a static build with no
 * Nitro server, so the relative `/api/rooms` and `/api/banners` BFF routes
 * have nothing to answer them there. This used to be patched by globally
 * swapping the fetch helper in a plugin (`native-api-shim.client.ts`, now
 * deleted) so call sites could stay untouched. That broke on Nuxt 4.5: the
 * fetch helper became an auto-import re-exporting the global reference at
 * MODULE-EVAL time (`#build/fetch.mjs`), so the plugin's later swap was bound
 * to nothing — every caller kept the original, unpatched reference frozen at
 * import time.
 *
 * Fix: call sites resolve their own URL and pass it straight to the fetch
 * call. An ABSOLUTE URL bypasses ofetch's `baseURL` handling entirely, so it
 * works identically no matter which copy of the fetch helper a caller holds —
 * auto-imported or global, pre- or post-4.5. On web this is a no-op (the Nitro
 * route serves the relative path as before); on native it points at the real
 * API host.
 *
 * Impure: reads the Capacitor bridge (mirrors `~/utils/native-platform`).
 *
 * @param route - The relative BFF route as written at the call site.
 * @param apiBase - `useRuntimeConfig().public.apiBase`, read by the caller.
 * @returns `route` unchanged on web; the absolute native API URL on native.
 */
export function bffUrl(route: '/api/rooms' | '/api/banners', apiBase: string): string {
  if (!Capacitor.isNativePlatform()) return route

  return route === '/api/rooms'
    ? `${apiBase}${NATIVE_BFF_ROOMS_PATH}`
    : `${apiBase}${NATIVE_BFF_BANNERS_PATH}`
}
