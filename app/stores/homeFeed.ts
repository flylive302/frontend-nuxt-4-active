import { defineStore } from 'pinia';

/**
 * Home Feed Store
 *
 * Small browse-state store for the home page's country chip row. Tracks which
 * chip is selected and the shared rooms rate-limit window.
 *
 * Deliberately NOT here: a mirror of the response's `meta.active_countries`.
 * The chip row and the stale-country reset both read it straight off the
 * payload (`syncCountryFromPayload` in `pages/(home)/index.vue`). A mirror
 * used to live here and cost a persisted-state cookie write per payload
 * (`$subscribe` fires on every mutation, `pick` only filters what is
 * serialised) — see docs/issues/home-page-runtime-audit step 4.
 */
export const useHomeFeedStore = defineStore('homeFeed', () => {
  // ========================================
  // State
  // ========================================

  /** The chip the user has tapped. `''` means "All". */
  const selectedCountry = ref<string>('');

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
    rateLimitedUntil,
    setCountry,
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
  // Only `selectedCountry` persists — `rateLimitedUntil` is per-session state,
  // not a durable user choice.
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
