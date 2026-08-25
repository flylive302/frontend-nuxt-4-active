import { defineStore } from 'pinia';

/**
 * Home Feed Store
 *
 * Small browse-state store for the home page's country chip row. Tracks which
 * chip is selected, mirrors the set of countries the last response said were
 * active, and stamps when that mirror last changed.
 */
export const useHomeFeedStore = defineStore('homeFeed', () => {
  // ========================================
  // State
  // ========================================

  /** The chip the user has tapped. `''` means "All". */
  const selectedCountry = ref<string>('');

  /**
   * Mirror of the last response's `meta.active_countries`, kept ONLY so the
   * stale-country reset (see `shouldResetStaleCountry` in
   * `~/utils/home-rooms-feed`) has something to compare `selectedCountry`
   * against after a reload. This must NOT become a second source of truth for
   * rendering the chip row — the chip row keeps reading `meta.active_countries`
   * straight off the response, same as before this store existed.
   */
  const activeCountries = ref<string[]>([]);

  /**
   * Timestamp of the last `setActiveCountries` call. No consumer yet — it
   * exists for the pending failed-load work (ticket 13).
   */
  const lastLoadedAt = ref<number | null>(null);

  /**
   * The ms-epoch timestamp rooms requests stay blocked until, set from a 429's
   * `Retry-After` (home-room-feed/12). `null` = not rate-limited. Shared across
   * the page-1 load and the grid's page 2+ fetcher so a 429 on either one blocks
   * both — see `isRateLimitActive` / `remainingRateLimitSeconds` in
   * `~/utils/api/retry-policy`.
   */
  const rateLimitedUntil = ref<number | null>(null);

  // ========================================
  // Setters
  // ========================================

  function setCountry(code: string): void {
    selectedCountry.value = code;
  }

  /**
   * Called exactly once per resolved payload, so this is also the one place
   * that stamps `lastLoadedAt`.
   */
  function setActiveCountries(codes: string[]): void {
    activeCountries.value = codes;
    lastLoadedAt.value = Date.now();
  }

  function resetToAll(): void {
    selectedCountry.value = '';
  }

  function setRateLimitedUntil(timestamp: number): void {
    rateLimitedUntil.value = timestamp;
  }

  function clearRateLimit(): void {
    rateLimitedUntil.value = null;
  }

  return {
    selectedCountry,
    activeCountries,
    lastLoadedAt,
    rateLimitedUntil,
    setCountry,
    setActiveCountries,
    resetToAll,
    setRateLimitedUntil,
    clearRateLimit,
  };
}, {
  // Cookie rather than localStorage. This app is `ssr: false` today, so the two
  // are equivalent in practice — the cookie is the forward-compatible one. If
  // SSR is ever switched on, the server can read a cookie but not localStorage,
  // and the home page emits a single `<link rel=preload fetchpriority=high>`
  // for the first carousel room: a localStorage-only choice would make the
  // server render the "All" list, burn that preload on an image the user is not
  // going to see, then flash on hydration. Keeping it on a cookie means that
  // switch costs nothing here.
  //
  // Only `selectedCountry` persists — `activeCountries` and `lastLoadedAt` are
  // per-session mirrors of the last response, not a durable user choice.
  //
  // The cookie is named after the store id: `homeFeed`. There is no global
  // `piniaPluginPersistedstate.key` template in `nuxt.config.ts`, so the id is
  // used bare. **Renaming the store id silently orphans every existing user's
  // saved country** — they get a one-time reset to "All", no error anywhere.
  //
  // Restore is synchronous: the plugin hydrates inside `createPersistence` at
  // store-instantiation time, so `useHomeFeedStore()` already carries the
  // cookie's value by the time it returns. That is what lets the home page read
  // the country *above* `useAsyncData` and have the key be right first time.
  persist: {
    pick: ['selectedCountry'],
    storage: piniaPluginPersistedstate.cookies({
      maxAge: 60 * 60 * 24 * 180,
      sameSite: 'lax',
      secure: true,
      path: '/',
    }),
  },
});
