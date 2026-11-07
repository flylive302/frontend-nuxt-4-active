import { defineStore } from 'pinia';
import { HOME_FEED_STORAGE_KEY } from '~/constants/persistence';
import { legacyCookieSeed, seededLocalStorage } from '~/services/seededLocalStorage';

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
   * Live/All chip: when true the feed shows only rooms that are live with at
   * least one participant. ON by default — a first landing should show rooms
   * with people in them; "All" is the opt-out. Persisted like the country —
   * a browse preference, not session state. Sent to the API as `live_only=1`.
   */
  const liveOnly = ref<boolean>(true);

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

  function setLiveOnly(value: boolean): void {
    liveOnly.value = value;
  }

  function setRateLimitedUntil(timestamp: number): void {
    rateLimitedUntil.value = timestamp;
  }

  function clearRateLimit(): void {
    rateLimitedUntil.value = null;
  }

  return {
    selectedCountry,
    liveOnly,
    rateLimitedUntil,
    setCountry,
    resetToAll,
    setLiveOnly,
    setRateLimitedUntil,
    clearRateLimit,
  };
}, {
  // localStorage, seeded ONCE from the legacy `homeFeed` cookie
  // (cost-and-speed-tuning 15, ADR 0048). It was a cookie for a hypothetical
  // SSR switch (a server can read a cookie, not localStorage) — but
  // `piniaPluginPersistedstate.cookies()` calls Nuxt's `useCookie()` on every
  // store write, and outside an effect scope each call leaks a cookieStore
  // listener for the life of the page. ADR 0048: persisted stores use
  // localStorage. If SSR is ever switched on, the server-rendered list will be
  // "All" until hydration — revisit then, with a scoped cookie read.
  //
  // Only the browse choices (`selectedCountry`, `liveOnly`) persist —
  // `rateLimitedUntil` is per-session state, not a durable user choice.
  //
  // **Renaming the key silently orphans every existing user's saved country** —
  // they get a one-time reset to "All", no error anywhere.
  //
  // Restore is synchronous: the plugin hydrates inside `createPersistence` at
  // store-instantiation time, so `useHomeFeedStore()` already carries the
  // saved value by the time it returns. That is what lets the home page read
  // the country *above* `useAsyncData` and have the key be right first time.
  persist: {
    key: HOME_FEED_STORAGE_KEY,
    pick: ['selectedCountry', 'liveOnly'],
    storage: seededLocalStorage(legacyCookieSeed(HOME_FEED_STORAGE_KEY)),
  },
});
