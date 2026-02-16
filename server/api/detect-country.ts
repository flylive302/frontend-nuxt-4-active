// server/api/detect-country.ts
/**
 * Country detection endpoint.
 *
 * On Cloudflare Pages, uses the built-in `cf-ipcountry` header (zero‐latency, free).
 * Falls back to external geojs.io API for non‐CF environments (local dev, other hosts).
 */
import { getRequestIP, getHeader } from 'h3'

export default defineEventHandler(async (event) => {
    try {
        // ── Strategy 1: Cloudflare header (instant, no network call) ──
        const cfCountry = getHeader(event, 'cf-ipcountry')
        if (cfCountry && cfCountry !== 'XX' && cfCountry !== 'T1') {
            return { country_code: cfCountry.toUpperCase() }
        }

        // ── Strategy 2: External API fallback (dev / non-CF hosts) ──
        const ip = getRequestIP(event, { xForwardedFor: true })

        if (!ip || ip === '127.0.0.1' || ip === '::1') {
            return { country_code: null }
        }

        const response = await $fetch<{ country: string }>(`https://get.geojs.io/v1/ip/country/${ip}.json`, {
            timeout: 3000,
        })

        return {
            country_code: response.country?.toUpperCase() ?? null,
        }
    } catch (error) {
        console.error('Geolocation error:', error)
        return { country_code: null }
    }
})