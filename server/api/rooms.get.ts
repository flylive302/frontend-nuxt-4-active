import { getQuery } from 'h3'
import { ROOMS_RETRY_STATUS_CODES } from '~/utils/api/retry-policy'

// home-room-feed 06: dropped 60 → 30. The ranking is now a stored, recomputed
// value (rooms.trending_score) rather than a static sort, and the refresh job
// runs every 60s — at a 60s edge TTL a reorder could take ~2 min to surface.
// 30s halves that. It cannot go below the job's own 60s cadence in effect;
// that cadence, not this TTL, is the real floor on freshness.
const CACHE_TTL = 30 // seconds

type CloudflareCacheStorage = CacheStorage & { default: Cache }

/**
 * Cached rooms proxy using Cloudflare's data-center-persistent Cache API.
 *
 * SSR path before: Worker → Laravel (~2 200 ms per request)
 * SSR path after : Worker → CF Cache hit (~5 ms) | cold → Laravel (~2 200 ms, cached for CACHE_TTL)
 *
 * Falls back to direct Laravel call in dev (no caches. default available).
 */
export default defineEventHandler(async (event) => {
  const { page, country } = getQuery(event)
  const pageNum = Number(page) || 1
  const countryStr = country ? String(country) : ''

  const config = useRuntimeConfig()
  const params: Record<string, string | number> = { page: pageNum }
  if (countryStr) params.country = countryStr

  // Cloudflare Cache API — persists across isolate restarts within the same DC
  const cfCaches = (globalThis as Record<string, unknown>).caches as CloudflareCacheStorage | undefined
  if (cfCaches) {
    const cacheKey = new Request(`https://flylive-cache.internal/rooms/p${pageNum}/c${countryStr}`)
    const hit = await cfCaches.default.match(cacheKey)
    if (hit) {
      return hit.json()
    }

    // home-room-feed/12: exclude 429 from the retry set — this Worker-side call can
    // otherwise silently retry a "slow down" against Laravel, invisible in DevTools.
    const data = await $fetch(`${config.public.apiBase}/rooms`, {
      params,
      timeout: 8000,
      retryStatusCodes: [...ROOMS_RETRY_STATUS_CODES],
    })

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
  return await $fetch(`${config.public.apiBase}/rooms`, {
    params,
    timeout: 8000,
    retryStatusCodes: [...ROOMS_RETRY_STATUS_CODES],
  })
})
