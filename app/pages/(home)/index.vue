<script setup lang="ts">
import { defineAsyncComponent, nextTick, shallowRef, unref, watch } from 'vue'
import { useIntersectionObserver } from '@vueuse/core'
import { ASSETS } from '~/constants/assets'
import { HOME_CAROUSEL_ROOM_COUNT, ROOM_AUTOPLAY_DELAY_MS } from '~/constants/carousel'
import { HOME_ROOMS_PER_PAGE } from '~/constants/room'
import { roomLogoCardSrc } from '~/utils/imagekit'
import { createHomeRoomsListFetcher, isHomeCountrySettling, shouldRefreshRoomsOnMount, shouldResetStaleCountry, shouldReuseCachedRooms } from '~/utils/home-rooms-feed'
import type { HomeRoomsPayload } from '~/utils/home-rooms-feed'
import {
  getRetryAfterSeconds,
  isRateLimitActive,
  isTooManyRequestsError,
  rateLimitedUntilFromRetryAfter,
  remainingRateLimitSeconds,
  roomsFetchErrorMessage,
} from '~/utils/api/retry-policy'
import HomeCountryFilter from '~/components/home/country-filter.vue'
import type { InfiniteScrollPaginationMeta } from '~/types/ui/infinite-scroll'

const InfiniteScroll = defineAsyncComponent(() => import('~/components/common/infinite-scroll.vue'))
const EventsBanners = defineAsyncComponent(() => import('~/components/events/banners.vue'))

definePageMeta({
  layout: 'home',
  middleware: ['auth', 'critical-assets'],
  // Transitions are global (nuxt.config `app.viewTransition: true`): every nav is
  // a View Transition. The home⇄room card morph and home⇄profile avatar morph are
  // activated per-nav by the room/profile transition middleware — see main.css.
})

// ---- Optimization: Pause Autoplay when off-screen; delay room autoplay until after first paint (LCP)
const roomRef = ref(null)
const roomSectionInView = ref(true)
/** Embla snap index — LCP image must match the snapped slide, not always index 0 */
const roomCarouselSnapIndex = ref(0)
const roomCarouselRef = shallowRef<{ emblaApi?: import('vue').Ref<unknown> } | null>(null)
const roomAutoplayAfterPaint = ref(false)

const roomAutoplay = computed(() => {
  if (!roomAutoplayAfterPaint.value || !roomSectionInView.value) return undefined
  return { delay: ROOM_AUTOPLAY_DELAY_MS }
})

// ---- Room Logic
const { fetchRooms } = useRoom()
// Initial page-1 load goes through the cached BFF route; the infinite-scroll
// continuation below uses `fetchRooms` (per-user, uncached). See
// `useHomeRoomsData` for why the two paths differ on purpose.
const { fetchCachedRooms } = useHomeRoomsData()

// The country chip lives in the browse store, which cookie-persists it (see
// `stores/homeFeed.ts` for why a cookie and not localStorage).
//
// Must be read *above* `useAsyncData` — `roomsKey` has to already carry the
// restored country when Nuxt queues the initial fetch.
const homeFeed = useHomeFeedStore()

// Writable computed, not `storeToRefs`: the write goes through the store action,
// and `v-model` plus every `selectedCountry.value` read below stays untouched.
// Empty string = "All" — rooms from every country.
const selectedCountry = computed<string>({
  get: () => homeFeed.selectedCountry,
  set: (code) => homeFeed.setCountry(code),
})

// Per-country key. Load-bearing, not tidiness: `getCachedData` hands back the
// cached payload on first paint, so a single shared key would paint
// All-country rooms under a highlighted country chip as soon as the filter
// survives a mount (ticket 03 persists it) — with no refetch to correct it.
const roomsKey = computed(() => `home-rooms-${selectedCountry.value || 'all'}`)

// `getCachedData` may only serve this instance's first paint. Set in onMounted,
// which runs *after* Nuxt has already queued the initial fetch — see
// `shouldReuseCachedRooms` for why every later resolution must hit the network.
let hasPaintedRooms = false

const { data: roomsPayload, status: roomsStatus, error: roomsError, refresh: refreshRooms } = useAsyncData<HomeRoomsPayload>(
  roomsKey,
  async () => {
    // Tag the payload with the country it was fetched for — everything the grid
    // renders is then derived from this one object, so rows can never belong to
    // a different country than the label they're keyed by.
    const country = selectedCountry.value
    try {
      const res = await fetchCachedRooms(country)
      // `fetchedAt` feeds the mount-time freshness check (home-room-feed/15).
      return { country, res, fetchedAt: Date.now() }
    } catch (err) {
      // home-room-feed/12: a page-1 429 blocks the grid's page 2+ fetcher too —
      // both read the same store timestamp.
      if (isTooManyRequestsError(err)) {
        homeFeed.setRateLimitedUntil(rateLimitedUntilFromRetryAfter(getRetryAfterSeconds(err)))
      }
      throw err
    }
  },
  {
    lazy: false,
    // No `watch: [selectedCountry]` — the reactive key already refetches on
    // change, and Nuxt suppresses the watch option for the duration of a key
    // change anyway, so it would be dead weight.
    //
    // Returning home (e.g. leaving a room) must paint the previous rooms
    // immediately — a refetch would flash the skeleton behind the closing
    // reveal. Only this instance's first paint reuses the payload; every
    // country change, including back to one already visited, hits the network.
    // Freshness for the country already on screen comes from the silent
    // refresh below, which the `!roomsPayload` term in the skeleton gate keeps
    // invisible (`status` does briefly go 'pending').
    getCachedData: (key, nuxtApp, ctx) =>
      shouldReuseCachedRooms(ctx.cause, hasPaintedRooms)
        ? nuxtApp.payload.data[key] ?? nuxtApp.static.data[key]
        : undefined,
  }
)

// ADR 0026 — the one real subscriber to the connectivity-restored signal.
// Without it, the banner clears and the feed stays on whatever it managed to
// load through a dead network ("No results yet."), which is the failure the
// offline work exists to remove. A refresh, never a reload: a user with a
// minimized room keeps it.
const connectivity = useConnectivityStore()
watch(
  () => connectivity.restoredAt,
  (restoredAt) => {
    if (!restoredAt) return
    void refreshRooms()
  },
)

/** Country the rooms currently on screen were fetched for; `null` until a payload exists. */
const loadedCountry = computed(() => roomsPayload.value?.country ?? null)
const isCountrySettling = computed(() =>
  isHomeCountrySettling(selectedCountry.value, loadedCountry.value, roomsStatus.value)
)

const carouselRooms = computed(() => roomsPayload.value?.res.data?.slice(0, HOME_CAROUSEL_ROOM_COUNT) || [])
// The chip row keeps reading the response directly, never the store mirror —
// two copies of this list would drift and the chips would lie about which
// countries have rooms.
const activeCountries = computed(() => roomsPayload.value?.res.meta?.active_countries ?? [])

/**
 * Mirrors the response's country list into the browse store, and drops a
 * persisted country whose last room has since closed — otherwise a cookie
 * restores a chip that now matches nothing and strands the user on an empty
 * feed with no obvious way back.
 *
 * Every input comes off the *same* payload object rather than the live refs.
 * Nuxt seeds a newly-keyed `useAsyncData` slot with the previous key's data, so
 * `selectedCountry` and an older response are independently timed; comparing
 * them directly could reset a chip the user only just tapped. Same reasoning as
 * the payload-tagging note in `utils/home-rooms-feed.ts`.
 *
 * @returns whether the stale-country reset fired
 */
function syncCountryFromPayload(payload: HomeRoomsPayload | null | undefined): boolean {
  if (!payload) return false

  const codes = payload.res.meta?.active_countries ?? []
  homeFeed.setActiveCountries(codes)

  if (!shouldResetStaleCountry(payload.country, selectedCountry.value, codes)) return false
  homeFeed.resetToAll()
  return true
}

// Later payloads only. The first one is handled in `onMounted` — see there.
watch(roomsPayload, (payload) => {
  syncCountryFromPayload(payload)
})

const fetchRoomsList = createHomeRoomsListFetcher({
  payload: () => roomsPayload.value ?? null,
  fetchRooms,
  isRateLimited: () => isRateLimitActive(homeFeed.rateLimitedUntil),
  onRateLimited: (retryAfterSeconds) => {
    homeFeed.setRateLimitedUntil(rateLimitedUntilFromRetryAfter(retryAfterSeconds))
  },
})

// Ticks once a second only while a rate limit is active, so the "retrying in Ns"
// copy counts down instead of freezing at the value it had when the 429 landed.
const rateLimitTick = ref(Date.now())
let rateLimitTimer: ReturnType<typeof setInterval> | undefined
watch(
  () => homeFeed.rateLimitedUntil,
  (until) => {
    clearInterval(rateLimitTimer)
    rateLimitTimer = undefined
    if (until === null) return
    rateLimitTimer = setInterval(() => {
      rateLimitTick.value = Date.now()
      if (!isRateLimitActive(homeFeed.rateLimitedUntil)) {
        clearInterval(rateLimitTimer)
        rateLimitTimer = undefined
      }
    }, 1000)
  },
  { immediate: true },
)
onBeforeUnmount(() => clearInterval(rateLimitTimer))

/** Seconds left before the next rooms request is allowed, re-evaluated every tick. */
const rateLimitSecondsRemaining = computed(() => {
  void rateLimitTick.value
  return remainingRateLimitSeconds(homeFeed.rateLimitedUntil)
})

/** Wording for the page-1 error state — distinct for a 429 vs. any other failure. */
const roomsErrorMessage = computed(() =>
  roomsFetchErrorMessage(roomsError.value, rateLimitSecondsRemaining.value)
)

/** Wording for the grid's error slot — same classifier, same store-backed countdown. */
function gridErrorMessage(error: unknown): string {
  return roomsFetchErrorMessage(error, rateLimitSecondsRemaining.value)
}

// Wrapper to satisfy InfiniteScroll prop type requirements and avoid template
// casting. Only `data` needs the cast — BootstrapRoom can't satisfy
// InfiniteScrollItem's index signature. `meta` stays honestly typed so a
// regression back to the raw nested pagination shape fails typecheck.
const infiniteScrollFetcher = async (ctx: { page: number }) => {
  return fetchRoomsList(ctx) as Promise<{
    data: { id: string | number }[]
    meta?: InfiniteScrollPaginationMeta
  }>
}

useIntersectionObserver(roomRef, ([entry]) => {
  roomSectionInView.value = entry?.isIntersecting ?? false
})

function onRoomCarouselSelect(index: number): void {
  roomCarouselSnapIndex.value = index
}

function roomCardHighFetchPriority(index: number): boolean {
  if (index === 0) return true  // must match the preload URL (q=75) — never downgrade after snap
  return index === roomCarouselSnapIndex.value
}

function syncRoomCarouselSnapFromEmbla(): void {
  const inst = roomCarouselRef.value
  const api = inst?.emblaApi ? unref(inst.emblaApi) : null
  if (api && typeof (api as { selectedScrollSnap?: () => number }).selectedScrollSnap === 'function') {
    onRoomCarouselSelect((api as { selectedScrollSnap: () => number }).selectedScrollSnap())
  }
}

watch(
  () => [carouselRooms.value.length, roomCarouselRef.value] as const,
  async () => {
    if (!import.meta.client || carouselRooms.value.length === 0 || !roomCarouselRef.value) return
    await nextTick()
    requestAnimationFrame(() => syncRoomCarouselSnapFromEmbla())
  },
  { flush: 'post' },
)

function roomLogoPreloadHref(room: (typeof carouselRooms.value)[number] | undefined): string {
  if (!room) return ''
  // Must be the SAME helper RoomCard's <img> uses, so the URL is byte-identical;
  // any drift makes the browser discard the preload and log "preloaded ... but not
  // used". Preloading the BACKGROUND here was exactly that bug — the card paints the
  // LOGO, so the background preload was always dead weight once that switch landed.
  return roomLogoCardSrc(room.logo ?? ASSETS.ROOM_BG_PLACEHOLDER)
}

/** Single high-priority preload — secondary slides stay eager via <img> without competing preloads. */
const lcpRoomPreloadHrefs = computed(() => {
  const href = roomLogoPreloadHref(carouselRooms.value[0])
  return href ? [href] : []
})

useHead(() => {
  const hrefs = lcpRoomPreloadHrefs.value
  if (!hrefs.length) return {}
  return {
    // `key` dedupes across head re-evaluations (carousel data settling would
    // otherwise append a fresh <link> each time). No `imagesizes`: it is only
    // honoured beside `imagesrcset`, and RoomCard's <img> carries no srcset.
    link: hrefs.map((href) => ({
      key: 'room-lcp-preload',
      rel: 'preload',
      as: 'image',
      href,
      fetchpriority: 'high' as const,
    })),
  }
})

// Preload room page chunk after idle so first paint / LCP stay unblocked
onMounted(() => {
  // Close the cache window: from here on, a country change must hit the network.
  //
  // Must come *before* the stale-country check below, not after. That check can
  // re-key `useAsyncData`, and Nuxt tags a key change as `cause: 'initial'` —
  // so with the flag still down, the fallback to All would be served from a
  // cached All payload from earlier in the session instead of refetching, while
  // the `countryWasReset` branch below has already skipped `refreshRooms()`.
  // Stale rooms, no network. Setup has long since made its own `getCachedData`
  // call by this point, so first-paint reuse is unaffected.
  hasPaintedRooms = true

  // Returning to home serves the cached payload *synchronously* from
  // `getCachedData`, so `roomsPayload` is already set before the watcher above
  // is ever registered and that path would otherwise never be checked. On a
  // cold load this is a no-op (nothing has resolved yet) and the watcher does
  // the work instead.
  const countryWasReset = syncCountryFromPayload(roomsPayload.value)

  // Cached rooms painted instantly above; pull fresh participant counts behind
  // them. The skeleton stays away because a payload is already on screen, not
  // because `status` holds at 'success' — it does dip to 'pending' here.
  // This refreshes the carousel only: the new payload carries the *same*
  // country, so `loadedCountry` and the grid's `:key` don't change and
  // InfiniteScroll keeps the counts it loaded with. Pre-existing behaviour.
  //
  // Skipped when the reset just fired: that re-keys `useAsyncData` and refetches
  // on its own, so refreshing here would be a second request for a payload
  // that is about to be thrown away.
  //
  // home-room-feed/15: also skipped while the payload is fresher than
  // `CACHE_TTL.HOME_ROOMS_PAYLOAD` — a cold load otherwise paid two identical
  // page-1 requests back to back on the app's most-hit endpoint.
  if (!countryWasReset && shouldRefreshRoomsOnMount(roomsPayload.value, Date.now())) void refreshRooms()

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      roomAutoplayAfterPaint.value = true
    })
  })
  const run = () => {
    preloadRouteComponents('/room/0')
  }
  if (typeof requestIdleCallback !== 'undefined') {
    requestIdleCallback(run, { timeout: 2500 })
  } else {
    setTimeout(run, 0)
  }
})

</script>

<template>
  <main>
    <!-- Following vs banners depends on auth-specific API — SSR placeholder avoids branch mismatches -->
    <ClientOnly>
      <template #fallback>
        <div
          class="pt-4 mx-3 rounded-2xl bg-white/5 animate-pulse"
          style="min-height: 120px"
          aria-hidden="true"
        />
      </template>
      <EventsBanners />
    </ClientOnly>

    <!-- Country Filter -->
    <HomeCountryFilter v-model="selectedCountry" :active-countries="activeCountries" class="my-3" />

    <!-- Room Section: skeleton on a cold load, and while a freshly-tapped
         country is still resolving — a background refresh of the *same* country
         keeps the already-painted rooms on screen rather than flashing placeholders -->
    <template v-if="(roomsStatus === 'pending' && !roomsPayload) || isCountrySettling">
      <div class="flex gap-3 overflow-hidden mb-6 px-3">
        <div v-for="i in 3" :key="i" class="shrink-0 w-2/3 h-72 rounded-2xl bg-white/5 animate-pulse" />
      </div>
      <div class="grid grid-cols-2 gap-3 mx-3">
        <div v-for="i in 4" :key="i" class="h-56 rounded-2xl bg-white/5 animate-pulse" />
      </div>
    </template>

    <!-- home-room-feed/13: a failed page-1 load must look like a failure, not an
         empty feed. Visually distinct from both the skeleton above and the
         genuinely-empty grid below — real message, working retry. Neither the
         carousel nor InfiniteScroll mount here, so a page-1 429/5xx can never be
         mistaken for "no rooms". -->
    <template v-else-if="roomsStatus === 'error'">
      <div class="mx-3 mb-6 rounded-2xl bg-white/5 py-10 text-center">
        <p class="text-md font-semibold text-rose-300">{{ roomsErrorMessage }}</p>
        <UButton class="mt-4" color="neutral" variant="soft" @click="refreshRooms()">
          Retry
        </UButton>
      </div>
    </template>

    <template v-else>
      <div ref="roomRef">
        <ClientOnly v-if="carouselRooms.length > 0">
          <template #fallback>
            <div class="mb-6 flex gap-3 overflow-x-auto px-3 scrollbar-hide">
              <RoomCard
                v-for="(item, index) in carouselRooms"
                :key="item.id"
                :room="item"
                card-layout="carousel"
                class="h-72 max-w-60 shrink-0"
                :priority-lcp="true"
                :high-fetch-priority="roomCardHighFetchPriority(index)"
              />
            </div>
          </template>
          <UCarousel
            ref="roomCarouselRef"
            :items="carouselRooms"
            :autoplay="roomAutoplay"
            class-names
            :ui="{
              item: 'basis-2/3 transition duration-300 ease-in-out scale-90 [&.is-snapped]:scale-100'
            }"
            class="mb-6"
            @select="onRoomCarouselSelect"
          >
            <template #default="{ item, index }">
              <RoomCard
                v-if="item"
                :room="item"
                card-layout="carousel"
                class="h-72 max-w-60"
                :priority-lcp="true"
                :high-fetch-priority="roomCardHighFetchPriority(index)"
              />
            </template>
          </UCarousel>
        </ClientOnly>
      </div>

      <div class="mx-3">
        <!-- Keyed by the country the data was *loaded* for, never the one just
             tapped: remounting on selection would re-seed page 1 from the old
             payload. Still needed alongside the skeleton gate above — revisiting
             an already-fetched country settles synchronously, so this is the only
             thing that re-seeds the grid on that path. -->
        <InfiniteScroll
          :key="loadedCountry || '__all__'"
          :fetcher="infiniteScrollFetcher"
          :initial-page="1"
          :per-page="HOME_ROOMS_PER_PAGE"
        >
          <template #cell="{ cell }">
            <div role="listitem">
              <RoomCard
                :room="cell"
                card-layout="grid"
                class="h-56 w-full mb-4"
              />
            </div>
          </template>
          <!-- home-room-feed/12: page 2+ hitting a 429 propagates here instead of
               a silent empty page — worded distinctly from a generic failure. -->
          <template #error="{ error }">
            {{ gridErrorMessage(error) }}
          </template>
        </InfiniteScroll>
      </div>
    </template>
  </main>
</template>