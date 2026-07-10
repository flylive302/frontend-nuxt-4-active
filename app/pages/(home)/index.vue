<script setup lang="ts">
import { defineAsyncComponent, nextTick, shallowRef, unref, watch } from 'vue'
import { useIntersectionObserver } from '@vueuse/core'
import { ASSETS } from '~/constants/assets'
import { ROOM_AUTOPLAY_DELAY_MS } from '~/constants/carousel'
import { roomBackgroundImageSrc } from '~/utils/imagekit'
import HomeCountryFilter from '~/components/home/country-filter.vue'
import type { RoomsResponse } from '~/types/room/room'

const InfiniteScroll = defineAsyncComponent(() => import('~/components/common/infinite-scroll.vue'))
const EventsBanners = defineAsyncComponent(() => import('~/components/events/banners.vue'))

definePageMeta({
  layout: 'home',
  middleware: ['auth', 'critical-assets'],
  // Opts this page into the native view transition (room card ⇄ room background).
  // `pageTransition: false` keeps Vue from swapping the DOM out-in, which would
  // leave the incoming snapshot empty; other routes keep the global slide.
  viewTransition: true,
  pageTransition: false,
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

// Default to "All" — shows rooms from every country
const selectedCountry = ref<string>('')

const { data: roomsResponse, status: roomsStatus, refresh: refreshRooms } = useAsyncData(
  'home-rooms',
  async () => {
    const params: Record<string, string | number> = { page: 1 }
    if (selectedCountry.value) params.country = selectedCountry.value
    return await $fetch<RoomsResponse>('/api/rooms', { params })
  },
  {
    watch: [selectedCountry],
    lazy: false,
    // Returning home (e.g. leaving a room) must paint the previous rooms
    // immediately — a refetch would flash the skeleton behind the closing
    // reveal. Only the first mount reuses the payload; a country change
    // (`cause: 'watch'`) always refetches. Freshness comes from the silent
    // refresh below, which keeps `status` at 'success'.
    getCachedData: (key, nuxtApp, ctx) =>
      ctx.cause === 'initial' ? nuxtApp.payload.data[key] ?? nuxtApp.static.data[key] : undefined,
  }
)

const carouselRooms = computed(() => roomsResponse.value?.data?.slice(0, 5) || [])
const initialListRooms = computed(() => roomsResponse.value?.data?.slice(5) || [])
const roomsMeta = computed(() => roomsResponse.value?.meta)
const activeCountries = computed(() => roomsResponse.value?.meta?.active_countries ?? [])

const fetchRoomsList = async ({ page }: { page: number }) => {
  if (page === 1) {
    return {
      data: initialListRooms.value,
      meta: roomsMeta.value
    }
  }
  const params: { page: number; country?: string } = { page }
  if (selectedCountry.value) params.country = selectedCountry.value
  return await fetchRooms(params)
}

// Wrapper to satisfy InfiniteScroll prop type requirements and avoid template casting
const infiniteScrollFetcher = async (ctx: { page: number }) => {
  return fetchRoomsList(ctx) as Promise<{ data: { id: string | number }[] }>
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
  // Cached rooms painted instantly above; pull fresh participant counts behind
  // them. `status` stays 'success', so the skeleton never returns.
  if (roomsResponse.value) void refreshRooms()

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

    <!-- Room Section: skeleton only on a cold load — a background refresh keeps
         the already-painted rooms on screen rather than flashing placeholders -->
    <template v-if="roomsStatus === 'pending' && !roomsResponse">
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
        <InfiniteScroll
          :key="selectedCountry || '__all__'"
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