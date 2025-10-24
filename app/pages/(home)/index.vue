<script setup lang="ts">
import {number} from "#nuxt-scripts/validation/mock";
import InfiniteScroll from "~/components/infinite-scroll.vue";

const items = [
  'siteAssets/room/room-card-top.webp',
  'siteAssets/room/room-card-top.webp',
  'siteAssets/room/room-card-top.webp',
  'siteAssets/room/room-card-top.webp',
  'siteAssets/room/room-card-top.webp',
  'siteAssets/room/room-card-top.webp'
]

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

const banners: Banner[] = [
  {
    type: 'cp',
    lUserName: 'Noah',
    lFrameName: '',
    lAvatar: '',
    lFrameGirth: 70,
    lTop: 50,

    rUserName: 'Luna',
    rFrameName: '',
    rAvatar: '',
    rFrameGirth: 70,
    rTop: 50,

    textClass: 'pl-5',
    text: 'Weekly Cp'
  },
  {
    type: 'country',
    lUserName: 'Ali',
    lFrameName: 'frames/9',
    lAvatar: '',
    lFrameGirth: 70,
    lTop: 50,

    rUserName: 'Nora',
    rFrameName: 'frames/9',
    rAvatar: '',
    rFrameGirth: 70,
    rTop: 50,

    textClass: 'text-base',
    text: 'Country Event'
  },
  {
    type: 'recharge_tycoon',

    lUserName: 'Darwaish',
    lFrameName: 'frames/6',
    lAvatar: '',
    lFrameGirth: 70,
    lTop: 50,

    rUserName: 'Hori',
    rFrameName: 'frames/6',
    rAvatar: '',
    rFrameGirth: 70,
    rTop: 50,

    textClass: 'text-sm',
    text: 'Recharge tycoon'
  },
  {
    type: 'supreme_recharge',

    lUserName: 'Aria',
    lFrameName: 'frames/12',
    lAvatar: '',
    lFrameGirth: 70,
    lTop: 50,

    rUserName: 'Junie',
    rFrameName: 'frames/12',
    rAvatar: '',
    rFrameGirth: 70,
    rTop: 50,

    textClass: 'text-base',
    text: 'Supreme'
  },
  {
    type: 'pretty_id',

    lUserName: 'Mina',
    lFrameName: 'frames/16',
    lAvatar: '',
    lFrameGirth: 70,
    lTop: 50,

    rUserName: 'Aniya',
    rFrameName: 'frames/16',
    rAvatar: '',
    rFrameGirth: 70,
    rTop: 50,

    textClass: 'text-sm',
    text: 'Pretty ID 💖'
  },
]
</script>

<template>
  <div>

    <BackgroundDecorationsVariant1 />
    <Homeheader />
    <div class="h-14"></div>

    <UCarousel
        class-names
        :autoplay="{ delay: 4000 }"
        :items="banners"
        :ui="{
          container: 'pt-4',
          item: 'basis-1/1 transition duration-500 ease-in-out [&:not(.is-snapped)]:scale-50'
        }"
        class="mx-3 mb-5"
    >
      <template #default="{ item }">
        <EventsBanners
            v-bind="{
              ...(item.lUserName ? { lUserName: item.lUserName } : {}),
              ...(item.lFrameName ? { lFrameName: item.lFrameName } : {}),
              ...(item.lFrameGirth ? { lFrameGirth: item.lFrameGirth } : {}),
              ...(item.rUserName ? { rUserName: item.rUserName } : {}),
              ...(item.rFrameName ? { rFrameName: item.rFrameName } : {}),
              ...(item.rFrameGirth ? { rFrameGirth: item.rFrameGirth } : {})
            }"
            :type="item.type"
        >
          <span :class="item.textClass">{{ item.text }}</span>
        </EventsBanners>
      </template>
    </UCarousel>

    <UCarousel
        v-slot="{ item }"
        class-names
        :items="items"
        :autoplay="{ delay: 3000 }"
        :ui="{
          item: 'basis-2/3 transition duration-300 ease-in-out [&:not(.is-snapped)]:scale-90'
        }"
        class="mb-6"
    >
      <RoomCard :imageSrc="item">
        Live <span aria-hidden="true">/</span> <span class="tabular-nums">24</span>
      </RoomCard>
    </UCarousel>

    <InfiniteScroll />

    <div class="h-14"></div>
    <Footer />
  </div>
</template>

<style scoped>

</style>