const CACHE_TTL = 300 // seconds — banners change rarely

type CloudflareCacheStorage = CacheStorage & { default: Cache }

/**
 * Cached event-banners proxy using Cloudflare's data-center-persistent Cache API.
 *
 * SSR path before: Worker → Laravel (~2 200 ms per request)
 * SSR path after : Worker → CF Cache hit (~5 ms) | cold → Laravel (~2 200 ms, cached for next 300 s)
 *
 * Falls back to direct Laravel call in dev (no caches.default available).
 */
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()

  // Cloudflare Cache API — persists across isolate restarts within the same DC
  const cfCaches = (globalThis as Record<string, unknown>).caches as CloudflareCacheStorage | undefined
  if (cfCaches) {
    const cacheKey = new Request('https://flylive-cache.internal/event-banners')
    const hit = await cfCaches.default.match(cacheKey)
    if (hit) {
      return hit.json()
    }

    const data = await $fetch(`${config.public.apiBase}/event-banners`, { timeout: 8000 })

    const putPromise = cfCaches.default.put(
      cacheKey,
      new Response(JSON.stringify(data), {
        headers: { 'Cache-Control': `public, max-age=${CACHE_TTL}` },
      }),
    )

    // Non-blocking: prefer CF's waitUntil so the response is returned immediately
    const waitUntil = event.context.waitUntil as ((p: Promise<void>) => void) | undefined
    if (waitUntil) {
      waitUntil(putPromise)
    } else {
      await putPromise
    }

    return data
  }

  // Fallback: direct fetch (local dev — no caches.default)
  return await $fetch(`${config.public.apiBase}/event-banners`, { timeout: 8000 })
})
