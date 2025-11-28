// app/composables/useCountries.ts
// "wts my cmd code" style: single responsibility, documented, cached, re-usable across pages/components.

import { ref, readonly } from 'vue'
import type { Country } from '~/composables/usePhoneSchema'
import { useGeolocation } from '~/composables/useGeolocation'

/**
 * Global countries composable (singleton).
 * - caches countries after first load
 * - exposes control points for external code to opt-out of auto-detect or force an initial country
 * - recommended: import this where any country-aware UI is needed
 */

/* ---------- internal reactive state ---------- */
const _countries = ref<Country[]>([])
const _loading = ref<boolean>(false)
const _loaded = ref<boolean>(false)

/**
 * external override points:
 *  - externalInitialCountry: some outer logic (profile, server-detected) can set this.
 *  - externalDetectingLocation: if true, composable WILL NOT trigger its own geolocation auto-detect.
 */
const externalInitialCountry = ref<Country | undefined>(undefined)
const externalDetectingLocation = ref<boolean>(false)

/* ---------- helper: scheduleLoad (idle-friendly) ---------- */
function scheduleLoad(callback: () => void | Promise<void>): void {
    if (typeof requestIdleCallback !== 'undefined') {
        try {
            requestIdleCallback(callback as IdleRequestCallback, { timeout: 2000 })
            return
        } catch {
            // fall through to setTimeout fallback
        }
    }
    setTimeout(callback, 0)
}

/* ---------- load countries from public/countries.json (cached) ---------- */
async function loadCountries(): Promise<void> {
    if (_loaded.value || _loading.value) return
    _loading.value = true
    try {
        const res = await fetch('/countries.json')
        if (!res.ok) throw new Error(`Failed to fetch countries: ${res.status}`)
        const json = (await res.json()) as Country[]
        _countries.value = Array.isArray(json) ? json : []
        _loaded.value = true
    } catch (err) {
        // Keep component resilient: log and fallback to empty list
        // Calling code should react to empty array as "no countries".
         
        console.error('[useCountries] loadCountries error:', err)
        _countries.value = []
    } finally {
        _loading.value = false
    }
}

/* ---------- auto-detect geolocation (safe, non-blocking) ---------- */
const { detectCountry } = useGeolocation()

async function autoDetectCountry(): Promise<Country | undefined> {
    if (!_countries.value.length) return undefined
    try {
        const code = await detectCountry()
        if (!code) return undefined
        const match = _countries.value.find(c => c.code.toUpperCase() === code.toUpperCase())
        if (match) return match
    } catch (err) {
        // non-fatal; just return undefined
         
        console.error('[useCountries] autoDetectCountry failed:', err)
    }
    return undefined
}

/* ---------- public API ---------- */
export function useCountries() {
    /**
     * Ensure countries are loaded (idempotent). Use scheduleLoad to avoid blocking.
     * Returns a promise that resolves when loaded.
     */
    async function ensureLoaded(): Promise<void> {
        if (_loaded.value) return
        // load in background to keep UI snappy
        await new Promise<void>((resolve) => {
            scheduleLoad(async () => {
                await loadCountries()
                resolve()
            })
        })
    }

    /**
     * Force immediate (sync-ish) load for cases that need it - but still cached.
     */
    async function loadNow(): Promise<void> {
        await loadCountries()
    }

    /**
     * Permit external code to set an initial country (e.g., parent/profile logic).
     * If set, components reading this composable should prefer this value over autodel.
     */
    function setExternalInitialCountry(country: Country | undefined) {
        externalInitialCountry.value = country
    }

    /**
     * Permit external code to indicate that it is handling location detection.
     * When true, composable will not run auto-detection.
     */
    function setExternalDetectingLocation(flag: boolean) {
        externalDetectingLocation.value = flag
    }

    /**
     * Helper: perform auto-detect if allowed (no external detecting) and countries loaded.
     * Returns detected Country or undefined.
     */
    async function detectIfAllowed(): Promise<Country | undefined> {
        if (externalDetectingLocation.value) return undefined
        if (!_countries.value.length) await ensureLoaded()
        if (!_countries.value.length) return undefined
        return autoDetectCountry()
    }

    /* ---------- readonly exposures ---------- */
    return {
        // state
        countries: readonly(_countries),
        loading: readonly(_loading),
        loaded: readonly(_loaded),

        // overrides
        externalInitialCountry,
        externalDetectingLocation,

        // actions
        ensureLoaded,
        loadNow,
        detectIfAllowed,
        setExternalInitialCountry,
        setExternalDetectingLocation,
    } as const
}
