<script setup lang="ts">
import { useIntersectionObserver } from '@vueuse/core'

definePageMeta({
  layout: 'home',
  middleware: 'auth'
})

const bannerAutoplay = ref<{ delay: number } | undefined>({ delay: 4000 })
const roomAutoplay = ref<{ delay: number } | undefined>({ delay: 3000 })

// ---- Optimization: Pause Autoplay when off-screen
const bannerRef = ref(null)
const roomRef = ref(null)

// ---- Room Logic
const roomStore = useRoomStore()
const { fetchRooms } = useRoom()
const authStore = useAuthStore()

const { data: roomsResponse } = await useAsyncData('home-rooms', async () => {
  const country = authStore.user?.phone_country?.toLowerCase() || 'pk'
  return await fetchRooms({ page: 1, country })
})

const carouselRooms = computed(() => roomsResponse.value?.data?.slice(0, 5) || [])
const initialListRooms = computed(() => roomsResponse.value?.data?.slice(5) || [])
const roomsMeta = computed(() => roomsResponse.value?.meta)

const fetchRoomsList = async ({ page }: { page: number }) => {
  if (page === 1) {
    return {
      data: initialListRooms.value,
      meta: roomsMeta.value
    }
  }
  const country = authStore.user?.phone_country?.toLowerCase() || 'pk'
  return await fetchRooms({ page, country })
}

useIntersectionObserver(bannerRef, ([entry]) => {
  bannerAutoplay.value = entry?.isIntersecting ? { delay: 4000 } : undefined
})

useIntersectionObserver(roomRef, ([entry]) => {
  roomAutoplay.value = entry?.isIntersecting ? { delay: 3000 } : undefined
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
    lUserName: 'Darwaish',
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
    <div ref="bannerRef">
      <UCarousel
          :autoplay="bannerAutoplay"
          :items="banners"
          class-names
          :ui="{
            container: 'pt-3 px-3',
            item: 'basis-1/1 transition duration-800 ease-in-out scale-10 [&.is-snapped]:scale-100'
          }"
          class="mb-4"
      >
        <template #default="slotProps">
          <EventsBanners
              v-if="slotProps?.item"
              v-bind="{
                ...(slotProps.item.lUserName ? { lUserName: slotProps.item.lUserName } : {}),
                ...(slotProps.item.lFrameName ? { lFrameName: slotProps.item.lFrameName } : {}),
                ...(slotProps.item.lFrameGirth ? { lFrameGirth: slotProps.item.lFrameGirth } : {}),
                ...(slotProps.item.rUserName ? { rUserName: slotProps.item.rUserName } : {}),
                ...(slotProps.item.rFrameName ? { rFrameName: slotProps.item.rFrameName } : {}),
                ...(slotProps.item.rFrameGirth ? { rFrameGirth: slotProps.item.rFrameGirth } : {})
              }"
              :type="slotProps.item.type"
          >
            <span :class="slotProps.item.textClass">{{ slotProps.item.text }}</span>
          </EventsBanners>
        </template>
      </UCarousel>
    </div>

    <div ref="roomRef">
      <UCarousel
          v-if="carouselRooms.length > 0"
          :items="carouselRooms"
          :autoplay="roomAutoplay"
          class-names
          :ui="{
            item: 'basis-2/3 transition duration-300 ease-in-out scale-90 [&.is-snapped]:scale-100'
          }"
          class="mb-6"
      >
        <template #default="{ item }">
          <RoomCard
            v-if="item"
            :room="item"
            class="aspect-[9/12] rounded-xl"
          />
        </template>
      </UCarousel>
    </div>

    <div class="mx-3">
      <InfiniteScroll
        :fetcher="(fetchRoomsList as any)"
        :initial-page="1"
        :per-page="15"
      >
        <template #cell="{ cell }">
          <RoomCard
            :room="cell"
            class="w-full aspect-[9/12] rounded-md"
          />
        </template>
      </InfiniteScroll>
    </div>
  </main>
</template>
