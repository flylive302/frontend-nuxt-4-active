import { getQuery } from 'h3'

const CACHE_TTL = 60 // seconds

/**
 * Cached rooms proxy using Cloudflare's data-center-persistent Cache API.
 *
 * SSR path before: Worker → Laravel (~2 200 ms per request)
 * SSR path after : Worker → CF Cache hit (~5 ms) | cold → Laravel (~2 200 ms, cached for next 60 s)
 *
 * Falls back to direct Laravel call in dev (no caches.default available).
 */
export default defineEventHandler(async (event) => {
  const { page, country } = getQuery(event)
  const pageNum = Number(page) || 1
  const countryStr = country ? String(country) : ''

  const config = useRuntimeConfig()
  const params: Record<string, string | number> = { page: pageNum }
  if (countryStr) params.country = countryStr

  // Cloudflare Cache API — persists across isolate restarts within the same DC
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cfCaches = (globalThis as any).caches as CacheStorage | undefined
  if (cfCaches) {
    const cacheKey = new Request(`https://flylive-cache.internal/rooms/p${pageNum}/c${countryStr}`)
    const hit = await cfCaches.default.match(cacheKey)
    if (hit) {
      return hit.json()
    }

    const data = await $fetch(`${config.public.apiBase}/rooms`, { params, timeout: 8000 })

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
  return await $fetch(`${config.public.apiBase}/rooms`, { params, timeout: 8000 })
})
