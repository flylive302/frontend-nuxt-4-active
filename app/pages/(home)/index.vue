<script setup lang="ts">
import { nextTick, shallowRef, unref, watch } from 'vue'
import { useIntersectionObserver } from '@vueuse/core'
import { ASSETS } from '~/constants/assets'
import { BANNER_AUTOPLAY_DELAY_MS, ROOM_AUTOPLAY_DELAY_MS } from '~/constants/carousel'
import { withImageKitTransform } from '~/utils/imagekit'

definePageMeta({
  layout: 'home',
  middleware: 'auth'
})

const bannerAutoplay = ref<{ delay: number } | undefined>({ delay: BANNER_AUTOPLAY_DELAY_MS })

// ---- Optimization: Pause Autoplay when off-screen; delay room autoplay until after first paint (LCP)
const bannerRef = ref(null)
const roomRef = ref(null)
const roomSectionInView = ref(true)
/** Embla snap index — LCP image must match the snapped slide, not always index 0 */
const roomCarouselSnapIndex = ref(0)
/** Until Embla has fired `select`, keep the first two slides eager (center-align snap race). */
const hadRoomCarouselSelectEvent = ref(false)
const roomCarouselRef = shallowRef<{ emblaApi?: import('vue').Ref<unknown> } | null>(null)
const roomAutoplayAfterPaint = ref(false)

const roomAutoplay = computed(() => {
  if (!roomAutoplayAfterPaint.value || !roomSectionInView.value) return undefined
  return { delay: ROOM_AUTOPLAY_DELAY_MS }
})

// ---- Following Carousel (ranked, Redis-cached)
const { fetchRankedFollowing } = useFollowingData()
const { data: rankedFollowing } = useAsyncData(
  'home-following-ranked',
  () => fetchRankedFollowing(),
  // This branch is client-only rendered below; keep non-blocking to reduce home TTFB.
  { lazy: true }
)

// ---- Room Logic
const { fetchRooms } = useRoom()

// Default to "All" — shows rooms from every country
const selectedCountry = ref<string>('')

const { data: roomsResponse, status: roomsStatus } = useAsyncData(
  'home-rooms',
  async () => {
    const params: { page: number; country?: string } = { page: 1 }
    if (selectedCountry.value) params.country = selectedCountry.value
    return await fetchRooms(params)
  },
  {
    watch: [selectedCountry],
    lazy: false,
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

useIntersectionObserver(bannerRef, ([entry]) => {
  bannerAutoplay.value = entry?.isIntersecting ? { delay: BANNER_AUTOPLAY_DELAY_MS } : undefined
})

useIntersectionObserver(roomRef, ([entry]) => {
  roomSectionInView.value = entry?.isIntersecting ?? false
})

function onRoomCarouselSelect(index: number): void {
  roomCarouselSnapIndex.value = index
  hadRoomCarouselSelectEvent.value = true
}

function roomCardPriorityLcp(index: number): boolean {
  if (!hadRoomCarouselSelectEvent.value) return index === 0 || index === 1
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
  return withImageKitTransform(room.background ?? ASSETS.ROOM_BG_PLACEHOLDER, { w: 400, q: 75 })
}

/** Preload first two carousel backgrounds — Embla often centers slide 0 or 1 before `select` fires. */
const lcpRoomPreloadHrefs = computed(() => {
  const hrefs = new Set<string>()
  const href0 = roomBackgroundPreloadHref(carouselRooms.value[0])
  const href1 = roomBackgroundPreloadHref(carouselRooms.value[1])
  if (href0) hrefs.add(href0)
  if (href1) hrefs.add(href1)
  return [...hrefs]
})

useHead(() => {
  const hrefs = lcpRoomPreloadHrefs.value
  if (!hrefs.length) return {}
  return {
    link: hrefs.map((href) => ({
      rel: 'preload',
      as: 'image',
      href,
      fetchpriority: 'high' as const,
      imagesizes: 'min(72vw, 240px)',
    })),
  }
})

// Preload room page chunk after idle so first paint / LCP stay unblocked
onMounted(() => {
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

// ---- Types
type CardType = 'cp' | 'country' | 'pretty_id' | 'recharge_tycoon' | 'supreme_recharge'
interface Banner {
  type: CardType

  lUserName?: string
  lFrameName?: string
  lAvatar?: string
  lFrameGirth?: number
  lTop?: number

  rUserName?: string
  rFrameName?: string
  rAvatar?: string
  rFrameGirth?: number
  rTop?: number

  textClass?: string
  text?: string
}

const createBanner = (
  type: CardType,
  config: Partial<Omit<Banner, 'type'>> = {}
): Banner => ({
  type,
  lFrameName: '',
  lAvatar: '',
  lFrameGirth: 70,
  lTop: 50,
  rFrameName: '',
  rAvatar: '',
  rFrameGirth: 70,
  rTop: 50,
  ...config
})

const banners: Banner[] = [
  createBanner('cp', {
    lUserName: 'Noah',
    rUserName: 'Luna',
    textClass: 'pl-5',
    text: 'Weekly Cp'
  }),
  createBanner('country', {
    lUserName: 'Ali',
    lFrameName: 'frames/9',
    rUserName: 'Nora',
    rFrameName: 'frames/9',
    textClass: 'text-base',
    text: 'Country Event'
  }),
  createBanner('recharge_tycoon', {
    lUserName: 'Darkish',
    lFrameName: 'frames/6',
    rUserName: 'Hori',
    rFrameName: 'frames/6',
    textClass: 'text-sm',
    text: 'Recharge tycoon'
  }),
  createBanner('supreme_recharge', {
    lUserName: 'Aria',
    lFrameName: 'frames/12',
    rUserName: 'Junie',
    rFrameName: 'frames/12',
    textClass: 'text-base',
    text: 'Supreme'
  }),
  createBanner('pretty_id', {
    lUserName: 'Mina',
    lFrameName: 'frames/16',
    rUserName: 'Aniya',
    rFrameName: 'frames/16',
    textClass: 'text-sm',
    text: 'Pretty ID 💖'
  })
]
</script>

<template>
  <main>

    <!-- Following vs banners depends on auth-specific API — SSR placeholder avoids branch mismatches -->
    <ClientOnly>
      <template #fallback>
        <div
          class="mt-4 mx-3 min-h-[156px] rounded-2xl bg-white/5 animate-pulse"
          aria-hidden="true"
        />
      </template>
      <div>
        <HomeFollowingCarousel v-if="rankedFollowing?.length" :users="rankedFollowing" class="mx-3" />
        <div v-else ref="bannerRef">
          <!-- Embla DOM differs after hydration — SSR markup matches #fallback to avoid console mismatches -->
          <ClientOnly>
            <template #fallback>
              <div class="mt-4 flex gap-3 overflow-x-auto px-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <div
                  v-for="(item, i) in banners"
                  :key="i"
                  class="shrink-0 basis-3/4 min-w-0"
                >
                  <EventsBanners
                    v-if="item"
                    v-bind="item"
                    :type="item.type"
                  >
                    <span :class="item.textClass">{{ item.text }}</span>
                  </EventsBanners>
                </div>
              </div>
            </template>
            <UCarousel
              :autoplay="bannerAutoplay"
              :items="banners"
              class-names
              :ui="{
                container: 'mt-4',
                item: 'basis-3/4 transition duration-800 ease-in-out scale-90 [&.is-snapped]:scale-100 squircle'
              }"
            >
              <template #default="{ item }">
                <EventsBanners
                  v-if="item"
                  v-bind="item"
                  :type="item.type"
                >
                  <span :class="item.textClass">{{ item.text }}</span>
                </EventsBanners>
              </template>
            </UCarousel>
          </ClientOnly>
        </div>
      </div>
    </ClientOnly>

    <!-- Country Filter -->
    <HomeCountryFilter v-model="selectedCountry" :active-countries="activeCountries" class="my-3" />

    <!-- Room Section: Skeleton while loading, content when ready -->
    <template v-if="roomsStatus === 'pending'">
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
            <div class="mb-6 flex gap-3 overflow-x-auto px-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <RoomCard
                v-for="(item, index) in carouselRooms"
                :key="item.id"
                :room="item"
                card-layout="carousel"
                class="h-72 max-w-60 shrink-0"
                :priority-lcp="roomCardPriorityLcp(index)"
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
                :priority-lcp="roomCardPriorityLcp(index)"
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
                class="h-56 max-w-40 mb-4"
              />
            </div>
          </template>
        </InfiniteScroll>
      </div>
    </template>
  </main>
</template>
