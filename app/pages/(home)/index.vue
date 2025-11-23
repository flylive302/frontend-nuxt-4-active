<script setup lang="ts">

definePageMeta({ layout: 'home' })

const ROOM_CARD_IMAGE = 'siteAssets/room/room-card-top.webp'
const roomCarouselItems = Array.from({ length: 6 }, () => ROOM_CARD_IMAGE)

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
    <UCarousel
        :autoplay="{ delay: 4000 }"
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

    <UCarousel
        :items="roomCarouselItems"
        :autoplay="{ delay: 3000 }"
        class-names
        :ui="{
          item: 'basis-2/3 transition duration-300 ease-in-out scale-90 [&.is-snapped]:scale-100'
        }"
        class="mb-6"
    >
      <template #default="slotProps">
        <RoomCard v-if="slotProps?.item" :image-src="slotProps.item">
          Live <span aria-hidden="true">/</span> <span class="tabular-nums">24</span>
        </RoomCard>
      </template>
    </UCarousel>

    <div class="mx-3">
      <InfiniteScroll />
    </div>
  </main>
</template>
