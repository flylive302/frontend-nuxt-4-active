import { Capacitor } from '@capacitor/core'

/**
 * Native BFF shim (Capacitor only).
 *
 * The bundled native app has no Nitro server, so the two relative `/api/*` BFF
 * routes (`detect-country`, `rooms`) cannot resolve at runtime. This plugin
 * repoints them to remote equivalents WITHOUT touching any composable/page
 * (Architecture: call sites stay unchanged).
 *
 * Mechanism: replace the global `$fetch` with a thin wrapper that rewrites the
 * two known paths and delegates everything else untouched. We wrap rather than
 * use an ofetch `onRequest` interceptor because mutating the request URL in
 * `onRequest` is not reliably honoured.
 *
 *  - `/api/rooms`          → `${apiBase}/rooms`            (params passed through)
 *  - `/api/detect-country` → geojs.io (device IP) + shape remap `{country}`→`{country_code}`
 *
 * On the web build this plugin no-ops; the Nitro routes serve as before.
 */
export default defineNuxtPlugin(() => {
    if (!Capacitor.isNativePlatform()) return

    const apiBase = useRuntimeConfig().public.apiBase
    const original = globalThis.$fetch

    const patched = ((request: unknown, options?: Record<string, unknown>) => {
        if (typeof request === 'string') {
            if (request === '/api/rooms') {
                return original(`${apiBase}/rooms`, options)
            }
            if (request === '/api/detect-country') {
                return original<{ country: string | null }>('https://get.geojs.io/v1/ip/country.json', { timeout: 3000 })
                    .then((res) => ({ country_code: res?.country?.toUpperCase() ?? null }))
                    .catch(() => ({ country_code: null }))
            }
        }
        return original(request as never, options as never)
    }) as typeof original

    // Preserve ofetch helpers (.raw, .create, .native) on the wrapper.
    Object.assign(patched, original)
    globalThis.$fetch = patched
})
