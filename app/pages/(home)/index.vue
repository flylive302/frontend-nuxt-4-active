<script setup lang="ts">
import { defineAsyncComponent, nextTick, shallowRef, unref, watch } from 'vue'
import { useIntersectionObserver } from '@vueuse/core'
import { ASSETS } from '~/constants/assets'
import { HOME_CAROUSEL_ROOM_COUNT, ROOM_AUTOPLAY_DELAY_MS } from '~/constants/carousel'
import { roomBackgroundImageSrc } from '~/utils/imagekit'
import { createHomeRoomsListFetcher, isHomeCountrySettling, shouldResetStaleCountry, shouldReuseCachedRooms } from '~/utils/home-rooms-feed'
import type { HomeRoomsPayload } from '~/utils/home-rooms-feed'
import HomeCountryFilter from '~/components/home/country-filter.vue'
import type { RoomsResponse } from '~/types/room/room'
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

const { data: roomsPayload, status: roomsStatus, refresh: refreshRooms } = useAsyncData<HomeRoomsPayload>(
  roomsKey,
  async () => {
    // Tag the payload with the country it was fetched for — everything the grid
    // renders is then derived from this one object, so rows can never belong to
    // a different country than the label they're keyed by.
    const country = selectedCountry.value
    const params: Record<string, string | number> = { page: 1 }
    if (country) params.country = country
    const res = await $fetch<RoomsResponse>('/api/rooms', { params })
    return { country, res }
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
})

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

function roomBackgroundPreloadHref(room: (typeof carouselRooms.value)[number] | undefined): string {
  if (!room) return ''
  // Index 0 is always highFetchPriority — same helper RoomCard uses, so the URL is
  // byte-identical; any drift makes the browser discard the preload.
  return roomBackgroundImageSrc(room.background ?? ASSETS.ROOM_BG_PLACEHOLDER, 'carousel', true)
}

/** Single high-priority preload — secondary slides stay eager via <img> without competing preloads. */
const lcpRoomPreloadHrefs = computed(() => {
  const href = roomBackgroundPreloadHref(carouselRooms.value[0])
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
  if (!countryWasReset && roomsPayload.value) void refreshRooms()

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
          :per-page="15"
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
        </InfiniteScroll>
      </div>
    </template>
  </main>
</template>